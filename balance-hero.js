/*!
 * Balance hero - twin hourglass scale (final).
 * Standalone Canvas 2D module: no libraries, no network, no images, no page assumptions.
 *
 *   var hero = BalanceHero.mount(canvas, { screenMin: 45, moveMin: 45, onSideTap: function (side) {} });
 *   optional: earnedMin (the scroll minutes the host really credited for today's movement), leftMin (the host's own
 *   minutes-left number), onReady(), onBalanced(); the canvas wants touch-action: pan-y
 *   hero.setState({ screenMin: 95 });   hero.getState();   hero.resize();   hero.destroy();
 *   BalanceHero.describe(state)  -> the exact strings and numbers the hero shows (single source of truth)
 *   BalanceHero.setState / destroy / stats forward to the most recently mounted instance.
 *
 * Whole numbers: everything the hero shows, says or decides comes from S = screen minutes and M = movement minutes (both
 * rounded half up) and E = earned minutes (earnedMin when given, otherwise Math.round(M x rate)), each capped at 99999.
 * "Ahead by" is always |S - E| and the balance band uses that same number, and the goal mark sits so that the right sand is at
 * or above it exactly when the goal is met. Pass whole minutes, and pass earnedMin and leftMin from your own books so the hero
 * shows exactly what you credited (a day with mixed rates reads "earns E min"). getState() returns the cleaned inputs (not rounded).
 *
 * Left vessel = screen minutes on watched apps. Right vessel = earned minutes E (movement minutes times the earn rate).
 * Every drawing operation here has a SwiftUI Canvas equivalent (paths, fills, strokes, gradients,
 * clipping, opacity, plus-lighter and screen blending, a blurred layer). See HERO_SPEC.md.
 */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2, DEG = Math.PI / 180, HPI = Math.PI / 2;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (Math.round(a * 1000) / 1000) + ')'; }
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // Damped spring, same parameters as SwiftUI .spring(response:dampingFraction:)
  function Spring(x, response, damping) { this.x = x; this.v = 0; this.t = x; var w = TAU / response; this.k = w * w; this.c = 2 * damping * w; }
  Spring.prototype.step = function (dt) {
    var n = dt > 0.012 ? 2 : 1, h = dt / n, i;
    for (i = 0; i < n; i++) { this.v += (this.k * (this.t - this.x) - this.c * this.v) * h; this.x += this.v * h; }
    return this.x;
  };
  Spring.prototype.snap = function (x) { this.x = x; this.t = x; this.v = 0; };

  // ---------- design tokens ----------
  var COL = {
    text: [240, 244, 255], white: [255, 255, 255], black: [0, 0, 0],
    indigo: [99, 102, 241], indigoL: [130, 133, 244], violet: [168, 85, 247], violetL: [201, 160, 255],
    teal: [45, 212, 191], tealL: [110, 231, 216], mint: [52, 211, 153], mintL: [167, 243, 208],
    amber: [245, 158, 11], amberL: [251, 191, 36], coral: [248, 113, 113], coralL: [252, 165, 165],
    cream: [255, 240, 212]
  };
  var FAMILY = 'ui-rounded, "SF Pro Rounded", -apple-system, system-ui, "Segoe UI", sans-serif';
  // Sand ramps run from the crest (0) to the floor (1). Left is always warm, right is always cool.
  var SIDE = [
    { name: 'screen', glow: 'coral', glow2: 'amber', core: 'amberL', gain: 1.3, acc: COL.coral, hi: COL.cream, mid: COL.amberL,
      ramp: [[0, [255, 236, 200]], [0.09, [253, 208, 104]], [0.34, [249, 158, 66]], [0.68, [246, 112, 104]], [1, [214, 70, 80]]],
      deep: [200, 62, 74], grains: [[255, 244, 220], [255, 218, 140], [252, 176, 100], [242, 116, 98]] },
    { name: 'move', glow: 'teal', glow2: 'mint', core: 'mint', gain: 1, acc: COL.teal, hi: [224, 253, 240], mid: COL.mint,
      ramp: [[0, [224, 253, 240]], [0.09, [150, 242, 200]], [0.34, [60, 216, 160]], [0.68, [30, 186, 184]], [1, [12, 120, 152]]],
      deep: [12, 104, 140], grains: [[232, 255, 246], [160, 244, 206], [94, 226, 206], [24, 164, 174]] }
  ];

  // ---------- model (shared by the canvas, the host page and the native port) ----------
  var MODEL = { balanceBand: 5, fullTiltAt: 60, maxTiltDeg: 14, tiltCurve: 0.72, halfFullAt: 45, fillHeight: 0.9 };
  var DEFAULTS = { screenMin: 0, moveMin: 0, rate: 1, allowance: 60, goalMin: 30, tracking: true, leftMin: null, earnedMin: null };
  var CEIL = 99999;   // ceiling of every whole number the hero shows or weighs (a real day never gets there)
  function cleanNum(v, lo, hi, prev) {
    if (typeof v === 'string' && v.trim() !== '') v = Number(v);
    return (typeof v === 'number' && isFinite(v)) ? clamp(v, lo, hi) : prev;
  }
  // whole minutes: rounded half up (JavaScript Math.round, Swift .rounded() for values of 0 and up), never below 0, never above CEIL
  function whole(v) { v = Math.round(v); return v > 0 ? (v < CEIL ? v : CEIL) : 0; }
  // leftMin and earnedMin: the host's own numbers. A number or a numeric string is taken and kept as given (the model uses its whole
  // minutes); null goes back to the computed value, and so does undefined when reset is set (earnedMin); anything else that is not a
  // finite number is ignored.
  function cleanHost(v, prev, reset) {
    if (v === null || (reset && v === undefined)) return null;
    if (typeof v === 'string' && v.trim() !== '') v = Number(v);
    return (typeof v === 'number' && isFinite(v)) ? v : prev;
  }
  function cleanTracking(v, prev) {
    if (v === undefined || v === null) return prev;
    if (typeof v === 'string') { v = v.trim().toLowerCase(); return !(v === '0' || v === 'false' || v === 'off' || v === 'no' || v === ''); }
    return !!v;
  }
  // norm: merges a patch into a state and rejects anything that is not a usable number. It is the one path that mount options,
  // setState patches and describe() all go through, and it derives the three whole numbers behind everything the hero shows,
  // says and decides: S = scr and M = mov (screenMin and moveMin in whole minutes), and E = earn, the earned minutes (the host's
  // earnedMin when given, otherwise Math.round(M x rate)). Labels, sentences, the difference, the band test, the goal mark, the
  // callbacks and the targets the sand and the beam move toward all use S, M and E and nothing finer, so the numbers on screen
  // always add up (|S - E|). The inputs themselves are kept as cleaned (not rounded): getState() returns them, as in 1.2.0.
  function norm(prev, patch) {
    var s = { screenMin: prev.screenMin, moveMin: prev.moveMin, rate: prev.rate, allowance: prev.allowance, goalMin: prev.goalMin, tracking: prev.tracking, leftMin: prev.leftMin == null ? null : prev.leftMin, earnedMin: prev.earnedMin == null ? null : prev.earnedMin, scr: 0, mov: 0, earn: 0 }, r;
    if (patch) {
      s.screenMin = cleanNum(patch.screenMin, 0, 1440, s.screenMin);
      s.moveMin = cleanNum(patch.moveMin, 0, 1440, s.moveMin);
      r = cleanNum(patch.rate, -1e9, 1e9, NaN);
      if (r > 0) s.rate = clamp(r, 0.1, 10);
      s.allowance = cleanNum(patch.allowance, 0, 1440, s.allowance);
      s.goalMin = cleanNum(patch.goalMin, 0, 1440, s.goalMin);
      s.tracking = cleanTracking(patch.tracking, s.tracking);
      s.leftMin = cleanHost(patch.leftMin, s.leftMin, false);
      s.earnedMin = cleanHost(patch.earnedMin, s.earnedMin, Object.prototype.hasOwnProperty.call(patch, 'earnedMin'));
    }
    s.scr = whole(s.screenMin); s.mov = whole(s.moveMin);
    s.earn = s.earnedMin != null ? whole(s.earnedMin) : whole(s.mov * s.rate);
    return s;
  }
  function tiltDegFor(diff) {
    var ad = Math.abs(diff);
    if (ad <= MODEL.balanceBand) return 0;
    return (diff > 0 ? -1 : 1) * MODEL.maxTiltDeg * Math.pow(clamp((ad - MODEL.balanceBand) / (MODEL.fullTiltAt - MODEL.balanceBand), 0, 1), MODEL.tiltCurve);
  }
  // Sand level versus minutes: half of the fill height at 45 weighted minutes, always rising, never full.
  function fillFrac(weightMin) { return weightMin > 0 ? weightMin / (weightMin + MODEL.halfFullAt) : 0; }
  function minOfFill(f) { return f <= 0 ? 0 : MODEL.halfFullAt * f / (1 - f); }
  function rate2(r) { return Math.round(r * 100) / 100; }   // the rate as shown: two decimals at most
  function fmtRate(r) { return String(rate2(r)) + '\u00D7'; }
  function mins(n) { return n + (n === 1 ? ' minute' : ' minutes'); }
  function describe(state) {
    // every number here is one of the whole numbers from norm (S, M, E): the difference is exactly |S - E|, and the band test uses it
    var s = norm(DEFAULTS, state), scr = s.scr, mov = s.mov, earnN = s.earn, diff = scr - earnN, ad = Math.abs(diff), N = ad;
    var earn = String(earnN), goal = Math.round(s.goalMin);
    var left = whole(s.leftMin != null ? s.leftMin : s.allowance + earnN - scr);
    var rateOn = Math.abs(s.rate - 1) > 1e-6, goalMet = goal > 0 && mov >= goal, toGoal = Math.max(0, goal - mov);
    // the earns line shows when the rate is not 1 or E is not M; it names the rate only when E is M at that rate (a host's
    // earnedMin from a day with mixed rates reads "earns E min", since naming one rate would be untrue), and only when the rate as
    // shown gives the same E (a rate with more decimals, such as 1/3 shown as 0.33, could not be checked by the reader)
    var oneRate = earnN === whole(mov * s.rate), earnsOn = rateOn || earnN !== mov, atRate = rateOn && oneRate && earnN === whole(mov * rate2(s.rate));
    // the goal mark: the earned level that goes with the goal, placed so that the right sand is at or above it exactly when the goal
    // is met. On a one-rate day (E is Math.round(M x rate)) it sits at goal x rate, as in 1.2.0. When the host's earnedMin says
    // otherwise (a day with mixed rates), or when goal x rate would disagree with the goal text (whole minutes at a rate under 1:
    // 29 and 30 min at 0.5x both earn 15), it sits where the sand will be when the goal is met at today's rate, E + (goal - M) x rate.
    // A level of 0 or below (the host credited no more than the minutes past the goal) draws no mark.
    var goalLvl = goal * s.rate;
    if (!oneRate || (goalMet ? earnN < goalLvl : earnN >= goalLvl)) goalLvl = earnN + (goal - mov) * s.rate;
    var kind, mood, status, a11yStatus;
    if (!s.tracking) { kind = 'off'; mood = 'off'; status = 'Not tracking yet'; a11yStatus = 'Not tracking yet.'; }
    else if (ad <= MODEL.balanceBand) {
      kind = (scr === 0 && mov === 0 && earnN === 0) ? 'empty' : 'balanced'; mood = 'balanced';
      status = kind === 'empty' ? 'Balanced · fresh start' : 'Balanced · within 5 min'; a11yStatus = 'Balanced.';
    } else if (diff > 0) { kind = 'scroll'; mood = 'scroll'; status = 'Scrolling is ahead by ' + N + ' min'; a11yStatus = 'Scrolling is ahead by ' + mins(N) + '.'; }
    else { kind = 'move'; mood = 'move'; status = 'Movement is ahead by ' + N + ' min'; a11yStatus = 'Movement is ahead by ' + mins(N) + '.'; }
    var screenLabel = !s.tracking ? 'not measured' : scr === 0 ? 'None yet' : 'about ' + scr + ' min';
    var moveDetail = mov + ' min moved' + (earnsOn ? ' · earns ' + earn : '') + (goal > 0 ? (goalMet ? ' · goal met' : ' · ' + toGoal + ' to goal') : '');
    var screenDetail = !s.tracking ? 'Screen time is not being measured yet' : scr === 0 ? 'No time on picked apps so far today' : 'About ' + scr + ' min on your picked apps today';
    var a11y = s.tracking
      ? (scr === 0 ? 'No screen time yet, ' : 'About ' + mins(scr) + ' of screen time, ') + mins(mov) + ' of movement' + (earnsOn ? ' counting as ' + earn : '') + '. ' + a11yStatus + ' ' + mins(left) + ' left.'
      : 'Not tracking yet. Screen time is not measured. ' + mins(mov) + ' of movement.';
    return {
      status: status, kind: kind, mood: mood, tracking: s.tracking,
      diff: diff, diffMin: s.tracking ? N : null, minutesLeft: s.tracking ? left : null,
      screenTitle: 'Screen time', moveTitle: 'Movement', unitLabel: 'min left',
      screenLabel: screenLabel, screenValue: scr, screenSub: 'on picked apps',
      moveLabel: mov + ' min', moveValue: mov, earnsLabel: earnsOn ? 'earns ' + earn + ' min' + (atRate ? ' at ' + fmtRate(s.rate) : '') : '', earnsValue: earnN, rateLabel: fmtRate(s.rate), rateOn: rateOn,
      goalLabel: goal > 0 ? 'of ' + goal + ' min goal' : '', goalMin: goal, goalMet: goalMet,
      screenDetail: screenDetail, moveDetail: moveDetail, a11y: a11y,
      tiltDeg: s.tracking ? tiltDegFor(diff) : 0,
      fillLeft: s.tracking ? fillFrac(scr) : 0, fillRight: fillFrac(earnN), goalFill: goal > 0 && goalLvl > 0 ? fillFrac(goalLvl) : null
    };
  }

  // ---------- geometry, in points of a 390 x 432 design box ----------
  var G = { W: 390, H: 432, cx: 195, cy: 158, arm: 100, R: 49, H2: 102, wN: 4.8, bw: 28, wall: 3.2, baseY: 304 };
  var Ri = G.R - G.wall, Hi = G.H2 - 6.5, wNi = G.wN - 1.2, bwi = G.bw - 0.5, PSTEP = 0.5;
  var HFILL = MODEL.fillHeight * Hi;
  var ROW = { title: 338, val: 360, sub1: 377, sub2: 392, num: 371, unit: 388, capY: 398, capH: 26, xL: 78, xR: 312 };
  function pathVessel(c, R, H, wN, bw) {
    c.moveTo(-bw, -H); c.lineTo(bw, -H);
    c.bezierCurveTo(0.86 * R, -H, R, -0.86 * H, R, -0.62 * H);
    c.bezierCurveTo(R, -0.30 * H, wN, -0.22 * H, wN, 0);
    c.bezierCurveTo(wN, 0.22 * H, R, 0.30 * H, R, 0.62 * H);
    c.bezierCurveTo(R, 0.86 * H, 0.86 * R, H, bw, H);
    c.lineTo(-bw, H);
    c.bezierCurveTo(-0.86 * R, H, -R, 0.86 * H, -R, 0.62 * H);
    c.bezierCurveTo(-R, 0.30 * H, -wN, 0.22 * H, -wN, 0);
    c.bezierCurveTo(-wN, -0.22 * H, -R, -0.30 * H, -R, -0.62 * H);
    c.bezierCurveTo(-R, -0.86 * H, -0.86 * R, -H, -bw, -H);
    c.closePath();
  }
  function bez(a, b, c, d, t) { var u = 1 - t; return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d; }
  // half width of the vessel at distance y from the waist (same curve as pathVessel)
  function buildProfile(R, H, wN, bw) {
    var n = Math.ceil(H / PSTEP) + 2, tab = new Float32Array(n), i, t, k, x;
    for (i = 0; i < n; i++) tab[i] = -1;
    function put(y, xx) { k = Math.round(y / PSTEP); if (k >= 0 && k < n && xx > tab[k]) tab[k] = xx; }
    for (i = 0; i <= 900; i++) {
      t = i / 900;
      put(bez(0, 0.22 * H, 0.30 * H, 0.62 * H, t), bez(wN, wN, R, R, t));
      put(bez(0.62 * H, 0.86 * H, H, H, t), bez(R, R, 0.86 * R, bw, t));
    }
    x = wN; for (i = 0; i < n; i++) { if (tab[i] < 0) tab[i] = x; else x = tab[i]; }
    return tab;
  }
  function wAt(tab, y) {
    y = (y < 0 ? -y : y) / PSTEP; var k = y | 0; if (k >= tab.length - 1) return tab[tab.length - 1];
    return tab[k] + (tab[k + 1] - tab[k]) * (y - k);
  }
  var profI = buildProfile(Ri, Hi, wNi, bwi);
  // sand columns
  var NC = 41, DX = 2 * Ri / (NC - 1);
  var XS = new Float32Array(NC), colA = new Float32Array(NC), colB = new Float32Array(NC), topU = new Float32Array(NC), botU = new Float32Array(NC), BUMP = new Float32Array(NC), NAR = new Float32Array(NC), WAV = new Float32Array(NC), SH = new Float32Array(NC);
  (function () {
    var j, x, ax, y, a, b, r = mulberry32(977), raw = [];
    for (j = 0; j < NC; j++) {
      x = -Ri + j * DX; ax = Math.abs(x); XS[j] = x;
      a = 0; if (ax > wNi) { for (y = 0; y <= 0.62 * Hi; y += 0.25) if (wAt(profI, y) >= ax) break; a = y; }
      b = Hi; if (ax > bwi) { for (y = Hi; y >= 0.62 * Hi; y -= 0.25) if (wAt(profI, y) >= ax) break; b = y; }
      if (b < a) b = a;
      colA[j] = a; colB[j] = b; topU[j] = -b; botU[j] = -a;
      BUMP[j] = Math.pow(Math.max(0, Math.cos(HPI * x / Ri)), 1.5);
      NAR[j] = Math.pow(Math.max(0, Math.cos(HPI * x / Ri)), 6);
      raw.push(r() - 0.5);
    }
    for (j = 0; j < NC; j++) WAV[j] = 0.5 * (raw[Math.max(0, j - 1)] + 2 * raw[j] + raw[Math.min(NC - 1, j + 1)]) / 4 * 2;
  })();
  function flatArea(L) { var s = 0, j, h; for (j = 0; j < NC; j++) { h = colB[j] - (colA[j] > L ? colA[j] : L); if (h > 0) s += h; } return s * DX; }
  function areaFor(weightMin) { return flatArea(Hi - HFILL * fillFrac(weightMin)); }
  function solveLevel(top, bot, sh, A, lo, hi) {
    var i, j, m, s, y, h;
    for (i = 0; i < 18; i++) {
      m = (lo + hi) / 2; s = 0;
      for (j = 0; j < NC; j++) { y = m + sh[j]; if (y < top[j]) y = top[j]; h = bot[j] - y; if (h > 0) s += h; }
      if (s * DX > A) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }
  function surfAt(ys, x) {
    var f = (x + Ri) / DX, k = f | 0; if (f <= 0) return ys[0]; if (k >= NC - 1) return ys[NC - 1];
    return ys[k] + (ys[k + 1] - ys[k]) * (f - k);
  }
  function rr(c, x, y, w, h, r) { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function star4(c, x, y, s) {
    var k = s * 0.14;
    c.moveTo(x, y - s); c.quadraticCurveTo(x + k, y - k, x + s, y); c.quadraticCurveTo(x + k, y + k, x, y + s);
    c.quadraticCurveTo(x - k, y + k, x - s, y); c.quadraticCurveTo(x - k, y - k, x, y - s);
  }
  var TONE = [
    ['#2A1216', '#7A3A3C', '#EDA98E', '#FFF4E6', '#F6C0A0', '#92494A', '#3C1A20', '#B87466'],
    ['#06202A', '#1C5E6A', '#7CDCD0', '#F0FFFB', '#A4EDDF', '#2C7884', '#0C2C36', '#56AAA8'],
    ['#111332', '#383E90', '#9299F5', '#F1F2FF', '#ADB2F9', '#494FAE', '#1B1E52', '#686FD6']
  ], TSTOP = [0, 0.1, 0.3, 0.41, 0.52, 0.74, 0.9, 1];
  function metal(c, x0, x1, tone) {
    var g = c.createLinearGradient(x0, 0, x1, 0), t = TONE[tone == null ? 2 : tone], i;
    for (i = 0; i < 8; i++) g.addColorStop(TSTOP[i], t[i]);
    return g;
  }

  // ---------- resolution independent soft sprites (built once per page) ----------
  var SPR = {};
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  function blobSprite(key) {
    if (SPR[key]) return SPR[key];
    var cv = mkCanvas(64, 64), c = cv.getContext('2d'), col = COL[key], g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(col, 1)); g.addColorStop(0.2, rgba(col, 0.8)); g.addColorStop(0.4, rgba(col, 0.47)); g.addColorStop(0.6, rgba(col, 0.2)); g.addColorStop(0.8, rgba(col, 0.05)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); SPR[key] = cv; return cv;
  }
  var IRI = [[0, COL.indigoL], [0.2, COL.violet], [0.38, COL.indigo], [0.55, COL.teal], [0.68, COL.mint], [0.82, COL.violetL], [1, COL.indigoL]];
  // balanced shimmer on each vessel's rim stays inside that side's own family
  var RIMW = [[0, COL.amberL], [0.25, COL.coralL], [0.5, COL.violetL], [0.75, COL.coral], [1, COL.amberL]];
  var RIMC = [[0, COL.mint], [0.25, COL.tealL], [0.5, COL.indigoL], [0.75, COL.teal], [1, COL.mint]];
  function conic(c, x, y, stops) { var g = c.createConicGradient(0, x, y), i; stops = stops || IRI; for (i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], rgba(stops[i][1], 1)); return g; }
  function ringSprite() {   // soft iridescent ring, 192 px square, ring radius 69 px (46 pt when drawn 128 pt wide)
    if (SPR._ring) return SPR._ring;
    var cv = mkCanvas(192, 192), c = cv.getContext('2d'), w = [[34, 0.08], [24, 0.14], [15, 0.22]], i;   // wide strokes only: the half-resolution layer cannot hold a thin line
    c.strokeStyle = conic(c, 96, 96);
    for (i = 0; i < w.length; i++) { c.globalAlpha = w[i][1]; c.lineWidth = w[i][0]; c.beginPath(); c.arc(96, 96, 69, 0, TAU); c.stroke(); }
    SPR._ring = cv; return cv;
  }
  function raysSprite() {   // soft rays, 256 px square for a 150 pt radius
    if (SPR._rays) return SPR._rays;
    var cv = mkCanvas(256, 256), c = cv.getContext('2d'), r = mulberry32(4411), n = 14, i, k, a, hw, len, g, col, FEA = [2.1, 1.35, 0.7], cols = [COL.indigoL, COL.violetL, COL.indigoL, COL.tealL];
    c.translate(128, 128);
    for (i = 0; i < n; i++) {
      a = i / n * TAU + (r() - 0.5) * 0.2; hw = (1.6 + r() * 2.6) * DEG; len = 78 + r() * 50; col = cols[i % 4];
      g = c.createRadialGradient(0, 0, 14, 0, 0, len);
      g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.22, rgba(col, 0.2)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      for (k = 0; k < 3; k++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, len, a - hw * FEA[k], a + hw * FEA[k]); c.closePath(); c.fill(); }
    }
    SPR._rays = cv; return cv;
  }

  // ---------- one mounted hero ----------
  var MAXG = 480, lastInstance = null, OWNED = typeof WeakMap === 'function' ? new WeakMap() : null;
  var REWARD_OUT = 0.25;   // seconds: once the state is no longer balanced, every reward visual is gone within this time
  var DIM_FULL = 0.998;    // below this dim strength the picture is drawn into one layer and composited at the dim strength
  // adaptive quality: while animating, the mean frame step over the last QWIN frames (steps over QPAUSE ms are pauses and are
  // skipped, as are the first QSKIP frames after a mount, a resume or an art rebuild) above QSLOW ms lowers the backing-store
  // scale one step in QSTEPS. It never goes back up for the life of the instance.
  var QSTEPS = [3, 2, 1.5, 1], QWIN = 90, QSKIP = 30, QSLOW = 22, QPAUSE = 100;
  function cleanDbg(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0; }   // debugFrameMs, a test-only input
  function mount(canvas, options) {
    options = options || {};
    if (OWNED && OWNED.get(canvas)) OWNED.get(canvas).destroy();   // one hero per canvas: a second mount replaces the first
    var ctx = canvas.getContext('2d');
    var st = norm(DEFAULTS, options), desc = describe(st);
    var mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var forcedReduce = options.reducedMotion, reduce = forcedReduce != null ? !!forcedReduce : !!(mq && mq.matches);
    var mqT = root.matchMedia ? root.matchMedia('(prefers-reduced-transparency: reduce)') : null;
    var forcedT = options.reduceTransparency, reduceT = forcedT != null ? !!forcedT : !!(mqT && mqT.matches);
    var destroyed = false, frozen = !!options.frozen, inView = true, raf = 0, lastT = 0, time = reduce ? 1.7 : 0;
    var cssW = 0, cssH = 0, dpr = 1, S = 1, K = 1, OX = 0, OY = 0, SQ = 0.5, grp = null, gctx = null;
    var soft = mkCanvas(1, 1), sctx = soft.getContext('2d'), snap = null, fadeT0 = 0, fading = false;
    var rnd = mulberry32(20261121);
    var VW = 2 * (G.R + 8), VH = 2 * (G.H2 + 10), TW = 2 * Ri + 2, TH = Hi + 2, GS = 76, GR = 24, HRX = 19.5, HRY = 6.6;
    var STX = G.cx - 62, STY = G.cy + 8, STW = 124, STH = G.baseY + 28 - STY;
    var spr = { glass: [null, null], tex: [null, null], gem: {}, stand: null };
    var grad = {};
    // springs
    var tilt = new Spring(0, 0.95, 0.46), drag = new Spring(0, 0.5, 0.3), moodS = new Spring(0, 1.0, 1), rewS = new Spring(0, 1.1, 1), dimS = new Spring(1, 0.7, 1), capW = new Spring(160, 0.35, 0.85);
    var theta = 0, omega = 0, par = { x: 0, y: 0, tx: 0, ty: 0 };
    var selected = -1, flash = 0, celebrated = false, ringPulse = 0, balDue = false, readyDone = false, quell = 0, quellF = 0;
    var numFrom = 0, numTo = 0, numT0 = -9, numShown = 0, numLive = false, opening = true;
    var capKey = '', capT0 = -9;
    // grains (struct of arrays, swap remove)
    var gx = new Float32Array(MAXG), gy = new Float32Array(MAXG), gvx = new Float32Array(MAXG), gvy = new Float32Array(MAXG), gl = new Float32Array(MAXG), gr = new Float32Array(MAXG);
    var gk = new Uint8Array(MAXG), gs = new Uint8Array(MAXG), gb = new Uint8Array(MAXG), gN = 0, peakG = 0;
    // celebration sparks (world space)
    var MAXS = 36, sx = new Float32Array(MAXS), sy = new Float32Array(MAXS), svx = new Float32Array(MAXS), svy = new Float32Array(MAXS), sl = new Float32Array(MAXS), sN = 0;
    var st8 = { frames: 0, gapSum: 0, gapMax: 0, renSum: 0, renMax: 0, lastNow: 0 };
    var qCap = 3, qDrops = 0, qBuf = new Float64Array(QWIN), qN = 0, qI = 0, qSum = 0, qAvg = null, qSkip = QSKIP, dbgMs = cleanDbg(options.debugFrameMs);

    function makeVessel(side) {
      var tw = [], i;
      for (i = 0; i < 9; i++) tw.push({ f: rnd(), d: 1.5 + rnd() * 15, ph: rnd() * TAU, sp: 0.7 + rnd() * 1.3 });
      return { side: side, pal: SIDE[side], sgn: side ? 1 : -1, target: 0, disp: 0, acc: 0, shower: 0, pouring: false, draining: false,
        load: 0, flow: new Spring(0, 0.2, 1), dr: new Spring(0, 0.25, 1), up: new Spring(0, 0.25, 1), ang: new Spring(0, 0.55, 0.26), mound: new Spring(8, 0.5, 0.8), sel: new Spring(0, 0.32, 0.6), sw: new Spring(0, 0.6, 0.32),
        ys: new Float32Array(NC), yu: new Float32Array(NC), j0: 0, j1: -1, u0: 0, u1: -1, top: Hi, topUp: 0, area: 0, areaUp: 0, fill: 0, x: 0, y: 0, tw: tw, glintAt: 2 + rnd() * 5, glintSpot: 0 };
    }
    var V = [makeVessel(0), makeVessel(1)];
    var dust = [], DUSTCOL = [rgba(SIDE[0].hi, 0.8), rgba(COL.violetL, 0.8), rgba(SIDE[1].hi, 0.8)];
    (function () {
      var i, j, x, y, m;
      for (i = 0; i < 16; i++) { x = 14 + rnd() * 362; y = 20 + rnd() * 268; dust.push({ x: x, y: y, r: 1.1 + rnd() * 1.5, sp: 0.5 + rnd() * 1.1, ph: rnd() * TAU, d: 3 + rnd() * 9, k: x < 150 ? 0 : x > 240 ? 2 : 1 }); }
      for (j = 0; j < 2; j++) { m = []; for (i = 0; i < 7; i++) m.push({ ax: 5 + rnd() * 0.42 * Ri, y: -(0.3 + ((i * 3) % 7 + rnd()) / 7 * 0.56) * Hi, r: 0.42 + rnd() * 0.45, sp: 0.18 + rnd() * 0.3, tw: 0.8 + rnd() * 1.4, ph: rnd() * TAU }); V[j].motes = m; }
    })();

    // ----- sprites that depend on resolution -----
    function mk(w, h) { var cv = mkCanvas(w * K, h * K), c = cv.getContext('2d'); c.scale(K, K); return { cv: cv, c: c }; }
    function blobTo(c, key, x, y, rx, ry, a) { c.globalAlpha = a; c.drawImage(blobSprite(key), x - rx, y - ry, 2 * rx, 2 * ry); c.globalAlpha = 1; }
    function cap(c, y, w, h, r, tone) {
      c.beginPath(); rr(c, -w / 2, y, w, h, r); c.fillStyle = metal(c, -w / 2, w / 2, tone); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.34)'; c.beginPath(); rr(c, -w / 2 + 1.5, y + 0.7, w - 3, 1.1, 0.55); c.fill();
      c.fillStyle = 'rgba(4,6,16,0.34)'; c.beginPath(); rr(c, -w / 2 + 1, y + h - 1.5, w - 2, 1.5, 0.7); c.fill();
    }
    function crescent(c, sg, side, inset, thick, alpha) {   // tapered specular along the inside of one bulb
      var y0 = 0.17 * Hi, y1 = 0.88 * Hi, n = 26, i, u, y, x;
      c.beginPath();
      for (i = 0; i <= n; i++) { u = i / n; y = lerp(y0, y1, u); x = wAt(profI, y) - inset; if (i === 0) c.moveTo(side * x, sg * y); else c.lineTo(side * x, sg * y); }
      for (i = n; i >= 0; i--) { u = i / n; y = lerp(y0, y1, u); x = wAt(profI, y) - inset - thick * Math.pow(Math.sin(Math.PI * u), 0.8); c.lineTo(side * x, sg * y); }
      c.closePath(); c.fillStyle = 'rgba(255,255,255,' + alpha + ')'; c.fill();
    }
    function buildGlass(side) {
      var pal = SIDE[side], tint = pal.acc, hi = pal.hi, b = mk(VW, VH), f = mk(VW, VH), gn = pal.gain, core = pal.core, c, g, i, w;
      // back: body tint, edge colour, light pooled in both bulbs
      c = b.c; c.translate(VW / 2, VH / 2);
      c.beginPath(); pathVessel(c, G.R, G.H2, G.wN, G.bw);
      c.fillStyle = 'rgba(9,12,26,0.12)'; c.fill();
      g = c.createLinearGradient(0, -G.H2, 0, G.H2);
      g.addColorStop(0, rgba(tint, 0.24 * gn)); g.addColorStop(0.4, rgba(pal.mid, 0.12 * gn)); g.addColorStop(0.6, rgba(pal.mid, 0.08 * gn)); g.addColorStop(1, rgba(tint, 0.16 * gn));
      c.fillStyle = g; c.fill();
      c.save(); c.beginPath(); pathVessel(c, Ri, Hi, wNi, bwi); c.clip();
      // light hugging the inside of the wall: the outline stroked with a wide blur, clipped to the interior
      // (the stroke itself is drawn off canvas and only its blurred copy lands here, so there is no hard inner line)
      c.save(); c.lineJoin = 'round'; c.strokeStyle = '#000'; c.shadowOffsetX = 3 * VW * K; c.translate(-3 * VW, 0);
      c.beginPath(); pathVessel(c, Ri, Hi, wNi, bwi);
      c.lineWidth = 11; c.shadowColor = rgba(tint, 0.52); c.shadowBlur = 9 * K; c.stroke();
      c.lineWidth = 4; c.shadowColor = rgba(hi, 0.28); c.shadowBlur = 3 * K; c.stroke();
      c.restore();
      c.globalCompositeOperation = 'lighter';
      blobTo(c, pal.glow, 0, -0.58 * Hi, 48, 46, 0.36 * gn); blobTo(c, core, 0, -0.5 * Hi, 30, 34, 0.3 * gn); blobTo(c, core, 0, -0.2 * Hi, 16, 26, 0.24 * gn);
      blobTo(c, pal.glow, 0, Hi - 5, 46, 22, 0.3 * gn); blobTo(c, pal.glow, 0, 0.56 * Hi, 42, 40, 0.16 * gn); blobTo(c, core, 0, 0.24 * Hi, 17, 26, 0.15 * gn);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(255,255,255,0.03)';
      c.beginPath(); c.ellipse(15, -0.55 * Hi, 11, 27, 0.22, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(15, 0.55 * Hi, 11, 27, -0.22, 0, TAU); c.fill();
      c.restore();
      // front: wall, rim light, speculars, caps, collar
      c = f.c; c.translate(VW / 2, VH / 2);
      c.beginPath(); pathVessel(c, G.R, G.H2, G.wN, G.bw); pathVessel(c, Ri, Hi, wNi, bwi);
      g = c.createLinearGradient(-G.R, -G.H2, G.R, G.H2);
      g.addColorStop(0, 'rgba(255,255,255,0.30)'); g.addColorStop(0.35, rgba(hi, 0.15)); g.addColorStop(0.7, rgba(tint, 0.13)); g.addColorStop(1, 'rgba(255,255,255,0.17)');
      c.fillStyle = g; c.fill('evenodd');
      c.beginPath(); pathVessel(c, Ri, Hi, wNi, bwi); c.lineWidth = 0.8; c.strokeStyle = 'rgba(255,255,255,0.15)'; c.stroke();
      c.beginPath(); pathVessel(c, G.R, G.H2, G.wN, G.bw); c.lineJoin = 'round';
      c.lineWidth = 5; c.strokeStyle = rgba(tint, 0.10); c.stroke();
      g = c.createLinearGradient(-G.R, -G.H2, G.R, G.H2);
      g.addColorStop(0, 'rgba(255,255,255,0.88)'); g.addColorStop(0.3, rgba(hi, 0.6)); g.addColorStop(0.62, rgba(tint, 0.42)); g.addColorStop(1, 'rgba(255,255,255,0.46)');
      c.lineWidth = 1.15; c.strokeStyle = g; c.stroke();
      crescent(c, -1, -1, 3.4, 5.6, 0.30); crescent(c, 1, -1, 3.4, 5.6, 0.26);
      crescent(c, -1, 1, 2.6, 2.2, 0.11); crescent(c, 1, 1, 2.6, 2.2, 0.10);
      c.fillStyle = 'rgba(255,255,255,0.20)';
      c.beginPath(); c.ellipse(0.44 * Ri, -0.70 * Hi, 2.6, 7.5, 0.5, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(0.50 * Ri, 0.36 * Hi, 2.2, 6, 0.42, 0, TAU); c.fill();
      cap(c, -G.H2 - 5.5, 2 * (G.bw + 7), 7.5, 3.2, side); cap(c, G.H2 - 2, 2 * (G.bw + 7), 7.5, 3.2, side);
      cap(c, -4, 2 * (G.wN + 3.4), 8, 2.3, side);
      return { back: b.cv, front: f.cv };
    }
    function buildTex(side) {   // fine round grains and side shading, revealed by the sand clip
      var pal = SIDE[side], s = mk(TW, TH), c = s.c, r = mulberry32(side ? 5309 : 8675), g, b, i, n, x, y, rad;
      var buckets = [[300, 0.22, 0.4, pal.grains[0], 0.6], [820, 0.3, 0.58, pal.grains[1], 0.3], [620, 0.32, 0.64, pal.grains[2], 0.3], [560, 0.3, 0.6, pal.grains[3], 0.3]];
      c.translate(TW / 2, 1);
      c.save(); c.beginPath(); pathVessel(c, Ri, Hi, wNi, bwi); c.clip();
      g = c.createLinearGradient(-Ri, 0, Ri, 0);
      g.addColorStop(0, rgba(pal.deep, 0.6)); g.addColorStop(0.24, rgba(pal.deep, 0)); g.addColorStop(0.66, rgba(pal.deep, 0)); g.addColorStop(1, rgba(pal.deep, 0.66));
      c.fillStyle = g; c.fillRect(-Ri, 0, 2 * Ri, Hi);
      g = c.createLinearGradient(-0.62 * Ri, 0, -0.1 * Ri, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.11)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(-0.62 * Ri, 0, 0.52 * Ri, Hi);
      for (b = 0; b < buckets.length; b++) {
        n = buckets[b][0]; c.fillStyle = rgba(buckets[b][3], buckets[b][4]); c.beginPath();
        for (i = 0; i < n; i++) { x = (r() * 2 - 1) * Ri; y = r() * Hi; rad = lerp(buckets[b][1], buckets[b][2], r() * r()); c.moveTo(x + rad, y); c.arc(x, y, rad, 0, TAU); }
        c.fill();
      }
      c.restore();
      return s.cv;
    }
    var GEMS = {
      base: { light: [190, 192, 255], main: COL.indigo, deep: [38, 40, 120], p: ['violet', 'teal', 'indigoL'], bez: ['#F2F3FF', '#9BA1F2', '#2A2D6A', '#9096EA'] },
      warm: { light: [255, 226, 160], main: COL.coral, deep: [150, 44, 62], p: ['amberL', 'coralL', 'amber'], bez: ['#FFF4E6', '#F0AE92', '#5A2A30', '#D69078'] },
      cool: { light: [214, 255, 240], main: COL.teal, deep: [10, 96, 110], p: ['mint', 'tealL', 'indigoL'], bez: ['#F0FFFB', '#86DED2', '#10424E', '#6CC4BC'] },
      iri: { light: [226, 222, 255], main: COL.violet, deep: [52, 44, 150], p: ['teal', 'indigoL', 'coralL'], bez: ['#F6F2FF', '#C0A4FA', '#34287A', '#A898F0'] }
    };
    var FLECK = [[-2, 3, 3.4, 0.5], [7, -2, 3, 0.42], [-8, -1, 2.8, 0.36], [1, 9, 3, 0.4], [-4.5, 9.5, 2.4, 0.34], [9, 5, 2.4, 0.36]];
    function buildGem(def) {
      var s = mk(GS, GS), c = s.c, g, r = 15.5, k;
      c.translate(GS / 2, GS / 2); c.scale(GR / 15.5, GR / 15.5);
      // bezel
      g = c.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, def.bez[0]); g.addColorStop(0.35, def.bez[1]); g.addColorStop(0.6, def.bez[2]); g.addColorStop(1, def.bez[3]);
      c.beginPath(); c.arc(0, 0, r + 1.9, 0, TAU); c.fillStyle = g; c.fill();
      c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
      g = c.createRadialGradient(-4, -6, 1, 0, 0, r * 1.06);
      g.addColorStop(0, rgba(def.light, 1)); g.addColorStop(0.5, rgba(def.main, 1)); g.addColorStop(1, rgba(def.deep, 1));
      c.fillStyle = g; c.fillRect(-r, -r, 2 * r, 2 * r);
      c.globalCompositeOperation = 'screen';
      blobTo(c, def.p[0], 6, 5, 10, 9, 0.6); blobTo(c, def.p[1], -7, 6, 9, 8, 0.5); blobTo(c, def.p[2], 3, -8, 8, 7, 0.42);
      blobTo(c, 'white', 2, 11, 9, 5, 0.2);
      // play of colour: a few small soft flecks, then the light that gathers on the far side of a polished stone
      for (k = 0; k < FLECK.length; k++) blobTo(c, def.p[k % 3], FLECK[k][0], FLECK[k][1], FLECK[k][2], FLECK[k][2] * 0.8, FLECK[k][3]);
      blobTo(c, 'white', 6.5, 8, 7.5, 5.5, 0.2);
      c.globalCompositeOperation = 'source-over';
      c.lineWidth = 2.4; c.strokeStyle = 'rgba(6,8,26,0.34)'; c.beginPath(); c.arc(0, 0, r - 0.7, 0, TAU); c.stroke();
      c.lineCap = 'round'; c.lineWidth = 1.1; c.strokeStyle = rgba(def.light, 0.5); c.beginPath(); c.arc(0, 0, r - 2.6, 0.12 * Math.PI, 0.42 * Math.PI); c.stroke();
      c.save(); c.translate(-5, -7.4); c.rotate(-0.55); blobTo(c, 'white', 0, 0, 7.6, 4.2, 0.5);
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.ellipse(-0.6, -0.5, 3.1, 1.5, 0, 0, TAU); c.fill(); c.restore();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(-9.6, -1.6, 0.8, 0, TAU); c.fill();
      c.restore();
      g = c.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.5, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0.32)');
      c.lineWidth = 0.9; c.strokeStyle = g; c.beginPath(); c.arc(0, 0, r - 0.45, 0, TAU); c.stroke();
      return s.cv;
    }
    function buildStand() {
      var s = mk(STW, STH), c = s.c, cx = G.cx, by = G.baseY, g;
      c.translate(-STX, -STY);
      blobTo(c, 'black', cx, by + 13, 62, 10, 0.66);
      // foot: a flared disc with a short vertical rim (rim top at by + 5, rim bottom at by + 8.5)
      c.beginPath(); c.moveTo(cx - 40, by + 5); c.lineTo(cx - 40, by + 8.5); c.ellipse(cx, by + 8.5, 40, 6.6, 0, Math.PI, 0, true); c.lineTo(cx + 40, by + 5); c.ellipse(cx, by + 5, 40, 6.6, 0, 0, Math.PI, true); c.closePath();
      c.fillStyle = metal(c, cx - 40, cx + 40); c.fill();
      g = c.createLinearGradient(0, by - 4, 0, by + 12); g.addColorStop(0, '#383D8C'); g.addColorStop(0.55, '#A2A8F4'); g.addColorStop(1, '#E4E6FF');
      c.beginPath(); c.ellipse(cx, by + 5, 40, 6.6, 0, 0, TAU); c.fillStyle = g; c.fill();
      c.lineWidth = 0.8; c.strokeStyle = 'rgba(255,255,255,0.62)'; c.beginPath(); c.ellipse(cx, by + 5, 40, 6.6, 0, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke();
      c.strokeStyle = 'rgba(10,13,24,0.4)'; c.beginPath(); c.ellipse(cx, by + 8.5, 40, 6.6, 0, 0.06 * Math.PI, 0.94 * Math.PI); c.stroke();
      // raised boss the column stands on
      c.beginPath(); c.moveTo(cx - 24, by + 0.5); c.lineTo(cx - 24, by + 3); c.ellipse(cx, by + 3, 24, 4, 0, Math.PI, 0, true); c.lineTo(cx + 24, by + 0.5); c.ellipse(cx, by + 0.5, 24, 4, 0, 0, Math.PI, true); c.closePath();
      c.fillStyle = metal(c, cx - 24, cx + 24); c.fill();
      g = c.createLinearGradient(0, by - 4, 0, by + 5); g.addColorStop(0, '#454AA4'); g.addColorStop(1, '#C6CAFB');
      c.beginPath(); c.ellipse(cx, by + 0.5, 24, 4, 0, 0, TAU); c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(cx, by + 0.5, 24, 4, 0, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke();
      // collar
      c.beginPath(); c.ellipse(cx, by - 1, 11.5, 2.6, 0, 0, Math.PI); c.lineTo(cx - 8.5, by - 7); c.lineTo(cx + 8.5, by - 7); c.closePath(); c.fillStyle = metal(c, cx - 11.5, cx + 11.5); c.fill();
      c.beginPath(); c.ellipse(cx, by - 7, 8.5, 2, 0, 0, TAU); c.fillStyle = '#AAB0F6'; c.fill();
      // column, tapered, with a specular run
      c.beginPath(); c.moveTo(cx - 2.5, G.cy + 14); c.lineTo(cx + 2.5, G.cy + 14); c.lineTo(cx + 4.2, by - 7); c.lineTo(cx - 4.2, by - 7); c.closePath();
      c.fillStyle = metal(c, cx - 4.2, cx + 4.2); c.fill();
      c.beginPath(); c.ellipse(cx, G.cy + 21, 5.2, 2.2, 0, 0, TAU); c.fillStyle = metal(c, cx - 5.2, cx + 5.2); c.fill();
      c.beginPath(); c.ellipse(cx, by - 30, 5.4, 2.2, 0, 0, TAU); c.fillStyle = metal(c, cx - 5.4, cx + 5.4); c.fill();
      return s.cv;
    }
    function buildSprites() {
      var i, k;
      qN = 0; qI = 0; qSum = 0; qSkip = QSKIP;   // an art rebuild restarts the frame-step measurement
      for (i = 0; i < 2; i++) { spr.glass[i] = buildGlass(i); spr.tex[i] = buildTex(i); }
      for (k in GEMS) spr.gem[k] = buildGem(GEMS[k]);
      spr.stand = buildStand();
      grad.beam = ctx.createLinearGradient(0, -3, 0, 3);
      grad.beam.addColorStop(0, '#F1F2FF'); grad.beam.addColorStop(0.28, '#A3A9F6'); grad.beam.addColorStop(0.55, '#4D53B4'); grad.beam.addColorStop(0.85, '#1D2058'); grad.beam.addColorStop(1, '#6F76DC');
      // each arm warms or cools toward its own vessel (added on top of the indigo rod)
      grad.beamTint = ctx.createLinearGradient(-G.arm, 0, G.arm, 0);
      grad.beamTint.addColorStop(0, rgba(COL.coral, 0.85)); grad.beamTint.addColorStop(0.32, rgba(COL.coral, 0.2)); grad.beamTint.addColorStop(0.5, rgba(COL.indigoL, 0));
      grad.beamTint.addColorStop(0.68, rgba(COL.teal, 0.2)); grad.beamTint.addColorStop(1, rgba(COL.teal, 0.85));
      grad.ring = [metal(ctx, -G.arm - HRX, -G.arm + HRX, 0), metal(ctx, G.arm - HRX, G.arm + HRX, 1)];
      grad.iri = conic(ctx, 0, 0);
      grad.rim = [conic(ctx, 0, 0, RIMW), conic(ctx, 0, 0, RIMC)];
      for (i = 0; i < 2; i++) { SIDE[i].rampCss = SIDE[i].ramp.map(function (p) { return rgba(p[1], 1); }); SIDE[i].grainCss = SIDE[i].grains.slice(0, 3).map(function (p) { return rgba(p, 0.95); }); SIDE[i].moteCss = rgba(SIDE[i].mid, 0.8); }
    }

    // ----- host callbacks: a callback that throws is reported on the console and never breaks the hero -----
    function fire(name, arg) {
      var fn = options[name];
      if (typeof fn !== 'function') return;
      try { if (arguments.length > 1) fn(arg); else fn(); }
      catch (err) { if (root.console && root.console.error) root.console.error('BalanceHero: ' + name + ' callback threw', err); }
    }

    // ----- state -----
    function weights() { return [st.tracking ? st.scr : 0, st.earn]; }   // whole-number targets (S and E); the sand glides toward them
    function applyState(settle) {
      var w = weights(), d = st.scr - st.earn, ad = Math.abs(d), i, v, bal, left, arrived, both;
      desc = describe(st);
      for (i = 0; i < 2; i++) { v = V[i]; if (w[i] > v.disp + 0.5 && !settle) v.shower = 0.45; v.target = w[i]; }
      bal = 1 - sstep(MODEL.balanceBand, 11, ad);
      moodS.t = st.tracking ? clamp(d / 36, -1, 1) * (1 - bal) : 0;
      dimS.t = st.tracking ? 1 : 0.35;
      if (!(st.tracking && ad <= MODEL.balanceBand)) celebrated = false;
      if (!st.tracking) { drag.t = 0; }
      // the number: real at once whenever it first appears (mount, or tracking coming on), counted between real values after that
      if (st.tracking) {
        left = desc.minutesLeft;
        if (!numLive) { numFrom = numTo = numShown = left; numT0 = -9; numLive = true; }
        else if (left !== numTo) { numFrom = numShown; numTo = left; numT0 = time; }
      } else numLive = false;
      label();
      // an empty scale is already inside the band: a one-sided fill that stays inside it (0/0 to 3/0) is not an arrival,
      // but filling both sides into balance (0/0 to 45/45) is one, with the burst and onBalanced like any other arrival
      both = desc.screenValue > 0 && desc.earnsValue > 0;
      if (desc.kind === 'balanced' && lastKind === 'empty') celebrated = !both;
      arrived = desc.kind === 'balanced' && lastKind !== null && lastKind !== 'balanced' && (lastKind !== 'empty' || both) && (settle || reduce);
      // leaving balance (or the empty state): celebration leftovers go with the reward, within REWARD_OUT
      if ((lastKind === 'balanced' || lastKind === 'empty') && desc.mood !== 'balanced') { quell = REWARD_OUT; quellF = flash; for (i = 0; i < sN; i++) if (sl[i] > REWARD_OUT) sl[i] = REWARD_OUT; }
      if (desc.kind !== lastKind) { if (lastKind !== null) say(desc.status.replace(' \u00B7 ', ', ')); lastKind = desc.kind; }
      textDirty = true;
      if (settle || reduce) settleAll();
      // a settled arrival (reduced motion, or a settle patch) has no celebration frame: onBalanced fires with its settled frame
      if (arrived) balDue = true; else if (desc.kind !== 'balanced') balDue = false;   // left balance before that frame came: no call
    }
    function settleAll() {
      var i, v;
      for (i = 0; i < 2; i++) { v = V[i]; v.disp = v.target; v.load = v.target; v.shower = 0; v.acc = 0; v.flow.snap(0); v.dr.snap(0); v.up.snap(0); v.ang.snap(0); v.sw.snap(0); v.mound.snap(8); v.sel.snap(selected === i ? 1 : 0); }
      gN = 0; sN = 0; opening = false; tilt.snap(st.tracking ? tiltDegFor(V[0].load - V[1].load) * DEG : 0); drag.snap(0); moodS.snap(moodS.t); dimS.snap(dimS.t); theta = tilt.x; omega = 0; flash = 0; ringPulse = 0;
      numFrom = numTo; numShown = numTo; numT0 = -9; capT0 = -9; snapText = true;
      rewS.snap(rewardTarget()); celebrated = rewS.t > 0;
      place(); solve(V[0]); solve(V[1]); textDirty = true;
    }
    function rewardTarget() {
      var d = st.scr - st.earn, w = weights();
      var ok = st.tracking && Math.abs(d) <= MODEL.balanceBand && Math.abs(V[0].disp - V[1].disp) <= MODEL.balanceBand + 0.01 && Math.abs(theta) < 1.5 * DEG;
      return ok ? 0.5 + 0.5 * sstep(2, 22, Math.min(w[0], w[1])) : 0;
    }
    function place() { var i, v; for (i = 0; i < 2; i++) { v = V[i]; v.x = G.cx + v.sgn * G.arm * Math.cos(theta); v.y = G.cy + v.sgn * G.arm * Math.sin(theta); } }

    // ----- simulation -----
    function spawn(side, kind, x, y, vx, vy, life, r, b) {
      if (gN >= MAXG) return; var i = gN++;
      gs[i] = side; gk[i] = kind; gx[i] = x; gy[i] = y; gvx[i] = vx; gvy[i] = vy; gl[i] = life; gr[i] = r; gb[i] = b;
    }
    function solve(v) {
      var A = areaFor(v.disp), slope = Math.tan(v.ang.x), Mh = v.mound.x, dn = 9 * clamp(v.dr.x, 0, 1), j, L, y, top = Hi, j0 = NC, j1 = -1, Au, dip, tu = 0;
      v.area = A; v.fill = fillFrac(v.disp);
      if (A < 0.3) { for (j = 0; j < NC; j++) v.ys[j] = colB[j]; v.j0 = 0; v.j1 = -1; v.top = Hi; }
      else {
        for (j = 0; j < NC; j++) SH[j] = slope * XS[j] - Mh * BUMP[j] + dn * NAR[j] + WAV[j];
        L = solveLevel(colA, colB, SH, A, -50, Hi + 50);
        for (j = 0; j < NC; j++) {
          y = L + SH[j]; if (y < colA[j]) y = colA[j];
          if (y < colB[j] - 0.15) { if (j < j0) j0 = j; j1 = j; if (y < top) top = y; } else y = colB[j];
          v.ys[j] = y;
        }
        v.j0 = j0; v.j1 = j1; v.top = top;
      }
      Au = Math.min(v.up.x, areaFor(v.target) - A); v.areaUp = Au;
      if (Au < 0.3) { for (j = 0; j < NC; j++) v.yu[j] = botU[j]; v.u0 = 0; v.u1 = -1; v.topUp = 0; }
      else {
        dip = 2 + 6 * v.flow.x;
        for (j = 0; j < NC; j++) SH[j] = dip * BUMP[j] - 0.5 * slope * XS[j] + WAV[NC - 1 - j] * 0.6;
        L = solveLevel(topU, botU, SH, Au, -Hi - 50, 50); j0 = NC; j1 = -1;
        for (j = 0; j < NC; j++) {
          y = L + SH[j]; if (y < topU[j]) y = topU[j];
          if (y < botU[j] - 0.15) { if (j < j0) j0 = j; j1 = j; if (y < tu) tu = y; } else y = botU[j];
          v.yu[j] = y;
        }
        v.u0 = j0; v.u1 = j1; v.topUp = tu;
      }
    }
    function stepVessel(v, dt) {
      var tgt = v.target, ft = fillFrac(tgt), fd = fillFrac(v.disp), pend = ft - fd, n, i, j, x;
      v.pouring = false; v.draining = false;
      // the pile moves in level space, so a pour looks the same at 20 minutes and at 200
      if (pend > 2e-4) { fd += (pend / 1.15 + 0.045) * dt; v.disp = fd >= ft ? tgt : minOfFill(fd); v.pouring = v.disp < tgt; }
      else if (pend < -2e-4) { fd += (pend / 0.5 - 0.055) * dt; v.disp = fd <= ft ? tgt : minOfFill(fd); v.draining = v.disp > tgt; }
      else v.disp = tgt;
      // minutes on board (both bulbs): what the beam weighs. New sand lands in the upper bulb first; drained sand leaves as it falls out.
      if (tgt > v.load) { v.load += (tgt - v.load) * (1 - Math.exp(-dt / 0.2)); if (tgt - v.load < 0.05) v.load = tgt; }
      else if (tgt < v.load) v.load = Math.max(tgt, Math.min(v.load, v.disp));
      v.flow.t = v.pouring ? 1 : 0; v.flow.step(dt);
      v.dr.t = v.draining ? 1 : 0; v.dr.step(dt);
      v.up.t = v.pouring ? areaFor(tgt) - areaFor(v.disp) + 2 : 0; v.up.step(dt);
      v.mound.t = v.pouring ? 13 : 8; v.mound.step(dt);
      v.ang.t = clamp(-omega * 0.10, -0.25, 0.25); v.ang.step(dt);
      v.sw.t = clamp(omega * 0.045, -0.085, 0.085); v.sw.step(dt);
      v.sel.t = selected === v.side ? 1 : 0; v.sel.step(dt);
      solve(v);
      if (v.pouring) {
        v.acc += 150 * dt; n = v.acc | 0; v.acc -= n;
        for (i = 0; i < n; i++) spawn(v.side, 0, (rnd() - 0.5) * 2 * (wNi - 0.9), 1 + rnd() * 4, (rnd() - 0.5) * 9, 60 + rnd() * 60, 1.4, 0.36 + rnd() * 0.36, (rnd() * 3) | 0);
        if (v.shower > 0) {
          v.shower -= dt; n = (230 * dt + rnd()) | 0;
          for (i = 0; i < n; i++) spawn(v.side, 2, (rnd() - 0.5) * 2 * (bwi - 4), -Hi + 2 + rnd() * 5, (rnd() - 0.5) * 26, 20 + rnd() * 70, 1.4, 0.5 + rnd() * 0.5, (rnd() * 3) | 0);
        }
      } else if (v.draining && v.j1 >= v.j0) {
        // draining: grains slide down the funnel surface toward the middle and fade there, inside the glass (the base is sealed)
        v.acc += 110 * dt; n = v.acc | 0; v.acc -= n;
        for (i = 0; i < n; i++) {
          if (i & 1) { j = v.j0 + ((rnd() * (v.j1 - v.j0 + 1)) | 0); x = XS[j]; if (Math.abs(x) > 3) spawn(v.side, 4, x, v.ys[j] - 0.6, (x > 0 ? -1 : 1) * (26 + rnd() * 44), 0, 0.5 + rnd() * 0.4, 0.45 + rnd() * 0.4, (rnd() * 3) | 0); }
        }
      }
      if (Math.abs(omega) > 0.5 && v.j1 >= v.j0 && rnd() < 0.5) { j = v.j0 + ((rnd() * (v.j1 - v.j0 + 1)) | 0); spawn(v.side, 1, XS[j], v.ys[j] - 0.6, (rnd() - 0.5) * 60, -(20 + rnd() * 50), 0.3 + rnd() * 0.3, 0.5 + rnd() * 0.4, (rnd() * 3) | 0); }
    }
    function stepGrains(dt) {
      var i, v, k, w, ysf, dead;
      for (i = gN - 1; i >= 0; i--) {
        v = V[gs[i]]; k = gk[i]; gl[i] -= dt; dead = gl[i] <= 0;
        if (!dead) {
          if (k === 4) {   // sliding down the drain funnel: rides the surface toward the middle and fades out there
            gx[i] += gvx[i] * dt; gy[i] = surfAt(v.ys, gx[i]) - 0.5;
            if (Math.abs(gx[i]) < 10 && gl[i] > 0.15) gl[i] = 0.15;   // near the middle: the last 0.15 s, shrinking to nothing
            if (gx[i] * gvx[i] > 0 || v.j1 < v.j0) dead = true;
          } else {
          gvy[i] += 720 * dt; gx[i] += gvx[i] * dt; gy[i] += gvy[i] * dt;
          w = wAt(profI, gy[i]) - 0.9;
          if (gx[i] > w) { gx[i] = w; gvx[i] *= -0.3; } else if (gx[i] < -w) { gx[i] = -w; gvx[i] *= -0.3; }
          }
          if (k > 2) { /* drain grains are handled above */ }
          else if (k < 2) {
            if (gvy[i] > 0 && gy[i] > 2) {
              ysf = surfAt(v.ys, gx[i]);
              if (gy[i] >= ysf - 0.5) {
                if (k === 0 && rnd() < 0.42) { gk[i] = 1; gy[i] = ysf - 0.6; gvy[i] = -(36 + rnd() * 80); gvx[i] = (rnd() - 0.5) * 110; gl[i] = 0.22 + rnd() * 0.3; }
                else dead = true;
              }
            }
          } else if (gy[i] >= surfAt(v.yu, gx[i]) - 0.5 || gy[i] > -1) dead = true;
        }
        if (dead) { gN--; if (i !== gN) { gx[i] = gx[gN]; gy[i] = gy[gN]; gvx[i] = gvx[gN]; gvy[i] = gvy[gN]; gl[i] = gl[gN]; gr[i] = gr[gN]; gk[i] = gk[gN]; gs[i] = gs[gN]; gb[i] = gb[gN]; } }
      }
      for (i = sN - 1; i >= 0; i--) {
        sl[i] -= dt; svx[i] *= 1 - 2.2 * dt; svy[i] = svy[i] * (1 - 2.2 * dt) + 26 * dt; sx[i] += svx[i] * dt; sy[i] += svy[i] * dt;
        if (sl[i] <= 0) { sN--; if (i !== sN) { sx[i] = sx[sN]; sy[i] = sy[sN]; svx[i] = svx[sN]; svy[i] = svy[sN]; sl[i] = sl[sN]; } }
      }
      if (gN + sN > peakG) peakG = gN + sN;
    }
    function burst(n, power) {
      var i, a, sp;
      for (i = 0; i < n && sN < MAXS; i++) { a = rnd() * TAU; sp = (60 + rnd() * 120) * power; sx[sN] = G.cx + Math.cos(a) * 16; sy[sN] = G.cy + Math.sin(a) * 16; svx[sN] = Math.cos(a) * sp; svy[sN] = Math.sin(a) * sp; sl[sN] = 0.6 + rnd() * 0.7; sN++; }
    }
    function update(dt) {
      var th0 = theta, rt, e, shownNum, pendDone;
      time += dt;
      tilt.step(dt); drag.step(dt);
      theta = clamp(tilt.x + drag.x, -20 * DEG, 20 * DEG);
      omega = lerp(omega, (theta - th0) / dt, 0.5);
      moodS.step(dt); dimS.step(dt);
      par.x += (par.tx - par.x) * Math.min(1, dt * 5); par.y += (par.ty - par.y) * Math.min(1, dt * 5);
      place(); stepVessel(V[0], dt); stepVessel(V[1], dt); stepGrains(dt);
      tilt.t = st.tracking ? tiltDegFor(V[0].load - V[1].load) * DEG : 0;
      rt = rewardTarget(); rewS.t = rt;
      // once the state is not balanced the reward leaves in a straight line, gone within REWARD_OUT (the capsule must never contradict it for longer)
      if (desc.mood !== 'balanced') { rewS.x = Math.max(0, rewS.x - dt / REWARD_OUT); rewS.v = 0; }
      else rewS.step(dt);
      pendDone = !V[0].pouring && !V[1].pouring && !V[0].draining && !V[1].draining;
      if (rt > 0 && pendDone && !celebrated) { celebrated = true; if (desc.kind === 'balanced' && !opening) { flash = 1; ringPulse = 1; burst(26, 1); balDue = true; } }
      if (pendDone) opening = false;
      flash *= Math.exp(-dt * 2.6); ringPulse *= Math.exp(-dt * 1.6);
      if (desc.mood !== 'balanced') ringPulse = Math.max(0, ringPulse - dt / REWARD_OUT);
      if (quell > 0) { quell = Math.max(0, quell - dt); flash = Math.min(flash, quellF * quell / REWARD_OUT); }
      e = clamp((time - numT0) / 0.5, 0, 1); e = 1 - Math.pow(1 - e, 3);
      shownNum = Math.round(lerp(numFrom, numTo, e));
      if (shownNum !== numShown) { numShown = shownNum; textDirty = true; }
    }

    // ----- soft layer: every glow lives here, at half a pixel per point -----
    function sb(key, x, y, rx, ry, a) {
      if (a < 0.004) return;
      sctx.globalAlpha = a > 1 ? 1 : a; sctx.drawImage(blobSprite(key), x - rx, y - ry, 2 * rx, 2 * ry);
    }
    function sbr(key, x, y, rx, ry, rot, a) {   // the same blob, turned: a ribbon of light
      if (a < 0.004) return;
      sctx.save(); sctx.translate(x, y); sctx.rotate(rot); sctx.globalAlpha = a > 1 ? 1 : a; sctx.drawImage(blobSprite(key), -rx, -ry, 2 * rx, 2 * ry); sctx.restore();
    }
    function drawSoft() {
      var c = sctx, m = moodS.x, warm = clamp(m, 0, 1), cool = clamp(-m, 0, 1), rw = clamp(rewS.x, 0, 1.15), t = time, px = par.x, py = par.y;
      var i, v, f, heavy, other, s, a1, lean = Math.max(warm, cool), by = G.baseY + 8, rq = Math.min(1, rw);
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, soft.width, soft.height);
      c.setTransform(S * SQ, 0, 0, S * SQ, OX * SQ, OY * SQ); c.globalCompositeOperation = 'lighter';
      if (reduceT) { sb('indigo', 195, 150, 200, 172, 0.16); c.globalAlpha = 1; return; }   // Reduce Transparency: one indigo pool, nothing else
      // ambient pool and floor
      sb('indigo', 195 + 16 * Math.sin(t * 0.13) - px * 8, 150 + 10 * Math.cos(t * 0.11) - py * 6, 205, 176, 0.3 * (1 - 0.45 * lean));
      sb('indigo', 195, by, 132, 28, 0.4 * (1 - 0.5 * lean));
      // aurora: three slow ribbons, coral on the screen side, violet across the top, teal on the movement side
      sbr('violet', 195 + 12 * Math.cos(t * 0.09) - px * 12, 46 + 6 * Math.sin(t * 0.12) - py * 8, 168, 54, -0.1 + 0.05 * Math.sin(t * 0.07), 0.32 * (1 - 0.7 * lean) + 0.14 * rw);
      sbr('coral', 58 + 8 * Math.sin(t * 0.1) - px * 10, 132 + 8 * Math.cos(t * 0.08) - py * 6, 62, 168, 0.3 + 0.06 * Math.sin(t * 0.075), (0.28 + 0.14 * warm) * (1 - 0.6 * cool));
      sbr('teal', 332 - 8 * Math.sin(t * 0.1) - px * 10, 132 + 8 * Math.sin(t * 0.085) - py * 6, 62, 168, -0.3 - 0.06 * Math.sin(t * 0.08), (0.26 + 0.14 * cool) * (1 - 0.6 * warm));
      sbr('amber', 96 - px * 6, 250, 96, 40, -0.16, (0.07 + 0.1 * warm) * (1 - 0.8 * cool));
      sbr('mint', 294 - px * 6, 250, 96, 40, 0.16, (0.07 + 0.1 * cool) * (1 - 0.8 * warm));
      // mood wash
      if (warm > 0.01) { sb('coral', 150 - px * 6, 176 - py * 4, 200, 154, 0.24 * warm); sb('amber', 116, 238, 128, 88, 0.13 * warm); sb('coral', 195, by, 122, 26, 0.26 * warm); }
      if (cool > 0.01) { sb('teal', 240 - px * 6, 176 - py * 4, 200, 154, 0.24 * cool); sb('mint', 274, 238, 128, 88, 0.13 * cool); sb('teal', 195, by, 122, 26, 0.26 * cool); }
      // wings: each vessel carries its own light, warm on the left, cool on the right
      for (i = 0; i < 2; i++) {
        v = V[i]; f = v.fill; heavy = i ? cool : warm; other = i ? warm : cool; s = clamp(v.sel.x, 0, 1.2);
        a1 = (0.34 + 0.3 * f + 0.22 * heavy + 0.2 * s) * (1 - 0.32 * other) * (1 - (i ? 0.08 : 0.3) * rq);
        sb(v.pal.glow, v.x - px * 5, v.y + 14 - py * 4, 108, 146, a1);
        sb(v.pal.glow2, v.x, v.y + Hi - 12 - 34 * f, 68, 58, (0.12 + 0.38 * Math.pow(f, 0.6) + 0.1 * heavy + 0.14 * s) * (1 - 0.3 * other));
        sb(v.pal.glow, v.x, by + 1, 56, 10, (0.14 + 0.3 * f + 0.1 * heavy) * (1 - 0.4 * other));
        sb(v.pal.glow2, v.x + px * 3, v.y - 0.56 * Hi - py * 2, 56, 54, (0.2 + 0.12 * f + 0.07 * heavy + 0.18 * clamp(v.flow.x, 0, 1) + 0.1 * s) * (1 - 0.4 * other));
      }
      // balanced reward: violet bloom, soft rays, soft iridescent ring
      if (rw > 0.01) {
        sb('violet', 195, G.cy, 150, 138, 0.26 * rw); sb('teal', 195, G.cy + 92, 104, 56, 0.09 * rw);
        c.save(); c.translate(G.cx, G.cy);
        c.rotate(t * 0.05); c.globalAlpha = Math.min(1, 0.5 * rw); c.drawImage(raysSprite(), -150, -150, 300, 300);
        c.rotate(-t * 0.09); c.globalAlpha = Math.min(1, 0.36 * rw); c.drawImage(raysSprite(), -104, -104, 208, 208);
        c.rotate(t * 0.34); c.globalAlpha = Math.min(1, 0.9 * rw); c.drawImage(ringSprite(), -64, -64, 128, 128);
        c.restore();
      }
      if (ringPulse > 0.02) { s = 64 * (1 + 1.25 * (1 - ringPulse)); c.globalAlpha = 0.7 * ringPulse; c.drawImage(ringSprite(), G.cx - s, G.cy - s, 2 * s, 2 * s); }
      // jewel bloom
      sb('indigoL', G.cx, G.cy, 76, 76, 0.5 * (1 - lean) + 0.2 * flash); sb('violet', G.cx, G.cy, 46, 46, 0.22 * (1 - lean));
      if (warm > 0.01) { sb('coral', G.cx, G.cy, 76, 76, 0.5 * warm); sb('amber', G.cx, G.cy - 3, 42, 42, 0.24 * warm); }
      if (cool > 0.01) { sb('teal', G.cx, G.cy, 76, 76, 0.5 * cool); sb('mint', G.cx, G.cy - 3, 42, 42, 0.24 * cool); }
      c.globalAlpha = 1;
    }
    // dust: a few fine points of light in the air and inside the upper bulbs (radius twinkles, never alpha)
    function drawDust(c) {
      var t = time, px = par.x, py = par.y, k, i, b, r, n;
      for (k = 0; k < 3; k++) {
        c.beginPath(); n = 0;
        for (i = 0; i < dust.length; i++) {
          b = dust[i]; if (b.k !== k) continue;
          r = b.r * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * b.sp + b.ph))); if (r < 0.3) continue;
          star4(c, b.x + 5 * Math.sin(t * 0.07 + b.ph) - px * b.d, b.y + 4 * Math.cos(t * 0.06 + b.ph) - py * b.d * 0.6, r); n++;
        }
        if (n) { c.fillStyle = DUSTCOL[k]; c.fill(); }
      }
    }
    function drawMotes(c, v) {   // drawn in vessel space
      var t = time, i, mo, r, x, y, n = 0;
      c.beginPath();
      for (i = 0; i < v.motes.length; i++) {
        mo = v.motes[i]; r = mo.r * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * mo.tw + mo.ph)));
        x = mo.ax * Math.sin(t * mo.sp + mo.ph); y = mo.y + 3.5 * Math.cos(t * mo.sp * 0.8 + mo.ph * 1.7);
        c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); n++;
      }
      if (n) { c.globalCompositeOperation = 'lighter'; c.fillStyle = v.pal.moteCss; c.fill(); c.globalCompositeOperation = 'source-over'; }
    }

    // ----- sand paths -----
    function surfPath(c, ys, j0, j1) {   // the heaped surface, wall to wall
      var j, y0 = ys[j0], y1 = ys[j1];
      c.moveTo(-wAt(profI, y0), y0); c.lineTo(XS[j0], y0);
      for (j = j0 + 1; j < j1; j++) c.quadraticCurveTo(XS[j], ys[j], (XS[j] + XS[j + 1]) / 2, (ys[j] + ys[j + 1]) / 2);
      if (j1 > j0) c.lineTo(XS[j1], y1);
      c.lineTo(wAt(profI, y1), y1);
    }
    function sandPath(c, ys, j0, j1, yEnd) {   // surface, then down the inner glass to yEnd and back up the other wall
      var y0 = ys[j0], y1 = ys[j1], n, k, y;
      c.beginPath(); surfPath(c, ys, j0, j1);
      n = Math.max(1, Math.ceil(Math.abs(yEnd - y1) / 3));
      for (k = 1; k <= n; k++) { y = y1 + (yEnd - y1) * k / n; c.lineTo(wAt(profI, y), y); }
      n = Math.max(1, Math.ceil(Math.abs(yEnd - y0) / 3));
      for (k = n; k >= 1; k--) { y = y0 + (yEnd - y0) * k / n; c.lineTo(-wAt(profI, y), y); }
      c.closePath();
    }
    function addRamp(g, pal) { var i; for (i = 0; i < pal.ramp.length; i++) g.addColorStop(pal.ramp[i][0], pal.rampCss[i]); return g; }
    var GL = [[-0.74 * Ri, -0.60 * Hi], [-0.70 * Ri, 0.52 * Hi], [0.52 * Ri, -0.74 * Hi]];

    function drawVessel(c, v) {
      var i = v.side, pal = v.pal, sel = v.sel.x, rw = clamp(rewS.x, 0, 1), has = v.j1 >= v.j0, j, x, y, p, r, n, b, g, t, hw, gy0, ox, s;
      c.save(); c.translate(v.x, v.y);
      if (v.sw.x) c.rotate(v.sw.x);
      if (sel > 0.002) { s = 1 + 0.035 * sel; c.scale(s, s); }
      c.globalAlpha = 1; c.drawImage(spr.glass[i].back, -VW / 2, -VH / 2, VW, VH);
      drawMotes(c, v);
      // sand waiting in the upper bulb (only while a pour is under way)
      if (v.u1 >= v.u0) {
        c.save(); sandPath(c, v.yu, v.u0, v.u1, 0); c.clip();
        g = addRamp(c.createLinearGradient(0, v.topUp, 0, Math.max(v.topUp + 30, 0)), pal);
        c.fillStyle = g; c.fillRect(-Ri, -Hi, 2 * Ri, Hi);
        c.scale(1, -1); c.drawImage(spr.tex[i], -TW / 2, -1, TW, TH);
        c.restore();
        c.beginPath(); surfPath(c, v.yu, v.u0, v.u1); c.lineWidth = 1; c.strokeStyle = rgba(pal.hi, 0.75); c.stroke();
      }
      // the falling stream
      if (v.flow.x > 0.03) {
        p = clamp(v.flow.x, 0, 1); y = has ? surfAt(v.ys, 0) : Hi - 1;
        c.beginPath(); c.moveTo(0, -1); c.lineTo(0, y);
        c.globalCompositeOperation = 'lighter'; c.lineWidth = 5 * p; c.strokeStyle = rgba(pal.mid, 0.22); c.stroke(); c.lineWidth = 2.6 * p; c.strokeStyle = rgba(pal.mid, 0.3); c.stroke();
        c.globalCompositeOperation = 'source-over'; c.lineWidth = 1.5 * p; c.strokeStyle = rgba(pal.hi, 0.95); c.stroke();
      }
      // the settled pile: one clipped shape, a surface-relative ramp, then the cached grain texture
      if (has) {
        c.save(); sandPath(c, v.ys, v.j0, v.j1, Hi); c.clip();
        if (!v.g || Math.abs(v.gTop - v.top) > 0.15) { v.gTop = v.top; v.g = addRamp(c.createLinearGradient(0, v.top, 0, v.top + Math.max(Hi - v.top, 34)), pal); }
        c.fillStyle = v.g; c.fillRect(-Ri, v.top - 1, 2 * Ri, Hi - v.top + 2);
        c.drawImage(spr.tex[i], -TW / 2, -1, TW, TH);
        c.restore();
        c.beginPath(); surfPath(c, v.ys, v.j0, v.j1);
        c.globalCompositeOperation = 'lighter'; c.lineWidth = 7; c.strokeStyle = rgba(pal.mid, 0.16); c.stroke(); c.lineWidth = 3; c.strokeStyle = rgba(pal.mid, 0.24); c.stroke();
        c.globalCompositeOperation = 'source-over'; c.lineWidth = 0.9; c.strokeStyle = rgba(pal.hi, 0.9); c.stroke();
        // grain shimmer
        c.beginPath(); n = 0;
        for (j = 0; j < v.tw.length; j++) {
          t = v.tw[j]; p = Math.sin(time * t.sp + t.ph); if (p <= 0.3) continue; p = Math.pow((p - 0.3) / 0.7, 3);
          x = lerp(XS[v.j0], XS[v.j1], 0.12 + 0.76 * t.f); y = surfAt(v.ys, x) + t.d; if (y > surfAt(colB, x) - 1.5) continue;
          star4(c, x, y, 0.8 + 2.3 * p); n++;
        }
        if (n) { c.fillStyle = 'rgba(255,255,255,0.92)'; c.fill(); }
      }
      // goal marker on the movement vessel
      if (i === 1 && desc.goalFill != null) {
        gy0 = Hi - HFILL * desc.goalFill; hw = wAt(profI, gy0) - 1.2; g = desc.goalMet ? 'rgba(240,255,249,0.98)' : rgba(COL.amberL, 0.96);
        c.beginPath(); c.moveTo(-hw, gy0); c.lineTo(hw, gy0); c.setLineDash([3.2, 3]); c.lineCap = 'butt';
        c.lineWidth = 2.8; c.strokeStyle = 'rgba(4,24,34,0.4)'; c.stroke();
        c.lineWidth = 1.25; c.strokeStyle = g; c.stroke(); c.setLineDash([]); c.lineCap = 'round';
        ox = hw + G.wall + 4.2;
        c.beginPath(); c.moveTo(ox, gy0); c.lineTo(ox + 5.8, gy0 - 3.6); c.lineTo(ox + 5.8, gy0 + 3.6); c.closePath(); c.fillStyle = desc.goalMet ? rgba(COL.mintL, 1) : rgba(COL.amberL, 1); c.fill();
      }
      // live grains, three colour buckets
      if (gN) for (b = 0; b < 3; b++) {
        c.beginPath(); n = 0;
        for (j = 0; j < gN; j++) {
          if (gs[j] !== i || gb[j] !== b) continue;
          r = gr[j] * (gl[j] < 0.15 ? gl[j] / 0.15 : 1); if (r < 0.12) continue;
          c.moveTo(gx[j] + r, gy[j]); c.arc(gx[j], gy[j], r, 0, TAU); n++;
        }
        if (n) { c.fillStyle = pal.grainCss[b]; c.fill(); }
      }
      c.drawImage(spr.glass[i].front, -VW / 2, -VH / 2, VW, VH);
      // live rim light
      if (sel > 0.01) {
        c.beginPath(); pathVessel(c, G.R, G.H2, G.wN, G.bw);
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = clamp(sel, 0, 1);
        c.lineWidth = 6; c.strokeStyle = rgba(pal.acc, 0.17); c.stroke(); c.lineWidth = 1.5; c.strokeStyle = rgba(pal.hi, 0.72); c.stroke();
        c.globalCompositeOperation = 'source-over';
      }
      if (rw > 0.01) {
        c.beginPath(); pathVessel(c, G.R, G.H2, G.wN, G.bw);
        c.save(); c.rotate(time * 0.35 + i * 2.1); c.globalAlpha = 0.34 * rw; c.lineWidth = 1.2; c.strokeStyle = grad.rim[i]; c.stroke(); c.restore();
      }
      p = (time - v.glintT0) / 0.8;
      if (p > 0 && p < 1) { s = Math.sin(Math.PI * p); c.beginPath(); star4(c, GL[v.glintSpot][0], GL[v.glintSpot][1], 1 + 5.5 * s); c.globalAlpha = 0.9 * s; c.fillStyle = '#fff'; c.fill(); }
      c.restore();
    }

    // ----- text: the label row is rendered to a sprite only when a string changes -----
    var textDirty = true, snapText = false, TY0 = 320, TY1 = 397;
    var T = { cv: null, c: null, x0: 0, y0: 0, ink: 0 };
    var CAP_GAP = 8, capY = ROW.capY, NUM_TIGHT = 8, NUM_FLOOR = 12;   // css px: the lowest label line keeps at least CAP_GAP above the capsule border (any width, 320 up)
    function inkBelow(c, segs) {        // how far the ink of one label line reaches below its baseline (design px)
      var i, m, b = 0;
      for (i = 0; i < segs.length; i++) { c.font = segs[i].f; m = c.measureText(segs[i].s); b = Math.max(b, m.actualBoundingBoxDescent != null ? m.actualBoundingBoxDescent : 0.25 * parseFloat(segs[i].f.split(' ')[1])); }
      return b;
    }
    var capsule = { parts: [], w: 160, cw: 100, icon: 'dot', col: COL.text, f: '', grad: null };
    function fz(px) { return Math.max(px, 11 / S); }
    function fnt(wt, px) { return wt + ' ' + (Math.round(px * 100) / 100) + 'px ' + FAMILY; }
    function tcol(a) { return rgba(COL.text, a); }
    function measure(c, segs, gap) {
      var w = 0, i, j, s;
      for (i = 0; i < segs.length; i++) {
        s = segs[i]; c.font = s.f;
        if (s.tr) { s.w = 0; for (j = 0; j < s.s.length; j++) s.w += c.measureText(s.s[j]).width + (j < s.s.length - 1 ? s.tr : 0); }
        else s.w = c.measureText(s.s).width;
        w += s.w + (s.pre || 0);
      }
      segs.w = w + gap * (segs.length - 1); return segs.w;
    }
    function drawSegs(c, segs, cx, y, gap) {
      var x = cx - segs.w / 2, i, j, s;
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      for (i = 0; i < segs.length; i++) {
        s = segs[i]; c.font = s.f; x += s.pre || 0;
        if (s.dot) { c.fillStyle = s.dot; c.beginPath(); c.arc(x - s.pre + 3, y - 4.1, 2.6, 0, TAU); c.fill(); }
        if (s.check) { c.strokeStyle = s.col; c.lineWidth = 1.7; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - s.pre + 1, y - 3.6); c.lineTo(x - s.pre + 4, y - 0.8); c.lineTo(x - s.pre + 9, y - 7); c.stroke(); }
        c.fillStyle = s.col;
        if (s.tr) { for (j = 0; j < s.s.length; j++) { c.fillText(s.s[j], x, y); x += c.measureText(s.s[j]).width + s.tr; } x -= s.tr; }
        else { c.fillText(s.s, x, y); x += s.w; }
        x += gap;
      }
    }
    function layoutText() {
      var c = T.c, d = desc, selL = selected === 0, selR = selected === 1, need = 16 / S, i, w;
      var small = fnt(500, fz(12)), big = fnt(700, 19), sub = fnt(500, fz(11)), ttl = fnt(600, fz(12.5));
      var L = { title: [{ s: d.screenTitle, f: ttl, col: selL ? rgba(COL.coralL, 1) : tcol(d.tracking ? 0.72 : 0.56), tr: 0.15, pre: 9, dot: rgba(COL.coral, d.tracking ? 1 : 0.5) }], val: [], subs: [] };
      var R = { title: [{ s: d.moveTitle, f: ttl, col: selR ? rgba(COL.tealL, 1) : tcol(0.72), tr: 0.15, pre: 9, dot: rgba(COL.teal, 1) }], val: [], subs: [] };
      if (!d.tracking) L.val.push({ s: d.screenLabel, f: fnt(600, 15), col: tcol(0.62) });
      else if (d.screenValue === 0) L.val.push({ s: d.screenLabel, f: fnt(600, 17), col: tcol(0.92) });
      else L.val.push({ s: 'about', f: small, col: tcol(0.62) }, { s: String(d.screenValue), f: big, col: tcol(1) }, { s: 'min', f: small, col: tcol(0.76) });
      if (d.tracking) L.subs.push([{ s: d.screenSub, f: sub, col: tcol(0.6) }]);
      R.val.push({ s: String(d.moveValue), f: big, col: tcol(1) }, { s: 'min', f: small, col: tcol(0.76) });
      if (d.earnsLabel) R.subs.push([{ s: d.earnsLabel, f: sub, col: rgba(COL.tealL, 0.9) }]);
      if (d.goalLabel) R.subs.push([d.goalMet ? { s: d.goalLabel, f: sub, col: rgba(COL.mint, 1), pre: 12, check: true } : { s: d.goalLabel, f: sub, col: tcol(0.6) }]);
      var wL = Math.max(measure(c, L.title, 0), measure(c, L.val, 4)), wR = Math.max(measure(c, R.title, 0), measure(c, R.val, 4));
      for (i = 0; i < L.subs.length; i++) wL = Math.max(wL, measure(c, L.subs[i], 0));
      for (i = 0; i < R.subs.length; i++) wR = Math.max(wR, measure(c, R.subs[i], 0));
      // the big number: shrink in 2 px steps until both gaps to the side columns are 16 css px or more
      var target = String(numTo), shown = String(numShown), nf = 48, nw, xL = ROW.xL, xR = ROW.xR, gapL, gapR, x, adv = [], nfS, room;
      function numW(str, size) { var k, s2 = 0; c.font = fnt(800, size); for (k = 0; k < str.length; k++) s2 += c.measureText(str[k]).width - size / 48; return s2 + size / 48; }
      for (;;) {
        nw = d.tracking ? numW(target, nf) : 42;
        gapL = (G.cx - nw / 2) - (xL + wL / 2); gapR = (xR - wR / 2) - (G.cx + nw / 2);
        if ((gapL >= need && gapR >= need) || nf <= 32 || !d.tracking) break;
        nf -= 2;
      }
      if (gapL < need) xL = Math.max(wL / 2 + 5, xL - (need - gapL));
      if (gapR < need) xR = Math.min(G.W - wR / 2 - 5, xR + (need - gapR));
      // up to five digits (the ceiling) beside a wide column: once the columns are against the edges and a gap is still under
      // NUM_TIGHT css px, the number keeps shrinking below 32, 2 at a time, down to NUM_FLOOR (it never touches a column)
      while (d.tracking && nf > NUM_FLOOR && Math.min((G.cx - nw / 2) - (xL + wL / 2), (xR - wR / 2) - (G.cx + nw / 2)) < NUM_TIGHT / S) { nf -= 2; nw = numW(target, nf); }
      T.gapL = (G.cx - nw / 2) - (xL + wL / 2); T.gapR = (xR - wR / 2) - (G.cx + nw / 2); T.numFont = nf; T.xL = xL; T.xR = xR;
      // paint
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, T.cv.width, T.cv.height);
      c.setTransform(K, 0, 0, K, OX * dpr - T.x0, OY * dpr - T.y0);
      drawSegs(c, L.title, xL, ROW.title, 0); drawSegs(c, L.val, xL, ROW.val, 4);
      for (i = 0; i < L.subs.length; i++) drawSegs(c, L.subs[i], xL, i ? ROW.sub2 : ROW.sub1, 0);
      drawSegs(c, R.title, xR, ROW.title, 0); drawSegs(c, R.val, xR, ROW.val, 4);
      for (i = 0; i < R.subs.length; i++) drawSegs(c, R.subs[i], xR, i ? ROW.sub2 : ROW.sub1, 0);
      if (d.tracking) {
        // while the number counts toward a narrower value, an in-between value too wide for the gap is drawn smaller (the largest
        // size in 2 steps from nf, down to NUM_FLOOR, that keeps NUM_TIGHT css px from the columns) instead of over the side columns;
        // the settled number and every value that fits are drawn as before. The width grows in proportion to the size, so the size
        // is computed and measured once (and stepped down only if it still does not fit), which keeps the counting frames cheap.
        nfS = nf; w = numW(shown, nf);
        if (shown !== target && w > nw) {
          room = Math.max(nw, 2 * (Math.min(G.cx - (xL + wL / 2), (xR - wR / 2) - G.cx) - NUM_TIGHT / S));
          if (w > room) { nfS = Math.max(NUM_FLOOR, nf - 2 * Math.ceil((nf - nf * room / w) / 2 - 1e-9)); w = numW(shown, nfS); }
          while (w > room && nfS > NUM_FLOOR) { nfS -= 2; w = numW(shown, nfS); }
        }
        x = G.cx - w / 2; c.font = fnt(800, nfS); c.fillStyle = numTo === 0 ? rgba(COL.coralL, 1) : tcol(1);
        for (i = 0; i < shown.length; i++) { c.fillText(shown[i], x, ROW.num); x += c.measureText(shown[i]).width - nfS / 48; }
      } else {
        c.fillStyle = tcol(0.5); c.beginPath(); rr(c, G.cx - 21, ROW.num - 20, 17, 5.4, 2.7); rr(c, G.cx + 4, ROW.num - 20, 17, 5.4, 2.7); c.fill();
      }
      var unit = [{ s: d.unitLabel, f: fnt(600, fz(13)), col: tcol(d.tracking ? 0.72 : 0.56), tr: 0.2 }]; measure(c, unit, 0); drawSegs(c, unit, G.cx, ROW.unit, 0);
      // the capsule sits below the lowest ink of the label row with a CAP_GAP css px gap (it moves down only for the four-line right column)
      T.ink = ROW.unit + inkBelow(c, unit);
      for (i = 0; i < L.subs.length; i++) T.ink = Math.max(T.ink, (i ? ROW.sub2 : ROW.sub1) + inkBelow(c, L.subs[i]));
      for (i = 0; i < R.subs.length; i++) T.ink = Math.max(T.ink, (i ? ROW.sub2 : ROW.sub1) + inkBelow(c, R.subs[i]));
      capY = clamp(Math.ceil((T.ink + CAP_GAP / S + 0.5) * 100) / 100, ROW.capY, G.H - ROW.capH);
      // status capsule content
      var f = fnt(600, fz(12.5)), parts = [], icon = 'dot', col, k, key, tw2 = 0;
      if (selL) { parts.push({ s: d.screenDetail, col: tcol(0.94) }); col = COL.coral; }
      else if (selR) { parts.push({ s: d.moveDetail, col: tcol(0.94) }); col = COL.teal; }
      else if (!d.tracking) { parts.push({ s: d.status, col: tcol(0.96) }); col = COL.amber; }
      else if (d.mood === 'balanced') { k = d.status.indexOf(' '); parts.push({ s: d.status.slice(0, k), grad: true }, { s: d.status.slice(k), col: tcol(0.74) }); icon = 'star'; col = COL.violetL; }
      else { parts.push({ s: d.status, col: tcol(0.96) }); col = d.mood === 'scroll' ? COL.coral : COL.teal; }
      c.font = f; key = '';
      for (i = 0; i < parts.length; i++) { parts[i].w = c.measureText(parts[i].s).width; tw2 += parts[i].w; key += parts[i].s; }
      capsule = { parts: parts, icon: icon, col: col, f: f, cw: 17 + tw2, w: Math.min(G.W - 12, 17 + tw2 + 28), grad: null };
      if (icon === 'star') { x = G.cx - capsule.cw / 2 + 17; capsule.grad = ctx.createLinearGradient(x, 0, x + parts[0].w, 0); capsule.grad.addColorStop(0, rgba(COL.indigoL, 1)); capsule.grad.addColorStop(0.5, rgba(COL.violetL, 1)); capsule.grad.addColorStop(1, rgba(COL.tealL, 1)); }
      capW.t = capsule.w;
      if (key !== capKey) { capKey = key; capT0 = (snapText || reduce) ? -9 : time; }
      if (snapText || reduce) capW.snap(capsule.w);
      snapText = false; textDirty = false;
    }
    function drawCapsule(c) {
      var cp = capsule, w = capW.x, x = G.cx - w / 2, y = capY, h = ROW.capH, fade = clamp((time - capT0) / 0.22, 0, 1), i, tx, my = y + h / 2;
      c.globalAlpha = 1; c.beginPath(); rr(c, x, y, w, h, h / 2); c.fillStyle = 'rgba(255,255,255,0.075)'; c.fill();
      c.lineWidth = 1; c.strokeStyle = rgba(cp.col, 0.44); c.stroke();
      c.globalAlpha = 0.2 + 0.8 * fade;
      tx = G.cx - cp.cw / 2;
      c.fillStyle = rgba(cp.col, 1); c.beginPath();
      if (cp.icon === 'star') star4(c, tx + 5, my, 5.6); else c.arc(tx + 4.5, my, 3.4, 0, TAU);
      c.fill();
      c.font = cp.f; c.textAlign = 'left'; c.textBaseline = 'middle'; tx += 17;
      for (i = 0; i < cp.parts.length; i++) { c.fillStyle = cp.parts[i].grad ? cp.grad : cp.parts[i].col; c.fillText(cp.parts[i].s, tx, my + 0.6); tx += cp.parts[i].w; }
      c.globalAlpha = 1;
    }

    // ----- the frame -----
    function draw() {
      var c = ctx, m = moodS.x, warm = clamp(m, 0, 1), cool = clamp(-m, 0, 1), rw = clamp(rewS.x, 0, 1), lean = Math.max(warm, cool), i, k, a, cs, sn, sg, p, x, s, f, dim;
      if (!cssW || !spr.stand) return;
      // dimmed (not tracking, and the dim transition): the picture is drawn at full strength into one layer, then composited
      // at the dim strength, so it is the lit picture made fainter and no part of the scale shows through another
      dim = clamp(dimS.x, 0, 1);
      if (dim < DIM_FULL) {
        if (!grp || grp.width !== canvas.width || grp.height !== canvas.height) { grp = mkCanvas(canvas.width, canvas.height); gctx = grp.getContext('2d'); }
        c = gctx;
      } else if (grp) { grp.width = grp.height = 1; grp = gctx = null; }   // back at full strength: the layer's memory is let go
      if (textDirty) layoutText();
      drawSoft();
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'copy';
      c.drawImage(soft, 0, 0, soft.width * dpr / SQ, soft.height * dpr / SQ);
      c.globalCompositeOperation = 'source-over';
      c.setTransform(K, 0, 0, K, OX * dpr, OY * dpr); c.lineCap = 'round'; c.lineJoin = 'round';
      // stand
      c.globalAlpha = 1; c.drawImage(spr.stand, STX, STY, STW, STH);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8; drawDust(c); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      // crisp iridescent ring with orbiting star marks: the balanced reward
      if (rw > 0.01) {
        c.save(); c.translate(G.cx, G.cy); c.beginPath(); c.arc(0, 0, 46, 0, TAU); c.rotate(time * 0.3);
        c.strokeStyle = grad.iri; c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.13 * rw; c.lineWidth = 6; c.stroke(); c.globalAlpha = 0.24 * rw; c.lineWidth = 2.8; c.stroke();
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.9 * rw; c.lineWidth = 1.1; c.stroke();
        c.beginPath(); for (k = 0; k < 3; k++) { a = k * TAU / 3; star4(c, 46 * Math.cos(a), 46 * Math.sin(a), 2.3 + 1.1 * Math.sin(time * 1.7 + k * 2.2)); }
        c.fillStyle = '#fff'; c.globalAlpha = 0.9 * rw; c.fill();
        c.restore();
      }
      // beam, behind the vessels
      c.save(); c.translate(G.cx, G.cy); c.rotate(theta); c.globalAlpha = 1;
      c.beginPath();
      for (sg = -1; sg <= 1; sg += 2) { c.moveTo(sg * 11, -3.4); c.lineTo(sg * (G.arm - HRX + 1), -2); c.lineTo(sg * (G.arm - HRX + 1), 2); c.lineTo(sg * 11, 3.4); c.closePath(); }
      c.fillStyle = grad.beam; c.fill();
      c.globalCompositeOperation = 'lighter'; c.fillStyle = grad.beamTint; c.fill(); c.globalCompositeOperation = 'source-over';
      c.beginPath(); c.moveTo(-(G.arm - HRX - 1), -1.3); c.lineTo(-24, -2.5); c.moveTo(24, -2.5); c.lineTo(G.arm - HRX - 1, -1.3); c.lineWidth = 0.7; c.strokeStyle = 'rgba(255,255,255,0.62)'; c.stroke();
      c.globalAlpha = 0.7; c.lineWidth = 2.8;
      for (i = 0; i < 2; i++) { c.beginPath(); c.ellipse((i ? 1 : -1) * G.arm, 0, HRX, HRY, 0, Math.PI, TAU); c.strokeStyle = grad.ring[i]; c.stroke(); }
      if (lean > 0.03 && !reduce) {   // light beads drifting toward the heavier side
        sg = warm > cool ? -1 : 1; c.beginPath();
        for (k = 0; k < 6; k++) { p = (time * 0.16 + k / 6) % 1; x = sg * lerp(-(G.arm - 26), G.arm - 26, p); if (Math.abs(x) < 25) continue; s = Math.pow(Math.sin(Math.PI * p), 0.6); c.moveTo(x + 5 * s, -0.6); c.ellipse(x, -0.6, 5 * s, 1.05 * s, 0, 0, TAU); }
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.62 * lean; c.fillStyle = rgba(sg < 0 ? SIDE[0].hi : SIDE[1].hi, 1); c.fill(); c.globalCompositeOperation = 'source-over';
      }
      c.restore();
      drawVessel(c, V[0]); drawVessel(c, V[1]);
      // gimbal rings, front halves and pins
      c.save(); c.translate(G.cx, G.cy); c.rotate(theta); c.globalAlpha = 1;
      for (i = 0; i < 2; i++) {
        sg = i ? 1 : -1;
        c.beginPath(); c.ellipse(sg * G.arm, 0, HRX, HRY, 0, 0, Math.PI); c.lineWidth = 3.3; c.strokeStyle = grad.ring[i]; c.stroke();
        c.beginPath(); c.ellipse(sg * G.arm, 1.25, HRX, HRY, 0, 0.08 * Math.PI, 0.92 * Math.PI); c.lineWidth = 0.8; c.strokeStyle = 'rgba(6,8,20,0.5)'; c.stroke();
        c.beginPath(); c.ellipse(sg * G.arm, -0.8, HRX, HRY, 0, 0.54 * Math.PI, 0.9 * Math.PI); c.lineWidth = 0.8; c.strokeStyle = 'rgba(255,255,255,0.78)'; c.stroke();
      }
      for (i = 0; i < 2; i++) {
        sg = i ? 1 : -1; c.beginPath();
        c.moveTo(sg * (G.arm - HRX) + 2.2, 0); c.arc(sg * (G.arm - HRX), 0, 2.2, 0, TAU); c.moveTo(sg * (G.arm + HRX) + 2.2, 0); c.arc(sg * (G.arm + HRX), 0, 2.2, 0, TAU);
        c.fillStyle = rgba(SIDE[i].hi, 1); c.fill(); c.lineWidth = 0.7; c.strokeStyle = rgba(SIDE[i].deep, 0.7); c.stroke();
      }
      c.restore();
      // the pivot jewel: cached gem bodies cross-faded by mood, a slow inner light, a capped gloss
      x = G.cx - GS / 2; s = G.cy - GS / 2;
      c.globalAlpha = 1; c.drawImage(spr.gem.base, x, s, GS, GS);
      if (warm > 0.01) { c.globalAlpha = warm; c.drawImage(spr.gem.warm, x, s, GS, GS); }
      if (cool > 0.01) { c.globalAlpha = cool; c.drawImage(spr.gem.cool, x, s, GS, GS); }
      a = rw * (1 - lean); if (a > 0.01) { c.globalAlpha = a; c.drawImage(spr.gem.iri, x, s, GS, GS); }
      c.globalCompositeOperation = 'screen';
      c.globalAlpha = clamp(0.2 + 0.3 * flash, 0, 0.6); c.drawImage(blobSprite('white'), G.cx + 5.5 * Math.cos(time * 0.45) - 8.5, G.cy + 3 + 4.3 * Math.sin(time * 0.6) - 7.4, 17, 14.8);
      c.globalAlpha = 0.3; c.drawImage(blobSprite('white'), G.cx - 5 + par.x * 4.2 - 5, G.cy - 8.6 + par.y * 3 - 3, 10, 6);
      c.globalCompositeOperation = 'source-over';
      if (flash > 0.03) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * Math.min(1, flash); c.beginPath(); star4(c, G.cx, G.cy, 9 + 21 * flash); c.fillStyle = rgba(COL.violetL, 1); c.fill(); c.globalCompositeOperation = 'source-over'; }
      // celebration sparks
      if (sN) { c.beginPath(); for (i = 0; i < sN; i++) star4(c, sx[i], sy[i], 0.6 + 2.6 * Math.min(1, sl[i] * 1.6)); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.9; c.fillStyle = rgba(COL.violetL, 1); c.fill(); c.globalCompositeOperation = 'source-over'; }
      if (c !== ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.globalAlpha = dim; ctx.drawImage(grp, 0, 0); ctx.globalCompositeOperation = 'source-over'; c = ctx; }
      // label row and capsule: information, always at full strength (only the drawn scale dims)
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.drawImage(T.cv, T.x0, T.y0);
      c.setTransform(K, 0, 0, K, OX * dpr, OY * dpr);
      drawCapsule(c);
      if (fading) {
        f = (performance.now() - fadeT0) / 150;
        if (f >= 1) fading = false; else { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1 - f; c.drawImage(snap, 0, 0); c.globalAlpha = 1; }
      }
      // host callbacks, after the frame is complete: onBalanced with the burst (or the settled balanced frame), onReady once after the first frame
      if (balDue) { balDue = false; fire('onBalanced'); }
      if (!readyDone) { readyDone = true; Promise.resolve().then(function () { if (!destroyed) fire('onReady'); }); }
    }

    // ----- loop -----
    function shouldRun() { return !destroyed && !frozen && inView && !document.hidden && cssW > 0 && (!reduce || fading); }
    function frame(now) {
      var dt, t0, gap, i;
      raf = 0; if (destroyed) return;
      if (lastT) { gap = now - lastT; st8.frames++; st8.gapSum += gap; if (gap > st8.gapMax) st8.gapMax = gap; quality(dbgMs || gap); }
      dt = lastT ? clamp((now - lastT) / 1000, 0.001, 0.05) : 1 / 60; lastT = now;
      t0 = performance.now();
      if (!reduce) {
        update(dt);
        for (i = 0; i < 2; i++) if (time > V[i].glintAt) { V[i].glintT0 = time; V[i].glintAt = time + 3.5 + rnd() * 6; V[i].glintSpot = (rnd() * 3) | 0; }
        capW.step(dt);
      }
      draw();
      t0 = performance.now() - t0; st8.renSum += t0; if (t0 > st8.renMax) st8.renMax = t0;
      if (shouldRun()) { if (!raf) raf = root.requestAnimationFrame(frame); } else lastT = 0;   // a callback that called back in may already have scheduled the next frame
    }
    function kick() { if (!raf && shouldRun()) { lastT = 0; qSkip = QSKIP; raf = root.requestAnimationFrame(frame); } }
    function quality(step) {
      var i, next = 0;
      if (qSkip > 0) { qSkip--; return; }
      if (step > QPAUSE) return;
      if (qN === QWIN) qSum -= qBuf[qI]; else qN++;
      qBuf[qI] = step; qSum += step; qI = (qI + 1) % QWIN;
      if (qN < QWIN) return;
      qAvg = qSum / QWIN;   // the latest full-window average, kept for stats() across a drop
      if (qAvg <= QSLOW) return;
      for (i = 0; i < QSTEPS.length; i++) if (QSTEPS[i] < dpr - 1e-6) { next = QSTEPS[i]; break; }
      if (!next) return;
      qCap = next; qDrops++;
      layout(cssW, cssH, devScale());   // rebuilds the cached art at the lower scale, which restarts the measurement
    }
    function still() { if (reduce || frozen) draw(); else kick(); }
    function crossfade() {
      if (!canvas.width || !cssW) return;
      if (!snap || snap.width !== canvas.width || snap.height !== canvas.height) snap = mkCanvas(canvas.width, canvas.height);
      var sc = snap.getContext('2d'); sc.globalCompositeOperation = 'copy'; sc.drawImage(canvas, 0, 0);
      fadeT0 = performance.now(); fading = true;
    }

    // ----- public -----
    function devScale() { return Math.min(clamp(root.devicePixelRatio || 1, 1, 3), qCap); }
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight, d = devScale(), r;
      if (!w || !h) { r = canvas.getBoundingClientRect(); w = r.width; h = r.height; }
      if (!w || !h) return api;
      if (w === cssW && h === cssH && d === dpr && spr.stand) return api;
      layout(w, h, d); snapText = true;
      draw(); kick();
      return api;
    }
    function layout(w, h, d) {
      cssW = w; cssH = h; dpr = d;
      canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      S = Math.min(w / G.W, h / G.H); K = S * d; OX = (w - G.W * S) / 2; OY = (h - G.H * S) / 2;
      soft.width = Math.ceil(w * SQ); soft.height = Math.ceil(h * SQ);
      buildSprites(); V[0].g = V[1].g = null;
      T.x0 = Math.floor(OX * d); T.y0 = Math.floor(TY0 * K + OY * d);
      T.cv = mkCanvas(Math.ceil(G.W * K) + 2, Math.ceil((TY1 - TY0) * K) + 2); T.c = T.cv.getContext('2d');
      textDirty = true;
    }
    function setState(patch) {
      if (destroyed) return api;
      var settle = !!(patch && patch.settle);
      opening = false;
      if (patch && patch.debugFrameMs !== undefined) dbgMs = cleanDbg(patch.debugFrameMs);
      if (reduce) crossfade();
      st = norm(st, patch); applyState(settle);
      if (reduce || frozen) { draw(); kick(); } else kick();
      return api;
    }
    function select(side, silent) {
      var i = side === 'screen' || side === 0 ? 0 : side === 'move' || side === 1 ? 1 : -1;
      if (i === selected) return api;
      if (reduce) crossfade();
      selected = i; textDirty = true; label(); if (i >= 0) say(i ? desc.moveDetail : desc.screenDetail);
      if (reduce) { V[0].sel.snap(i === 0 ? 1 : 0); V[1].sel.snap(i === 1 ? 1 : 0); draw(); }
      kick();
      if (!silent) fire('onSideTap', i < 0 ? null : SIDE[i].name);
      return api;
    }
    function toggle(i) { select(selected === i ? -1 : i); }
    // accessibility: the canvas label always carries the whole state, plus the open detail line; a polite live region speaks changes
    function label() { canvas.setAttribute('aria-label', desc.a11y + (selected >= 0 ? ' ' + (selected ? desc.moveDetail : desc.screenDetail).replace(/ \u00B7 /g, ', ') + '.' : '')); }
    function say(text) { if (live) live.textContent = String(text).replace(/ \u00B7 /g, ', '); }
    function local(e) { var r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) * (cssW / (r.width || 1)) - OX) / S, y: ((e.clientY - r.top) * (cssH / (r.height || 1)) - OY) / S }; }
    var press = null, SLOP = 6;   // css px of travel (|dx| + |dy|) before a press counts as a drag
    function onDown(e) {
      if (e.button != null && e.button > 0) return;
      var p = local(e);
      press = { id: e.pointerId, x0: p.x, y0: p.y, cx0: e.clientX, cy0: e.clientY, t0: performance.now(), moved: false };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      kick();
    }
    function dropPress() { if (!press) return; try { canvas.releasePointerCapture(press.id); } catch (err) {} press = null; drag.t = 0; kick(); }
    function onMove(e) {
      var p = local(e), rx, ry, r0x, r0y, cross, dx, dy;
      // touch (the canvas carries touch-action: pan-y): a finger tilts only once its drag is mostly sideways. A mostly vertical
      // drag belongs to the page scroll, so the press is dropped: no tilt, no tap, no selection change, no parallax.
      if (e.pointerType === 'touch') {
        if (!press || press.id !== e.pointerId) return;
        if (!press.moved) {
          dx = Math.abs(e.clientX - press.cx0); dy = Math.abs(e.clientY - press.cy0);
          if (dx + dy <= SLOP) return;
          if (dy >= dx) { dropPress(); return; }
        }
      }
      par.tx = clamp((p.x - G.cx) / 195, -1, 1); par.ty = clamp((p.y - 216) / 216, -1, 1);
      if (press && press.id === e.pointerId) {
        if (Math.abs(e.clientX - press.cx0) + Math.abs(e.clientY - press.cy0) > SLOP) press.moved = true;
        if (press.moved && st.tracking && !reduce) {
          r0x = press.x0 - G.cx; r0y = press.y0 - G.cy; rx = p.x - G.cx; ry = p.y - G.cy; cross = r0x * ry - r0y * rx;
          drag.t = clamp(0.8 * cross / Math.max(r0x * r0x + r0y * r0y, 1600), -9.5 * DEG, 9.5 * DEG);
        }
      }
      kick();
    }
    function tapAt(p) {
      var dx = p.x - G.cx, dy = p.y - G.cy;
      if (dx * dx + dy * dy < 1156) { if (!reduce) { flash = 1; burst(10, 0.55); } select(-1); kick(); }
      else if (p.x < G.cx - 36) toggle(0);
      else if (p.x > G.cx + 36) toggle(1);
      else select(-1);
    }
    function onUp(e) {
      if (!press || press.id !== e.pointerId) return;
      var tap = !press.moved && performance.now() - press.t0 < 450, p = local(e);
      press = null; drag.t = 0;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      if (tap) tapAt(p);
      kick();
    }
    // the browser took the gesture (a page scroll) or lost the pointer: the beam springs back and the press ends without a tap
    function onCancel(e) { press = null; drag.t = 0; if (e && e.pointerType === 'touch') { par.tx = 0; par.ty = 0; } kick(); }
    function onLeave() { par.tx = 0; par.ty = 0; }
    function onDocDown(e) { if (e.target !== canvas && selected >= 0) select(-1); }
    function onKey(e) {
      if (e.key === 'ArrowLeft') { select(0); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { select(1); e.preventDefault(); }
      else if (e.key === 'Escape') select(-1);
    }
    function rebuild() { if (destroyed || !cssW) return; buildSprites(); V[0].g = V[1].g = null; textDirty = true; snapText = true; if (reduce || frozen) draw(); else kick(); }
    function onVis() { if (!document.hidden) rebuild(); kick(); }
    function onMq() { if (forcedReduce == null) setReduced(mq.matches); }
    function onMqT() { if (forcedT == null) setReduceT(mqT.matches); }
    function setReduceT(on) { on = !!on; if (on !== reduceT) { reduceT = on; still(); } return api; }
    function setReduced(on) { on = !!on; if (on === reduce) return api; reduce = on; if (on) { time = 1.7; settleAll(); draw(); } else kick(); return api; }
    function stats(reset) {
      var o = { avgFrameMs: st8.frames ? st8.gapSum / st8.frames : 0, maxFrameMs: st8.gapMax, avgRenderMs: st8.frames ? st8.renSum / st8.frames : 0, maxRenderMs: st8.renMax, frames: st8.frames, liveGrains: gN, peakGrains: peakG, running: !!raf, reduced: reduce, numberFontPx: T.numFont * S, gapLeftPx: T.gapL * S, gapRightPx: T.gapR * S, tiltDeg: theta / DEG, reward: rewS.x,
        numberShown: numLive ? numShown : null, sandMin: [V[0].disp, V[1].disp], boardMin: [V[0].load, V[1].load], sandFill: [V[0].fill, V[1].fill], grainsOutside: 0, reduceTransparency: reduceT,
        rewardFx: Math.max(clamp(rewS.x, 0, 1), ringPulse, flash, sN ? 1 : 0),   // strongest reward visual still drawn (glow, ring pulse, jewel flash, sparks); 0 = none
        capsuleTopPx: (capY - 0.5) * S + OY, labelGapPx: (capY - 0.5 - T.ink) * S,
        backingScale: dpr, qualityDrops: qDrops, frameStepMs: qAvg };
      // self-check: grains past the bottom of the inner glass or outside its walls (always 0: nothing leaves through the base)
      for (var q = 0; q < gN; q++) if (gy[q] > Hi + 0.5 || Math.abs(gx[q]) > wAt(profI, gy[q]) + 0.5) o.grainsOutside++;
      if (reset) { st8.frames = 0; st8.gapSum = 0; st8.gapMax = 0; st8.renSum = 0; st8.renMax = 0; peakG = gN; }
      return o;
    }
    var ro = null, io = null, live = null, ownLive = false, lastKind = null;
    function destroy() {
      if (destroyed) return;
      destroyed = true; if (raf) root.cancelAnimationFrame(raf); raf = 0;
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDocDown, true); document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('contextrestored', rebuild); root.removeEventListener('pageshow', rebuild);
      if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onMq); else if (mq.removeListener) mq.removeListener(onMq); }
      if (mqT) { if (mqT.removeEventListener) mqT.removeEventListener('change', onMqT); else if (mqT.removeListener) mqT.removeListener(onMqT); }
      if (ro) ro.disconnect(); if (io) io.disconnect();
      if (ownLive && live && live.parentNode) live.parentNode.removeChild(live);
      live = null;
      if (OWNED && OWNED.get(canvas) === api) OWNED.delete(canvas);
      if (lastInstance === api) lastInstance = null;
    }
    var api = {
      setState: setState, resize: resize, destroy: destroy, select: select, stats: stats, setReducedMotion: setReduced, setReduceTransparency: setReduceT,
      describe: function () { return describe(st); }, getState: function () { var s = norm(st, null); delete s.scr; delete s.mov; delete s.earn; return s; }
    };

    V[0].glintT0 = V[1].glintT0 = -9;
    canvas.setAttribute('role', 'img');
    if (options.liveRegion && options.liveRegion.nodeType === 1) live = options.liveRegion;
    else if (options.announce !== false && canvas.parentNode) {
      live = document.createElement('span'); ownLive = true;
      live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
      live.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
      canvas.parentNode.insertBefore(live, canvas.nextSibling);
    }
    if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel); canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDocDown, true); document.addEventListener('visibilitychange', onVis);
    canvas.addEventListener('contextrestored', rebuild); root.addEventListener('pageshow', rebuild);
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }
    if (mqT) { if (mqT.addEventListener) mqT.addEventListener('change', onMqT); else if (mqT.addListener) mqT.addListener(onMqT); }
    if (root.ResizeObserver) { ro = new root.ResizeObserver(function () { resize(); }); ro.observe(canvas); }
    if (root.IntersectionObserver) { io = new root.IntersectionObserver(function (en) { inView = en[en.length - 1].isIntersecting; kick(); }); io.observe(canvas); }
    lastInstance = api; if (OWNED) OWNED.set(canvas, api);
    applyState(!!options.settle || reduce || frozen);
    resize();
    return api;
  }

  function fwd(name) { return function () { return lastInstance ? lastInstance[name].apply(lastInstance, arguments) : undefined; }; }
  root.BalanceHero = { mount: mount, describe: describe, setState: fwd('setState'), destroy: fwd('destroy'), stats: fwd('stats'), resize: fwd('resize'), select: fwd('select'), MODEL: MODEL, version: '1.2.1' };
})(typeof window !== 'undefined' ? window : this);
