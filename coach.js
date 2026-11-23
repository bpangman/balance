/* Balance - the Coach tab (web demo), part 1: home, setup, Change today,
   Day detail, Earned today and the free timer.
   It runs on the real coach engine (coach-engine.js, loaded just before this
   file and never edited). Earning still goes through app.js creditWorkout,
   so the earned list, minutes, Shields and Today's numbers stay one system.
   Layout and words follow coach/final/index.html and COACH_SPEC.md. */
(function () {
'use strict';

var E = window.CoachEngine;
var KEY = 'balance_coach_state', AKEY = 'balance_coach_active';
var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function $(s, r) { return (r || document).querySelector(s); }

/* ---------- icons: the prototype's inline SVG set, 24 x 24, stroke ---------- */
var IC = {
  chevR: '<path d="M9 5l7 7-7 7"/>', chevL: '<path d="M15 5l-7 7 7 7"/>', chevD: '<path d="M5 9l7 7 7-7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.8"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8"/>',
  bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6l1-8z"/>',
  shield: '<path d="M12 3v18c-4.5-1.7-7.5-5.2-7.5-9.8V5.8L12 3z" fill="currentColor" stroke="none" opacity=".4"/><path d="M12 3l7.5 2.8v5.4c0 4.6-3 8.1-7.5 9.8-4.5-1.700-7.5-5.2-7.5-9.800V5.800L12 3z"/>',
  timer: '<circle cx="12" cy="13.500" r="7.500"/><path d="M12 9.500v4l2.500 2M9.500 2.800h5M12 2.800V6"/>',
  swap: '<path d="M4 8h13l-3.500-3.500M20 16H7l3.500 3.500"/>',
  list: '<path d="M8.500 6.500h11M8.500 12h11M8.500 17.500h11"/><circle cx="4.500" cy="6.500" r=".9" fill="currentColor"/><circle cx="4.500" cy="12" r=".9" fill="currentColor"/><circle cx="4.500" cy="17.500" r=".9" fill="currentColor"/>',
  more: '<circle cx="5.500" cy="12" r="1.700" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.700" fill="currentColor" stroke="none"/><circle cx="18.500" cy="12" r="1.700" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8.500 5.500v13M15.500 5.500v13"/>', play: '<path d="M8 5.500l10.500 6.500L8 18.500z" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.500"/><circle cx="12" cy="7.800" r=".9" fill="currentColor"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4.500c0 3 1.400 4.600 3.700 4.900M16 6h3.500c0 3-1.400 4.600-3.700 4.900M12 13v4M8.500 20h7M10 17h4"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  walk: '<circle cx="13" cy="4.600" r="1.900"/><path d="M12.800 8.400L9.500 10.500 8.600 14M12.800 8.400l1 4.600-3.600 7.200M13.800 13l3 2.400.8 4.800M12.800 9.500l3.400 2.600 2.400-.4"/>',
  run: '<circle cx="15" cy="4.600" r="1.900"/><path d="M14 8.300l-4.200.9L7.600 12M14 8.300l-1.600 5 3.600 2.400.4 4.800M12.400 13.300L9.600 16.500 5.500 17M14.600 9.600l2.200 2.300 3-.4"/>',
  lift: '<path d="M3 9.500v5M6.500 7v10M17.500 7v10M21 9.500v5M6.500 12h11"/>',
  yoga: '<circle cx="12" cy="5" r="1.900"/><path d="M12 8.500v5M5 11l7 1 7-1M12 13.500l-5.500 5h11z"/>',
  cycle: '<circle cx="6" cy="16" r="3.600"/><circle cx="18" cy="16" r="3.600"/><path d="M6 16l4-7h5.500l2.500 7M10 9l3 7M9 6.500h2.500M14.500 6.500l1 2.500"/>',
  other: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  heart: '<path d="M12 20.500s-7.500-4.600-7.500-10.200A4.300 4.300 0 0 1 12 7.600a4.300 4.300 0 0 1 7.500 2.700c0 5.600-7.500 10.200-7.500 10.200z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-4 14-12 14M5 19c2-5 5-8 9-10"/>',
  moon: '<path d="M20 14.500A8.500 8.500 0 0 1 9.500 4a8.500 8.500 0 1 0 10.500 10.500z"/>',
  target: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  stairs: '<path d="M2.500 20h5.500v-5h5.500v-5H19V5h2.500"/>',
  tshirt: '<path d="M8 4L3 7l2 4 3-1.500V20h8V9.500l3 1.500 2-4-5-3c-.6 1.600-2 2.500-4 2.500S8.600 5.600 8 4z"/>',
  figure: '<circle cx="12" cy="4.500" r="2"/><path d="M6 10h12M12 8v7M12 15l-3.500 6M12 15l3.500 6"/>',
  push: '<path d="M5 4h14M12 20V9M7 13l5-5 5 5"/>', pull: '<path d="M5 20h14M12 4v11M7 11l5 5 5-5"/>',
  up: '<path d="M12 19V6M6.500 11.500L12 6l5.500 5.500"/>', down: '<path d="M12 5v13M6.500 12.500L12 18l5.500-5.500"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.500 6.500l4 4"/>',
  cal: '<rect x="3.500" y="5" width="17" height="15.500" rx="3"/><path d="M3.500 10h17M8 3v4M16 3v4"/>',
  undo: '<path d="M8 6L4 10l4 4M4 10h10a5.500 5.500 0 0 1 0 11H9"/>',
  watch: '<rect x="7" y="6.500" width="10" height="11" rx="3"/><path d="M9 6.500l.7-3.500h4.600l.7 3.500M9 17.500l.7 3.500h4.600l.7-3.500"/>',
  trash: '<path d="M4.500 7h15M9.500 7V4.500h5V7M6.500 7l1 13h9l1-13M10 11v5.500M14 11v5.500"/>',
  skip: '<path d="M5 5.500l9 6.500-9 6.500zM18.500 5.500v13"/>',
  sound: '<path d="M4 9.500v5h3.500l5 4v-13l-5 4H4zM16 9a4.500 4.500 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  home: '<path d="M4 11l8-7 8 7v8.500a1 1 0 0 1-1 1h-4.500v-6h-5v6H5a1 1 0 0 1-1-1V11z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
function ic(n, c) {
  var cls = 'ci' + (c ? ' ' + c : '');
  if (n && n.indexOf('sprite:') === 0) return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + n.slice(7) + '"/></svg>';
  return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || IC.other) + '</svg>';
}

/* ---------- small helpers ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function nf(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function clock(s) { s = Math.max(0, Math.floor(s)); var m = Math.floor(s / 60), x = s % 60; return m + ':' + (x < 10 ? '0' : '') + x; }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function copy(o) { return JSON.parse(JSON.stringify(o)); }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function demo() { return typeof state !== 'undefined' ? state : null; }
function rate() { var s = demo(); return (s && s.earnRateMultiplier) || 1; }
/* the rate line (COACH_SPEC 8.1) comes from app.js so Settings and Coach never disagree */
function rateLine() { return typeof earnRateLine === 'function' ? earnRateLine() : 'Every minute you move earns 1 minute of scroll time.'; }

/* ---------- the day the coach works on (rule 3): local date, ?coachDay=N moves it 0 to 13 days on ---------- */
function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function dateOf(k) { var a = String(k).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
function addKey(k, n) { var d = dateOf(k); return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); }
function param(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } }
function coachDayOffset() { var v = param('coachDay'); if (v != null && /^\d{1,2}$/.test(v) && +v <= 13) return +v; return 0; }
function coachToday() { var d = new Date(); return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + coachDayOffset())); }
function fmtD(k) { var d = dateOf(k); return DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate(); }
function fmtS(k) { var d = dateOf(k); return MON[d.getMonth()] + ' ' + d.getDate(); }

/* ---------- the store (rule 4): one key for the engine state, one for the running workout ---------- */
var ST = null;          /* the engine state */
var MEM = false;        /* true for the test addresses: nothing is written to storage */
var SAMPLE = false;     /* true when seeded history is on screen: the SAMPLE caption shows */
var ACT = null;         /* the running planned workout { workoutId, title, tone, day, startedAt } */
var WK = null, ACTIVE = null, READY = false, COMPACT = false, PIN = '', WL = null;
var UI = { view: 'home', sheet: null, cover: null, setup: null, edit: null, swapBase: null, swapDay: '', sheetOpener: null, coverOpener: null };
var sheetKeyOpen = '', coverKeyOpen = '';

function exec(op, input, st) {
  try { return E.run(op, st === undefined ? ST : st, input || {}); }
  catch (e) { return { result: { ok: false, error: { code: 'exception', message: '' } }, state: st === undefined ? ST : st }; }
}
function q(op, input, st) { var r = exec(op, input, st); return (r && r.result) || { ok: false }; }
function freshState() { return E.run('newState', null, {}).state; }
function cxLoad() {
  var text = '';
  try { text = localStorage.getItem(KEY) || ''; } catch (e) { text = ''; }
  var r = exec('load', { text: text }, null);
  if (r.result && r.result.ok && r.state) return r.state;
  return freshState();
}
function cxSave() {
  if (MEM) return;
  try { var r = E.run('save', ST, {}); if (r.result && r.result.ok) localStorage.setItem(KEY, r.result.text); } catch (e) {}
}
/* every change goes through here: it keeps the new state only when the engine says ok, then saves it */
function cxRun(op, input) {
  var r = exec(op, input);
  if (r.result && r.result.ok && E.isMutating(op)) { ST = r.state; cxSave(); }
  return (r && r.result) || { ok: false };
}
function readActive() {
  if (MEM) return null;
  try { var t = localStorage.getItem(AKEY); if (!t) return null; var o = JSON.parse(t); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
}
function writeActive(o) {
  if (MEM) return;
  try { if (o) localStorage.setItem(AKEY, JSON.stringify(o)); else localStorage.removeItem(AKEY); } catch (e) {}
}
function today() { return { today: coachToday() }; }
/* engine errors never show raw (APP_MAPPING section 2): each code gets the app's own words, or none where a refresh is the whole answer
   (the option goes away because the screen follows todayActions again) */
var ERR_QUIET = { alreadyDone: 1, notAllowedToday: 1, notPlannedToday: 1, unknownWorkout: 1, backToBack: 1, needRest: 1, noPlan: 1, notSetUp: 1, alreadySetUp: 1, cannotUndo: 1, unknownRecord: 1 };
function engineMsg(r) {
  var c = (r && r.error && r.error.code) || '';
  if (c === 'sessionActive') return 'Finish your workout first.';
  return ERR_QUIET[c] ? '' : 'That did not work. Try again.';
}
function errCode(r) { return (r && r.error && r.error.code) || ''; }
function toastErr(r) { var m = engineMsg(r); if (m) toast(m); }

/* ---------- the engine's catalog: layouts for the live week preview, anchors and exercise facts ---------- */
var CAT = null, EXMAP = null, TITLES = null;
function catalog() {
  if (!CAT) { CAT = q('catalog', {}, freshState()); if (!CAT.ok) CAT = { layouts: [], anchors: {}, exercises: [], cycleX: {} }; }
  return CAT;
}
function exInfo(id) {
  if (!EXMAP) { EXMAP = {}; (catalog().exercises || []).forEach(function (x) { EXMAP[x.id] = x; }); }
  return EXMAP[id] || { id: id, name: id, logType: 'reps', start: [10, 10, 10], step: 5, minWeight: 0, maxWeight: 1000 };
}
function titleOfWorkout(id) {
  if (!TITLES) { TITLES = {}; (catalog().layouts || []).forEach(function (l) { (l.rotation || []).forEach(function (r) { TITLES[r.workoutId] = r.title; }); }); }
  return TITLES[id] || id;
}
function layoutFor(n) { var l = (catalog().layouts || []).filter(function (x) { return x.daysPerWeek === n; })[0]; return l || { cycle: [], rotation: [] }; }
function extraKind(goal) { return (catalog().cycleX || {})[goal] === 'cardio' ? 'cardio' : 'recovery'; }

/* ---------- day colors, glyphs and words (COACH_SPEC 3.1) ---------- */
var FOCUS_TONE = { push: 'push', pull: 'pull', legs: 'legs', upper: 'upper', fullBody: 'full', coreCardio: 'core', cardio: 'cardio', recovery: 'recover', rest: 'rest' };
var GLYPH = { push: 'push', pull: 'pull', legs: 'stairs', upper: 'tshirt', full: 'figure', core: 'target', cardio: 'heart', recover: 'leaf', rest: 'moon', done: 'check', brand: 'lift' };
var SHORT = { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', full: 'Full', core: 'Core', cardio: 'Cardio', recover: 'Recover', rest: 'Rest' };
var TONE = { push: ['#A855F7', '#CDA4FF'], pull: ['#4C9BF0', '#A3CCFA'], legs: ['#F7C948', '#FBE08A'], upper: ['#E26EE5', '#F3B4F4'], full: ['#38BDF8', '#A5E0FC'], core: ['#F472B6', '#FAB3D6'], cardio: ['#2DD4BF', '#8EEBDD'], recover: ['#A3E635', '#D0F58C'], rest: ['#A9B4CC', '#DCE3F0'], done: ['#34D399', '#8BF0C3'], brand: ['#6366F1', '#A9ACFB'] };
function toneOf(focus) { return FOCUS_TONE[focus] || 'rest'; }
function focusOfWorkout(id) { return String(id || '').replace(/[AB]$/, ''); }
function toneOfWorkout(id) { return id === 'recovery' ? 'recover' : toneOf(focusOfWorkout(id)); }
/* engine titles stay short ("Legs A"); the screen adds "day" (CONTRACT_CHANGES item 1) */
function dispTitle(t) {
  var m = /^(Push|Pull|Legs)( [AB])?$/.exec(String(t || ''));
  if (m) return (m[1] === 'Legs' ? 'Leg' : m[1]) + ' day' + (m[2] || '');
  return t === 'Cardio' ? 'Cardio day' : String(t || '');
}
/* the engine writes " - " between summary parts; the screen uses the middle dot (item 2) */
function dispSummary(s) {
  s = String(s || '');
  var m = /^(.*) moves to your next training day$/.exec(s);
  if (m) return dispTitle(m[1]) + ' moves to your next training day';
  return s.split(' - ').join(' · ');
}
function dayView(d, i) {
  var tone = d.kind === 'recovery' ? 'recover' : toneOf(d.focus);
  return { raw: d, i: i, key: d.day, tone: tone, g: GLYPH[tone], title: dispTitle(d.title), s: SHORT[tone] || 'Rest', desc: d.description || '', summary: dispSummary(d.summary), done: !!d.done, kind: d.kind, wid: d.workoutId, chosen: d.choice === 'rest' };
}
function dayName(k, i) { return i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DOW[dateOf(k).getDay()]; }

/* target text for compact rows: "3 × 8 · 135 lb", "3 × 10", "3 × 30 sec", "30 min" */
function tShort(it) {
  var t = it.target || {};
  if (it.logType === 'cardio') return (t.minutes || 0) + ' min';
  if (it.logType === 'weightReps') return t.sets + ' × ' + t.reps + ' · ' + t.weight + ' lb';
  if (it.logType === 'seconds') return t.sets + ' × ' + t.seconds + ' sec';
  return t.sets + ' × ' + t.reps;
}
function lastText(it) {
  var l = it.last; if (!l || !l.sets || !l.sets.length) return '';
  if (it.logType === 'weightReps') return l.sets[0].weight + ' lb x ' + l.sets.map(function (x) { return x.reps; }).join(', ');
  if (it.logType === 'cardio') return (l.sets[0].minutes || 0) + ' min';
  if (it.logType === 'seconds') return l.sets.map(function (x) { return x.seconds; }).join(', ') + ' seconds';
  return l.sets.map(function (x) { return x.reps; }).join(', ') + ' reps';
}

/* ---------- the places that wait on engine additions (CONTRACT_CHANGES part B). Each is one helper so the next part switches it in one spot. ---------- */
/* B2: "raised since last time". The engine has no PlannedItem.change yet, so this returns null and every place that reads it stays hidden:
   the raised tags on home, the "Your coach raised N targets" line, the tags in Day detail, and on a cardio day the "Up from N min last time" line and its tag. */
function coachRaisedChange(it) { return it && it.change && it.change.direction ? { dir: it.change.direction, tag: it.change.tag, previous: it.change.previous || null } : null; }
/* the minutes a raised cardio goal came up from: B2's change.previous.minutes, else the last logged time */
function raisedFromMinutes(it, c) {
  var p = c && c.previous && c.previous.minutes, l = it && it.last && it.last.sets && it.last.sets[0];
  return +(p || (l && l.minutes) || 0);
}
/* the raised ChangeTag (COACH_SPEC 4): mint, arrow up, then "5 lb" / "1 rep" / "3 min" */
function upTag(c) { return '<span class="tag up" aria-label="raised">' + ic('up', 'i12') + esc(String(c.tag).replace(/^\+/, '')) + '</span>'; }
/* "From your numbers": the engine has no flag for it yet (APP_MAPPING names items[k].fromNumbers), so without the field it is read as a first-time lift the engine is not calibrating. */
function coachFromNumbers(it) {
  if (it && typeof it.fromNumbers === 'boolean') return it.fromNumbers && it.logType !== 'cardio';
  return !it.last && it.calibrating === false && it.logType !== 'cardio';
}

/* ---------- the week preview in setup and Edit my plan, from the engine's own layouts ---------- */
function previewIds(p) {
  var L = layoutFor(p.days), rot = L.rotation || [], k = 0;
  return (L.cycle || []).map(function (c) {
    if (c === 'training') { var r = rot[k % (rot.length || 1)] || {}; k++; return toneOfWorkout(r.workoutId); }
    if (c === 'x') return extraKind(p.goal) === 'cardio' ? 'cardio' : 'recover';
    return 'rest';
  });
}
function weekLine(p) {
  var x = extraKind(p.goal), nR = 7 - p.days - (p.days === 6 ? 0 : 1);
  return plural(p.days, 'training day') + (p.days === 6 ? '' : ', 1 ' + (x === 'cardio' ? 'cardio day' : 'recovery day')) + ' and ' + plural(nR, 'rest day') + '.';
}
function previewHTML(p) {
  var ids = previewIds(p), x = extraKind(p.goal), nR = 0;
  ids.forEach(function (w) { if (w === 'rest') nR++; });
  var extra = 7 - p.days - nR, txt = p.days + ' training' + (extra ? ' · 1 ' + (x === 'cardio' ? 'cardio' : 'recovery') : '') + ' · ' + nR + ' rest';
  return '<div class="preview" role="img" aria-label="Your week: ' + ids.map(function (w) { return SHORT[w]; }).join(', ') + '"><div class="cap"><b>Your week</b><span>' + txt + '</span></div><div class="pv">' +
    ids.map(function (w) { return '<div class="pd" data-tone="' + w + '"><span class="bub">' + ic(GLYPH[w]) + '</span><span class="nm">' + SHORT[w] + '</span></div>'; }).join('') + '</div></div>';
}

/* ---------- small view helpers ---------- */
function gem(tone, g, cls) { return '<span class="gem' + (cls ? ' ' + cls : '') + '" data-tone="' + tone + '">' + ic(g) + '</span>'; }
function iconBtn(a, v, icon, label, id) { return '<button class="iconbtn"' + (id ? ' id="' + id + '"' : '') + ' data-a="' + a + '"' + (v ? ' data-v="' + v + '"' : '') + ' aria-label="' + label + '"><span class="disc">' + ic(icon, 'i20') + '</span></button>'; }
function sampleTag() { return SAMPLE ? '<span class="sample" title="These numbers are sample data">Sample</span>' : ''; }
function subHdr(title, right) { return '<div class="hdr sub">' + iconBtn('back', '', 'chevL', 'Back') + '<h1 tabindex="-1" data-focus>' + title + '</h1>' + sampleTag() + '<span class="grow"></span>' + (right || '') + '</div>'; }
function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
function mixc(a, b, t) { var x = hex(a), y = hex(b); return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * t); }).join(',') + ')'; }
var SVGN = 0;
function stackSVG(plates, o) {
  o = o || {};
  var id = 'k' + (++SVGN), Wd = o.w || 300, H = o.h || 190, rx = o.rx || 92, u = o.u || 1, cx = Wd / 2, ry = rx * 0.27, yb = H - ry - 6 * u - (o.pad || 0);
  var defs = '', body = '', tones = {}, y = yb, i;
  function side(r, yt, t, fill, extra) { var q = r * 0.27; return '<path d="M' + (cx - r) + ' ' + yt + 'v' + t + 'a' + r + ' ' + q + ' 0 0 0 ' + (2 * r) + ' 0v' + (-t) + 'a' + r + ' ' + q + ' 0 0 1 ' + (-2 * r) + ' 0z" fill="' + fill + '"' + (extra || '') + '/>'; }
  defs += '<radialGradient id="' + id + 'f" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#6366F1" stop-opacity=".55"/><stop offset=".6" stop-color="#2DD4BF" stop-opacity=".16"/><stop offset="1" stop-color="#2DD4BF" stop-opacity="0"/></radialGradient>';
  defs += '<linearGradient id="' + id + 'r" x1="0" x2="1"><stop offset="0" stop-color="#6366F1"/><stop offset=".5" stop-color="#A855F7"/><stop offset="1" stop-color="#2DD4BF"/></linearGradient>';
  body += '<ellipse cx="' + cx + '" cy="' + yb + '" rx="' + rx * 1.5 + '" ry="' + ry * 1.7 + '" fill="url(#' + id + 'f)"/>';
  body += '<ellipse cx="' + cx + '" cy="' + yb + '" rx="' + rx * 1.16 + '" ry="' + ry * 1.16 + '" fill="rgba(11,15,26,.55)" stroke="url(#' + id + 'r)" stroke-width="' + Math.max(1.2, 1.8 * u) + '" opacity=".95"/>';
  if (o.ghost) {
    var gy = yb - 30 * u;
    body += '<g class="ghostp">' + side(rx, gy, 12 * u, 'rgba(255,255,255,.04)', ' stroke="rgba(240,244,255,.42)" stroke-width="1.5" stroke-dasharray="5 5"') +
      '<ellipse cx="' + cx + '" cy="' + gy + '" rx="' + rx + '" ry="' + ry + '" fill="rgba(255,255,255,.05)" stroke="rgba(240,244,255,.5)" stroke-width="1.5" stroke-dasharray="5 5"/>' +
      '<ellipse cx="' + cx + '" cy="' + gy + '" rx="' + rx * 0.16 + '" ry="' + ry * 0.16 + '" fill="none" stroke="rgba(240,244,255,.4)" stroke-width="1.2"/></g>';
  }
  if (o.base) {
    var bt = 13 * u, br = rx + 7 * u;
    defs += '<linearGradient id="' + id + 'b" x1="0" x2="1"><stop offset="0" stop-color="#1B2134"/><stop offset=".3" stop-color="#39415C"/><stop offset=".6" stop-color="#252C43"/><stop offset="1" stop-color="#161B2B"/></linearGradient>';
    body += side(br, y - bt, bt, 'url(#' + id + 'b)') + '<ellipse cx="' + cx + '" cy="' + (y - bt) + '" rx="' + br + '" ry="' + br * 0.27 + '" fill="#2D3550" stroke="rgba(255,255,255,.22)" stroke-width="1"/>';
    if (o.baseLabel) body += '<text x="' + cx + '" y="' + (y + br * 0.27 - 3) + '" text-anchor="middle" font-size="' + 11 * Math.max(1, u) + '" font-weight="700" fill="rgba(240,244,255,.62)" font-family="inherit" letter-spacing=".4">' + o.baseLabel + '</text>';
    y -= bt + 1.5;
  }
  plates.forEach(function (p, n) {
    var c = TONE[p.tone] || TONE.rest, light = p.kind && p.kind !== 'training', r = rx - (p.tone === 'core' ? 8 : light ? 15 : 0) * u - (n % 3 === 1 ? 2 * u : 0), t = clamp(Math.round((p.min || 40) / 45 * 10 * u), Math.round(5 * u), Math.round(12 * u)), yt = y - t;
    if (!tones[p.tone]) { tones[p.tone] = 1; defs += '<linearGradient id="' + id + p.tone + '" x1="0" x2="1"><stop offset="0" stop-color="' + mixc(c[0], '#0B0F1A', 0.5) + '"/><stop offset=".22" stop-color="' + c[1] + '"/><stop offset=".5" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + mixc(c[0], '#0B0F1A', 0.62) + '"/></linearGradient>'; }
    body += '<g class="plate' + (p.fresh ? ' fresh' : '') + '"' + (p.fresh ? ' style="filter:drop-shadow(0 0 ' + 9 * u + 'px ' + c[0] + ')"' : '') + '>' + side(r, yt, t, 'url(#' + id + p.tone + ')') +
      '<ellipse cx="' + cx + '" cy="' + yt + '" rx="' + r + '" ry="' + r * 0.27 + '" fill="' + mixc(c[0], c[1], 0.45) + '" stroke="' + c[1] + '" stroke-width="' + Math.max(0.8, u) + '"/>' +
      '<ellipse cx="' + cx + '" cy="' + yt + '" rx="' + r * 0.17 + '" ry="' + r * 0.17 * 0.27 + '" fill="' + mixc(c[0], '#0B0F1A', 0.72) + '"/></g>';
    y = yt - 1.5 * u;
  });
  return '<svg width="' + Wd + '" height="' + H + '" viewBox="0 0 ' + Wd + ' ' + H + '" aria-hidden="true" style="overflow:visible"><defs>' + defs + '</defs>' + body + '</svg>';
}

/* ---------- reading the coach for the screen ---------- */
var DAYS = [], ACTS = {}, TODAY_S = null, PROG = null;
function refresh() {
  WK = q('week', today());
  if (!WK.ok) WK = { hasPlan: false, days: [], todayActions: {}, thisWeek: { text: '' }, weeksOnPlan: 0 };
  DAYS = (WK.days || []).map(dayView);
  ACTS = WK.todayActions || {};
  var a = q('activeSession', today());
  ACTIVE = a.ok && a.active ? a.session : null;
  if (!ACTIVE && ACT) { ACT = null; writeActive(null); }
  TODAY_S = WK.hasPlan ? (q('session', today()).session || null) : null;
  PROG = q('progress', today());
}
function hasPlan() { return !!(WK && WK.hasPlan); }
function demoEntries() { var s = demo(); return (s && Array.isArray(s.worktimeLoggedToday)) ? s.worktimeLoggedToday : []; }
/* the same number Today shows as earned today (state.earnedMinutes), so the two tabs never disagree */
function earnedToday() { var s = demo(); return s ? Math.max(0, Math.round(+s.earnedMinutes || 0)) : 0; }
function shields() { var s = demo(); return s ? clamp(+s.streakShields || 0, 0, 2) : 0; }
function freeRun() { var s = demo(); return s && s.activeWorkout ? s.activeWorkout : null; }
function freeElapsed() { try { return typeof computeActiveWorkoutElapsedMs === 'function' ? computeActiveWorkoutElapsedMs() : 0; } catch (e) { return 0; } }
var FREE_ICON = { Walk: 'walk', Run: 'run', Lift: 'lift', Yoga: 'yoga', Cycle: 'cycle', Other: 'other' };
function freeIcon(name) { return FREE_ICON[name] || ('sprite:' + (typeof workoutGlyphId === 'function' ? workoutGlyphId(name) : 'i-move')); }

/* ---------- Coach home ---------- */
function strip() {
  var e = earnedToday(), sh = shields();
  return '<div class="strip"><button class="earn" data-a="sheet" data-v="earned" aria-label="' + e + ' minutes earned today. ' + sh + ' of 2 Shields. Open earned today">' +
    '<span class="l1">' + ic('bolt', 'i16 bolt') + '<span><b class="num">' + e + ' min</b> earned today</span></span>' +
    '<span class="l2">' + ic('shield', 'i14 sh') + '<span><b>' + sh + ' of 2</b> Shields' + (sh >= 2 ? ' · full' : '') + '</span></span>' + ic('chevR', 'i16 go') + '</button>' +
    '<button class="timer" id="cx-time-btn" data-a="sheet" data-v="time">' + ic('timer', 'i20') + '<span>Time a<br>workout</span></button></div>';
}
function quickGrid(otherId) {
  return '<div class="quick">' + [['Walk', 'walk'], ['Run', 'run'], ['Lift', 'lift'], ['Yoga', 'yoga'], ['Cycle', 'cycle'], ['Other', 'other']].map(function (x) {
    if (x[0] === 'Other') return '<button' + (otherId ? ' id="other-workout-tile"' : '') + ' data-a="other">' + ic(x[1], 'i28') + x[0] + '</button>';
    return '<button data-a="free" data-v="' + x[0] + '">' + ic(x[1], 'i28') + x[0] + '</button>';
  }).join('') + '</div>';
}
function heroTop(change) {
  return '<div class="hero-top"><span class="daychip">Today</span><span class="when">' + fmtD(coachToday()) + (hasPlan() && WK.weeksOnPlan > 0 ? ' · Week ' + WK.weeksOnPlan : '') + '</span>' + (change ? iconBtn('sheet', 'change', 'swap', 'Change today', 'cx-change-btn') : '') + '</div>';
}
function nextUpLine() {
  var i; for (i = 1; i < DAYS.length; i++) if (DAYS[i].kind !== 'rest') break;
  if (i >= DAYS.length) return '';
  var d = DAYS[i];
  return '<div class="ln" data-tone="' + d.tone + '">' + ic(d.g, 'i18') + '<span>Next up: <b>' + esc(d.title) + '</b> · ' + (i === 1 ? 'tomorrow' : DOW[dateOf(d.key).getDay()]) + '</span></div>';
}
/* compact screens: the start button is pinned above the tab bar instead of sitting at the end of the card */
function pinned(btn) { if (!COMPACT) return btn; PIN = btn; return ''; }
/* the day's start button shows only when the engine says today can start (APP_MAPPING: week.todayActions.canStart) */
function startBtn(label) { return ACTS.canStart ? pinned('<button class="btn btn-cta xl" data-a="start">' + ic('play') + label + '</button>') : ''; }
function raisedCount(items) { var n = 0; items.forEach(function (it) { var c = coachRaisedChange(it); if (c && c.dir === 'up') n++; }); return n; }
function firstWeekLine(items) {
  if ((WK.weeksOnPlan || 0) > 1) return '';
  var fr = items.filter(function (x) { return !x.last && x.logType !== 'cardio'; }), seed = fr.filter(coachFromNumbers).length, cal = fr.length - seed;
  if (!fr.length) return '';
  var t = !cal ? 'First week: targets start from your numbers.' : seed ? 'First week: some targets start from your numbers. Start light on the rest.' : 'First week: start light and find your level.';
  return '<p class="raised" style="color:var(--text-2)">' + ic('info', 'i14') + t + '</p>';
}
function anyChange() { var a = ACTS; return !!(a.canUndoChoice || UI.swapBase || (a.swapChoices && a.swapChoices.length) || a.canTakeRest || a.canTrain || a.canDoCardio); }
function doneEarned(key) {
  var r = (PROG && PROG.recent || []).filter(function (x) { return x.day === key && x.kind !== 'free'; })[0];
  return r ? Math.round((r.durationMinutes || 0) * rate()) : 0;
}
function hero(t) {
  var run = !!ACTIVE, items = (TODAY_S && TODAY_S.items) || [], h = '';
  var fine = '<p class="fine">' + ic('bolt', 'i14') + '<span>' + esc(rateLine()) + '</span></p>';
  var resume = run ? '<button class="btn btn-cta xl" data-a="resume">' + ic('play') + '<span>Back to ' + esc(dispTitle(ACTIVE.title).toLowerCase()) + '</span></button>' : '';
  if (t.done) {
    return '<section class="hero" data-tone="done">' + ic('check', 'mark') + heroTop(false) +
      '<div class="hero-title">' + gem('done', 'check', 'lg lit') + '<h2 class="sm">' + esc(t.title) + '</h2><span class="donebadge" style="margin-left:auto">' + ic('check', 'i14') + 'Done</span></div>' +
      '<p class="hero-sub">' + esc(t.summary.replace(/^Done · /, '')) + '</p><div class="lines"><div class="ln">' + ic('bolt', 'i18') + '<span><b>+' + doneEarned(t.key) + ' min</b> of scroll time earned</span></div>' + nextUpLine() + '</div>' +
      '<button class="btn btn-secondary" data-a="open-summary">See summary</button><div class="btnrow" style="margin-top:6px"><button class="btn btn-ghost" data-a="free" data-v="Walk">' + ic('walk') + 'Time a walk</button></div></section>';
  }
  if (t.kind === 'training') {
    var up = raisedCount(items), rows = items.slice(0, 3).map(function (it, i) {
      var c = coachRaisedChange(it);
      return '<div class="xrow"><span class="n">' + (i + 1) + '</span><span class="nm">' + esc(it.name) + '</span><span class="tg">' + tShort(it) + (c && c.dir === 'up' ? upTag(c) : '') + '</span></div>';
    }).join('');
    h = '<section class="hero" data-tone="' + t.tone + '">' + ic(t.g, 'mark') + heroTop(!run && anyChange()) +
      '<div class="hero-title">' + gem(t.tone, t.g, 'lg lit') + '<h2>' + esc(t.title) + '</h2></div>' +
      '<p class="hero-sub">' + esc(t.desc) + ' · about ' + (TODAY_S ? TODAY_S.aboutMinutes : t.raw.aboutMinutes) + ' min</p>' +
      (up ? '<p class="raised">' + ic('up', 'i14') + 'Your coach raised ' + plural(up, 'target') + ' since last time</p>' : firstWeekLine(items)) +
      '<div class="xlist">' + rows + '</div>' +
      (items.length > 3 ? '<button class="xmore" data-a="sheet" data-v="list">+ ' + (items.length - 3) + ' more · see all ' + items.length + ' exercises' + ic('chevR', 'i14') + '</button>' : '') +
      (resume || startBtn('Start workout')) + fine + '</section>';
    return h;
  }
  if (t.kind === 'cardio') {
    var it = items[0] || { name: 'Cardio', target: { minutes: t.raw.aboutMinutes } }, cc = coachRaisedChange(it), cup = !!(cc && cc.dir === 'up'), from = cup ? raisedFromMinutes(it, cc) : 0;
    return '<section class="hero" data-tone="cardio">' + ic('heart', 'mark') + heroTop(!run && anyChange()) +
      '<div class="hero-title">' + gem('cardio', 'heart', 'lg lit') + '<h2>' + esc(t.title) + '</h2></div><p class="hero-sub">' + esc(t.desc) + '</p>' +
      (cup && from ? '<p class="raised">' + ic('up', 'i14') + 'Up from ' + from + ' min last time</p>' : '') +
      '<div class="lines"><div class="ln two">' + ic('timer', 'i18') + '<span><b>' + esc(it.name) + '</b><small>Goal ' + ((it.target && it.target.minutes) || 0) + ' min</small></span>' + (cup ? upTag(cc) : '') + '</div>' +
      '<div class="ln">' + ic('info', 'i18') + '<span>Logged by time. Distance is optional.</span></div></div>' +
      (resume || startBtn('Start cardio')) + fine + '</section>';
  }
  if (t.kind === 'recovery') {
    var mins = 0; items.forEach(function (x) { mins += (x.target && x.target.minutes) || 0; });
    return '<section class="hero" data-tone="recover">' + ic('leaf', 'mark') + heroTop(!run && anyChange()) +
      '<div class="hero-title">' + gem('recover', 'leaf', 'lg lit') + '<h2 class="sm">' + esc(t.title) + '</h2></div><p class="hero-sub">' + esc(t.desc) + ' · ' + mins + ' min</p>' +
      '<div class="lines">' + items.map(function (x) { return '<div class="ln">' + ic(x.exerciseId === 'easyWalk' ? 'walk' : 'yoga', 'i18') + '<span><b>' + esc(x.name) + '</b> · <span class="nw">' + ((x.target && x.target.minutes) || 0) + ' min</span></span></div>'; }).join('') + '</div>' +
      (resume || startBtn('Start recovery')) +
      '<p class="fine">' + ic('bolt', 'i14') + 'Easy minutes earn scroll time too.</p></section>';
  }
  /* rest day */
  var a = ACTS, f = freeRun();
  var stars = '<svg class="stars" viewBox="0 0 314 120" aria-hidden="true">' + [[206, 22, 1.6], [236, 58, 1.1], [268, 30, 1.9], [188, 64, 1], [292, 78, 1.3], [250, 96, 1], [168, 30, 1.2]].map(function (x) { return '<circle cx="' + x[0] + '" cy="' + x[1] + '" r="' + x[2] + '"/>'; }).join('') + '</svg>';
  h = '<section class="hero" data-tone="rest">' + stars + ic('moon', 'mark') + heroTop(!!(a.canUndoChoice || UI.swapBase)) +
    '<div class="hero-title">' + gem('rest', 'moon', 'lg lit') + '<h2>Rest day</h2></div><p class="hero-sub">' + esc(t.desc) + (t.chosen ? ' <b>' + esc(t.summary) + '.</b>' : '') + '</p>' +
    '<div class="lines"><div class="ln">' + ic('walk', 'i18') + '<span>Optional: <b>a 10-minute easy walk</b></span></div>' + nextUpLine() + '</div>' +
    (f ? '<button class="btn btn-cta xl" data-a="resume-free">' + ic('play') + '<span>Back to your ' + esc(String(f.name).toLowerCase()) + '</span></button>' : '<button class="btn btn-cta xl" data-a="free" data-v="Walk:10">' + ic('walk') + 'Start a 10-min walk</button>');
  if (a.canUndoChoice) h += '<div class="btnrow" style="margin-top:8px"><button class="btn btn-ghost" data-a="undo-choice">' + ic('undo') + 'Undo rest day</button></div>';
  else {
    if (a.canTrain || a.canDoCardio) h += '<div class="btnrow" style="margin-top:8px">' + (a.canTrain ? '<button class="btn btn-ghost" data-a="train-today">Train today instead</button>' : '') + (a.canDoCardio ? '<button class="btn btn-ghost" data-a="cardio-today">Do cardio today</button>' : '') + '</div>';
    if (a.trainNote) h += '<div class="callout calm" style="margin-top:6px">' + ic('info', 'i18') + '<span>' + esc(a.trainNote) + '</span></div>';
  }
  return h + '<p class="fine">Rest is part of the plan.</p></section>';
}
function heroFirst() {
  return '<section class="hero" data-tone="brand">' + ic('lift', 'mark') +
    '<div class="hero-title" style="margin-top:8px">' + gem('brand', 'lift', 'lg lit') + '<h2 class="sm">Meet your coach</h2></div>' +
    '<p class="hero-sub">Answer 6 quick questions and get a week of workouts built for you. It sets your next targets from what you log.</p>' +
    '<button class="btn btn-cta xl" id="cx-build-btn" data-a="open-setup">Build my plan</button><p class="fine">Takes about a minute.</p></section>' +
    '<div class="secrow"><span class="label">Or just time a workout</span></div><div class="mx">' + quickGrid(true) + '</div>' +
    '<p class="note mx" style="margin-top:12px;text-align:center">' + esc(rateLine()) + '</p>';
}
function dayBub(d) {
  return '<button class="day' + (d.i === 0 ? ' now' : '') + (d.done ? ' done' : '') + '" data-tone="' + d.tone + '" data-a="day" data-v="' + d.i + '" aria-label="' + dayName(d.key, d.i) + ', ' + fmtS(d.key) + ': ' + esc(d.title) + (d.done ? ', done' : '') + '">' +
    '<span class="dw">' + (d.i === 0 ? 'Today' : DOW[dateOf(d.key).getDay()]) + '</span><span class="bub">' + ic(d.done ? 'check' : d.g) + '</span><span class="nm">' + d.s + '</span></button>';
}
function platesFrom(list) { return list.filter(function (r) { return r.kind !== 'free'; }).map(function (r) { return { tone: r.kind === 'recovery' ? 'recover' : toneOf(r.focus), min: r.durationMinutes, kind: r.kind }; }); }
function vHome() {
  var h = strip();
  if (!hasPlan()) return h + heroFirst();
  var P = PROG && PROG.ok ? PROG : { recent: [], hasData: false, pounds: {} }, wtext = (WK.thisWeek && WK.thisWeek.text) || '';
  h += hero(DAYS[0]);
  h += '<div class="secrow"><span class="label">Next 7 days</span><button class="link" data-a="nav" data-v="week">Full plan' + ic('chevR', 'i16') + '</button></div>';
  h += '<div class="days">' + DAYS.map(dayBub).join('') + '</div><p class="waitnote">' + ic('info', 'i14') + esc(wtext) + ' · Missed days wait for you.</p>';
  var mini = platesFrom((P.recent || []).slice(0, 6).reverse());
  h += '<div class="secrow"><span class="label">Progress</span></div><button class="door" data-a="nav" data-v="progress"><span class="art">' + stackSVG(mini, { w: 76, h: 64, rx: 26, u: 0.5, ghost: !mini.length }) + '</span>' +
    '<span><h3>Your progress' + (SAMPLE ? ' <span class="sample" style="margin-left:6px;vertical-align:2px">Sample</span>' : '') + '</h3><p>' + (P.hasData ? plural(P.workoutsCompleted || 0, 'workout') + ' so far · ' + ((P.pounds && P.pounds.lifetime) ? nf(P.pounds.thisWeek || 0) + ' lb this week' : esc(wtext)) : 'Your first workout sets down the first plate.') + '</p></span>' + ic('chevR', 'i16 go') + '</button>';
  h += '<div class="btnrow" style="margin-top:14px"><button class="btn btn-ghost quiet" data-a="open-edit">' + ic('edit') + 'Edit my plan</button></div>';
  return h;
}

/* ---------- sheets ---------- */
function shell(title, body, o) {
  o = o || {};
  return '<div class="scrim" data-a="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + title.replace(/<[^>]+>/g, '') + '" tabindex="-1"' + (o.tone ? ' data-tone="' + o.tone + '"' : '') + '><div class="grab"></div>' +
    '<div class="shead"><h2>' + title + '</h2>' + (o.sample ? sampleTag() : '') + '<span class="grow"></span>' + iconBtn('close', '', 'x', 'Close') + '</div><div class="sb">' + body + '</div></div>';
}
var HEALTH_NOTE = '<div class="callout calm" style="margin-top:12px"><span class="hl">' + ic('heart', 'i18') + '</span><span>Steps don\'t count - real workouts do. Timed here, plus workouts Apple Health already has from your Watch or other apps.</span></div>';
var WATCH_NOTE = '<div class="callout calm" style="margin-top:12px">' + ic('watch', 'i18') + '<span>Already tracking on your Watch? No need to time it here too.</span></div>';
function whenText(at) {
  if (!at) return '';
  var m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return 'just now';
  var d = new Date(at), h = d.getHours(), mm = d.getMinutes();
  return ((h % 12) || 12) + ':' + pad(mm) + ' ' + (h < 12 ? 'AM' : 'PM');
}
function earnedSub(x) {
  if (x.kind === 'coach') return 'Coach workout · ' + whenText(x.at);
  if (x.kind === 'timed') return 'Timed workout · ' + whenText(x.at);
  return 'Logged today';
}
function shEarned() {
  var e = earnedToday(), sh = shields(), full = sh >= 2, rows = demoEntries().map(function (x) {
    var coach = x.kind === 'coach';
    return '<div class="erow"><span class="symtile' + (coach ? ' indigo' : '') + '">' + ic(coach ? 'lift' : freeIcon(x.label), 'i20') + '</span><div><h3>' + esc(x.label) + '</h3><p>' + esc(earnedSub(x)) + '</p></div><span class="amt">+' + Math.round(+x.earned || 0) + ' min</span></div>'; }).join('');
  return shell('Earned today', '<div class="bigearn"><b>' + e + ' min</b><span>of scroll time earned today</span></div>' +
    '<p class="note" style="text-align:center;margin-top:8px">' + esc(rateLine()) + ' Reps and pounds never change what you earn.</p>' +
    '<span class="label">Earned today</span><div class="card" style="padding:4px 14px">' + (rows || '<p class="note" style="padding:16px 0;text-align:center">Nothing yet today - log a workout to earn time.</p>') + '</div>' +
    '<span class="label">Streak Shield</span><div class="card shield' + (full ? ' full' : '') + '" style="padding:14px 16px"><span class="symtile">' + ic('shield', 'i20') + '</span><h3>' + (full ? 'Shields full' : 'Streak Shield') + '</h3><span class="cnt">' + sh + ' of 2</span>' +
    '<p>' + (full ? 'You hold 2 of 2, the most you can bank. A Shield auto-saves your streak if you miss a day.' : 'Log a 30-min workout to bank one (max 2). It auto-saves your streak if you miss a day.') + '</p></div>' + HEALTH_NOTE +
    '<div class="stack"><button class="btn btn-secondary" data-a="sheet" data-v="time">' + ic('timer') + 'Time a workout</button></div>', { sample: SAMPLE });
}
function shTime() {
  return shell('Time a workout', '<p class="lead">Pick one and the timer starts. ' + esc(rateLine()) + '</p><div style="margin-top:14px">' + quickGrid(false) + '</div>' + WATCH_NOTE);
}
function optNav(a, v, tone, g, title, sub) {
  return '<button class="opt" data-a="' + a + '"' + (v !== '' ? ' data-v="' + esc(v) + '"' : '') + '>' + gem(tone, g, 'sm') + '<span><h3>' + esc(title) + '</h3><p>' + esc(sub) + '</p></span>' + ic('chevR', 'i16 go') + '</button>';
}
/* a look at what an option would give, on a copy that is never kept */
function peekDay(op, input) { var r = exec(op, input); if (!r.result || !r.result.ok) return null; var w = q('week', today(), r.state); return w.ok && w.days ? dayView(w.days[0], 0) : null; }
function baseDay() {
  if (UI.swapBase) { var b = peekDay('swapWorkout', { today: coachToday(), workoutId: UI.swapBase }); if (b) return b; }
  if (ACTS.canUndoChoice) { var c = peekDay('clearTodayChoice', today()); if (c) return c; }
  return DAYS[0];
}
function shChange() {
  var a = ACTS, t = DAYS[0], b = '', more = '', base = baseDay();
  var changed = !!(a.canUndoChoice || UI.swapBase);
  if (changed && base) b += '<div class="stack" style="margin-top:4px">' + optNav('undo-choice', '', base.tone, base.g, 'Back to ' + base.title.toLowerCase(), 'Undo today\'s change') + '</div>';
  var ch = (a.swapChoices || []).filter(function (c) { return c.workoutId !== t.wid; });
  if (ch.length) b += '<span class="label">Do a different workout today</span><div class="stack" style="margin-top:0">' + ch.map(function (c) {
    var tone = toneOf(c.focus), p = peekDay('swapWorkout', { today: coachToday(), workoutId: c.workoutId });
    return optNav('swap-day', c.workoutId, tone, GLYPH[tone], dispTitle(c.title), p ? p.desc : ''); }).join('') + '</div>';
  else if (t.kind === 'training' && !changed) b += '<div class="callout calm" style="margin-top:4px">' + ic('info', 'i18') + '<span>No other workout fits today. The others would work the same muscles two days in a row.</span></div>';
  if (a.canTrain) { var nt = peekDay('trainToday', { today: coachToday(), choice: 'training' }); if (nt) more += optNav('train-today', '', nt.tone, nt.g, 'Train today instead', nt.title + ' · your next workout'); }
  if (a.canDoCardio) more += optNav('cardio-today', '', 'cardio', 'heart', 'Do cardio today', 'Steady cardio, logged by time');
  if (a.canTakeRest) more += optNav('rest-today', '', 'rest', 'moon', 'Take a rest day', t.kind === 'training' ? t.title + ' moves to your next training day' : 'Your plan carries on tomorrow');
  if (more) b += '<span class="label">' + (ch.length ? 'Or' : 'Change today') + '</span><div class="stack" style="margin-top:0">' + more + '</div>';
  if (a.trainNote) b += '<div class="callout calm" style="margin-top:12px">' + ic('info', 'i18') + '<span>' + esc(a.trainNote) + '</span></div>';
  if (a.restNote) b += '<div class="callout calm" style="margin-top:12px">' + ic('info', 'i18') + '<span>' + esc(a.restNote) + '</span></div>';
  return shell('Change today', b + '<p class="note" style="margin-top:14px;text-align:center">Nothing is lost. Missed days wait for you.</p><div class="btnrow" style="margin-top:4px"><button class="btn btn-ghost quiet" data-a="open-edit">' + ic('edit') + 'Edit my plan</button></div>');
}
function dayItems(d, isToday) {
  if (isToday) return (TODAY_S && TODAY_S.items) || [];
  var s = q('session', { today: coachToday(), day: d.key });
  return (s.ok && s.session && s.session.items) || [];
}
function dayBody(d, isToday) {
  var items = dayItems(d, isToday), h = '<div class="dayhead">' + gem(d.done ? 'done' : d.tone, d.done ? 'check' : d.g, 'lg lit') + '<div><h3>' + esc(d.title) + '</h3><p>' + esc(d.desc) + '</p></div></div>';
  if (items.length) h += '<div class="card" style="padding:4px 14px;margin-top:14px">' + items.map(function (it, i) {
    var c = coachRaisedChange(it);
    return '<div class="lrow"><span class="n">' + (i + 1) + '</span><span><h3>' + esc(it.name) + '</h3><p>' + (it.last ? 'Last time ' + lastText(it) : it.logType === 'cardio' ? 'Logged by time' : coachFromNumbers(it) ? 'From your numbers' : it.calibrating ? 'First time - start light' : 'First time') + '</p></span>' +
      '<span class="tg">' + tShort(it) + (c && c.dir !== 'same' ? '<br><span class="tag ' + c.dir + '">' + esc(c.tag) + '</span>' : '') + '</span></div>'; }).join('') + '</div>';
  else h += '<div class="callout calm" style="margin-top:14px">' + ic('walk', 'i18') + '<span>Rest is part of the plan. Optional: a 10-minute easy walk.</span></div>';
  if (!isToday && d.kind === 'training') h += '<p class="note" style="margin-top:12px;text-align:center">Targets come from your last workout and can change before this day.</p>';
  if (isToday && d.kind === 'training' && !d.done && TODAY_S && TODAY_S.tips && TODAY_S.tips.length) h += '<div class="callout calm" style="margin-top:12px">' + ic('info', 'i18') + '<span>' + esc(TODAY_S.tips.join(' ')) + '</span></div>';
  if (isToday && d.done) h += '<div class="stack"><button class="btn btn-secondary" data-a="open-summary">See summary</button></div>';
  else if (isToday && d.kind !== 'rest' && (ACTIVE || ACTS.canStart)) h += '<div class="stack">' + (ACTIVE ? '<button class="btn btn-cta" data-a="resume">' + ic('play') + 'Back to workout</button>' : '<button class="btn btn-cta" data-a="start">' + ic('play') + (d.kind === 'training' ? 'Start workout' : d.kind === 'cardio' ? 'Start cardio' : 'Start recovery') + '</button>') + '</div>';
  else if (isToday) h += '<div class="stack"><button class="btn btn-secondary" data-a="free" data-v="Walk:10">' + ic('walk') + 'Start a 10-min walk</button></div>';
  return h;
}
function shDay(i) { var d = DAYS[i] || DAYS[0]; return shell(d.i < 2 ? dayName(d.key, d.i) : fmtD(d.key), dayBody(d, d.i === 0), { tone: d.done ? 'done' : d.tone, sample: SAMPLE }); }

/* ---------- setup, Edit my plan and Your numbers ---------- */
var DEFAULT_PROFILE = { goal: 'buildMuscle', exp: 'new', days: 4, equip: 'fullGym', mins: 45, bodyWeight: 0, anchors: [] };
var GOALS = { buildMuscle: ['Build muscle', 'More sets in the 8 to 12 range', 'lift'], getStronger: ['Get stronger', 'Heavier sets of 4 to 6', 'up'], loseFat: ['Lose fat', 'Lifting plus steady cardio', 'run'], stayFit: ['Stay fit', 'A balanced week', 'heart'], buildEndurance: ['Build endurance', 'Lighter sets, more cardio', 'timer'] };
var GOAL_IDS = ['buildMuscle', 'getStronger', 'loseFat', 'stayFit', 'buildEndurance'];
var EXPS = [['new', 'New to lifting', 'Less than 6 months of regular lifting'], ['some', 'Some experience', 'You know the main lifts'], ['exp', 'Experienced', 'A year or more of steady training']];
var EQUIPS = [['fullGym', 'Full gym', 'Barbells, machines, cables and dumbbells', 'lift'], ['dumbbells', 'Dumbbells at home', 'A pair or two of dumbbells', 'home'], ['bodyweight', 'Bodyweight only', 'No equipment at all', 'figure']];
var SIZE = { 30: 4, 45: 5, 60: 6 }, XI = { 'new': 0, some: 1, exp: 2 };
var NOTE_START = 'Start light - your coach finds your level in the first week.';
var DISCLAIMER = 'This is general fitness guidance, not medical advice. Check with a doctor before starting a new program.';
function anchorIds(equip) { var a = catalog().anchors || {}; return a[equip] || []; }
/* the body weight field takes 50 to 700 lb (COACH_SPEC 5.16); a value outside that is not saved, so it is not counted either */
function bwValid(n) { return n >= 50 && n <= 700; }
function toProfile(d) {
  var p = { goal: d.goal, experience: d.exp === 'exp' ? 'experienced' : d.exp, daysPerWeek: d.days, equipment: d.equip, sessionMinutes: d.mins,
    anchors: d.anchors.map(function (a) { var o = { exerciseId: a.id, reps: a.r }; if (exInfo(a.id).logType === 'weightReps') o.weight = a.w; return o; }) };
  if (bwValid(d.bodyWeight)) p.bodyWeight = d.bodyWeight;
  return p;
}
function fromProfile(p) {
  if (!p) return copy(DEFAULT_PROFILE);
  return { goal: p.goal, exp: p.experience === 'experienced' ? 'exp' : p.experience, days: p.daysPerWeek, equip: p.equipment, mins: p.sessionMinutes, bodyWeight: p.bodyWeight || 0,
    anchors: (p.anchors || []).map(function (a) { return { id: a.exerciseId, w: a.weight || 0, r: a.reps }; }) };
}
function optRow(field, val, on, icon, title, sub) {
  return '<button class="opt' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-a="set" data-v="' + field + ':' + val + '">' + (icon ? '<span class="sym">' + ic(icon) + '</span>' : '<span></span>') +
    '<span><h3>' + title + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</span><span class="radio">' + ic('check', 'i14') + '</span></button>';
}
function miniStep(key, val, unit, label) {
  return '<div class="ministep"><button data-a="astep" data-v="' + key + ':-1" aria-label="Less ' + label + '">' + ic('minus', 'i20') + '</button><div class="mv" aria-live="polite">' + val + '<small>' + unit + '</small></div>' +
    '<button data-a="astep" data-v="' + key + ':1" aria-label="More ' + label + '">' + ic('plus', 'i20') + '</button></div>';
}
function numbersHTML(d) {
  var h = '<div class="numrow"><div><h3>Body weight</h3><p>Optional. For your records - it does not change your plan.</p></div>' +
    '<label class="bwin"><input id="cx-bw" type="text" inputmode="numeric" maxlength="3" autocomplete="off" value="' + (d.bodyWeight || '') + '" placeholder="Add" aria-label="Body weight in pounds, optional"><span>lb</span></label></div>';
  anchorIds(d.equip).forEach(function (id) {
    var a = d.anchors.filter(function (x) { return x.id === id; })[0], m = exInfo(id), w = m.logType === 'weightReps';
    h += '<div class="numrow"><div><h3>' + esc(m.name) + '</h3><p>' + (a ? (w ? a.w + ' lb for ' + plural(a.r, 'rep') + (m.perHand ? ' · each hand' : '') : plural(a.r, 'rep') + ' in one set') : 'Not set') + '</p></div>' +
      '<button class="pill" data-a="anchor" data-v="' + id + '" aria-label="' + (a ? 'Remove ' : 'Add ') + esc(m.name) + '">' + (a ? 'Remove' : ic('plus') + 'Add') + '</button>' +
      (a ? '<div class="two">' + (w ? miniStep('w:' + id, a.w, 'lb', 'weight') : '') + miniStep('r:' + id, a.r, 'reps', 'reps') + '</div>' + (m.perHand ? '<p class="note" style="grid-column:1/-1;margin-top:6px">Enter the weight of one dumbbell.</p>' : '') : '') + '</div>';
  });
  return h;
}
function vSetup() {
  var st = UI.setup, d = st.d, n = st.step, body = '', i, bar = '', foot;
  for (i = 0; i < 6; i++) bar += '<i' + (i <= n ? ' class="on"' : '') + '></i>';
  if (n === 6) {
    return '<div class="scr cover"><div class="scroll"><div class="hdr sub" style="padding-left:20px;min-height:44px"></div>' +
      '<div class="q" style="margin-top:0"><span class="donebadge">' + ic('check', 'i14') + 'All set</span><h2 style="margin-top:10px" tabindex="-1" data-focus>Your plan is ready</h2>' +
      '<p>' + weekLine(d).replace('.', '') + ', ' + readyMinutes(d) + ' each. Your coach sets every next target from what you log.</p></div>' +
      '<div class="planlist">' + DAYS.map(function (x) { return '<div class="prow" data-tone="' + x.tone + '">' + gem(x.tone, x.g, x.i === 0 ? 'lit' : '') + '<div><span class="dw">' + dayName(x.key, x.i) + ' · ' + fmtS(x.key) + '</span><h3>' + esc(x.title) + '</h3><p>' + esc(x.summary) + '</p></div></div>'; }).join('') + '</div>' +
      planNote() +
      '<p class="note mx" style="margin-top:12px;text-align:center">Missed days wait for you. You can edit your plan any time without losing history.</p></div>' +
      '<div class="foot">' + (d.anchors.length ? '' : '<p class="fineprint">' + NOTE_START + '</p>') + '<button class="btn btn-cta xl" data-a="setup-done">See today\'s workout</button></div></div>';
  }
  if (n === 0) body = '<div class="q"><h2 tabindex="-1" data-focus>What is your main goal?</h2><p>This sets your reps, your rest times and your extra day.</p></div><div class="opts" role="radiogroup" aria-label="Main goal">' +
    GOAL_IDS.map(function (g) { return optRow('goal', g, d.goal === g, GOALS[g][2], GOALS[g][0], GOALS[g][1]); }).join('') + '</div>';
  if (n === 1) body = '<div class="q"><h2 tabindex="-1" data-focus>How much lifting have you done?</h2><p>This picks your starting weights. Your coach adjusts them as you log.</p></div><div class="opts" role="radiogroup" aria-label="Experience">' +
    EXPS.map(function (e) { return optRow('exp', e[0], d.exp === e[0], '', e[1], e[2]); }).join('') + '</div>';
  if (n === 2) body = '<div class="q"><h2 tabindex="-1" data-focus>How many days a week can you train?</h2><p>Pick what you can really keep up. You can change it later.</p></div>' +
    '<div class="daystep"><button class="stepbtn" data-a="set" data-v="days:-1" aria-label="Fewer days"' + (d.days <= 2 ? ' disabled' : '') + '>' + ic('minus') + '</button><div class="v" aria-live="polite">' + d.days + '<small>days a week</small></div>' +
    '<button class="stepbtn" data-a="set" data-v="days:1" aria-label="More days"' + (d.days >= 6 ? ' disabled' : '') + '>' + ic('plus') + '</button></div>' +
    '<p class="hsub" style="margin-top:14px;text-align:center">' + weekLine(d) + '</p><p class="note mx" style="margin-top:8px;text-align:center">Your week is a rotation, not a calendar. Missed days wait for you.</p>';
  if (n === 3) body = '<div class="q"><h2 tabindex="-1" data-focus>What can you train with?</h2><p>Your coach only picks moves you can do with this.</p></div><div class="opts" role="radiogroup" aria-label="Equipment">' +
    EQUIPS.map(function (e) { return optRow('equip', e[0], d.equip === e[0], e[3], e[1], e[2]); }).join('') + '</div>';
  if (n === 4) body = '<div class="q"><h2 tabindex="-1" data-focus>How long is each workout?</h2><p>Longer workouts get more exercises.</p></div><div class="opts" role="radiogroup" aria-label="Workout length">' +
    [30, 45, 60].map(function (m) { return optRow('mins', m, d.mins === m, 'clock', m + ' min', SIZE[m] + ' exercises'); }).join('') + '</div>';
  if (n === 5) body = '<div class="q"><h2 tabindex="-1" data-focus>Know your numbers?</h2><p>Optional. Add a lift you know and your coach starts you closer to your level.</p></div>' +
    '<div class="card mx" style="margin-top:14px;padding:4px 16px">' + numbersHTML(d) + '</div>' +
    (d.anchors.length ? '' : '<div class="callout calm mx" style="margin-top:12px">' + ic('info', 'i18') + '<span>' + NOTE_START + '</span></div>');
  foot = '<p class="fineprint">' + DISCLAIMER + '</p><button class="btn btn-cta" data-a="setup-next">' + (n < 5 ? 'Next' : d.anchors.length ? 'Build my plan' : 'Skip and build my plan') + '</button>';
  return '<div class="scr cover"><div class="scroll"><div class="hdr sub">' + iconBtn('setup-back', '', n ? 'chevL' : 'x', n ? 'Back' : 'Close setup') + '<div class="steps" role="img" aria-label="Question ' + (n + 1) + ' of 6">' + bar + '</div>' +
    '<span class="stepn">' + (n + 1) + ' of 6</span></div>' + previewHTML(d) + body + '</div><div class="foot">' + foot + '</div></div>';
}
/* "about {45} min each" on the ready screen is the chosen workout length as the engine stored it (APP_MAPPING row 117: profile.sessionMinutes);
   the draft's answer is only the fallback */
function readyMinutes(d) { return 'about ' + ((WK && WK.profile && WK.profile.sessionMinutes) || d.mins) + ' min'; }
/* the engine's own note (week.planNote, only for a new lifter on 5 or 6 days) as a calm callout under the plan */
function planNote() { return WK && WK.planNote ? '<div class="callout calm mx" id="cx-plan-note" style="margin-top:12px">' + ic('info', 'i18') + '<span>' + esc(WK.planNote) + '</span></div>' : ''; }
/* compared as the engine would store them, so a body weight under 50 (never saved) does not count as a change */
function editChanged() { return JSON.stringify(toProfile(UI.edit.d)) !== JSON.stringify(toProfile(UI.edit.o)); }
function vEdit() {
  var d = UI.edit.d, ch = editChanged(), n = d.anchors.length + (bwValid(d.bodyWeight) ? 1 : 0);
  function chips(field, list, cur, label) { return '<div class="chips" role="radiogroup" aria-label="' + label + '">' + list.map(function (o) { return '<button role="radio" aria-checked="' + (cur === o[0]) + '" class="' + (cur === o[0] ? 'on' : '') + '" data-a="set" data-v="' + field + ':' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>'; }
  function seg(field, list, cur, suf, label) { return '<div class="seg" role="radiogroup" aria-label="' + label + '">' + list.map(function (o) { return '<button role="radio" aria-checked="' + (cur === o) + '" class="' + (cur === o ? 'on' : '') + '" data-a="set" data-v="' + field + ':' + o + '">' + o + (suf || '') + '</button>'; }).join('') + '</div>'; }
  return '<div class="scr cover"><div class="scroll">' + subHdr('Edit my plan') + previewHTML(d) +
    '<p class="note mx" style="margin-top:8px;text-align:center">' + weekLine(d) + '</p>' +
    '<div class="field"><span class="label">Goal</span>' + chips('goal', GOAL_IDS.map(function (g) { return [g, GOALS[g][0]]; }), d.goal, 'Goal') + '</div>' +
    '<div class="field"><span class="label">Days a week</span>' + seg('daysv', [2, 3, 4, 5, 6], d.days, '', 'Days a week') + '</div>' +
    '<div class="field"><span class="label">Workout length</span>' + seg('mins', [30, 45, 60], d.mins, ' min', 'Workout length') + '</div>' +
    '<div class="field"><span class="label">Equipment</span>' + chips('equip', EQUIPS, d.equip, 'Equipment') + '</div>' +
    '<div class="field"><span class="label">Experience</span>' + chips('exp', EXPS, d.exp, 'Experience') + '</div>' +
    '<div class="field"><span class="label">Your numbers</span><button class="opt" data-a="sheet" data-v="numbers"><span class="sym">' + ic('edit') + '</span><span><h3>Body weight and main lifts</h3><p>' + (n ? plural(n, 'number') + ' saved' : 'Optional · none saved') + '</p></span>' + ic('chevR', 'i16 go') + '</button></div>' +
    '<p class="note mx" style="margin-top:16px;text-align:center">Your history and records stay. ' + DISCLAIMER + '</p></div>' +
    '<div class="foot"><button class="btn btn-cta" data-a="edit-save"' + (ch ? '' : ' disabled') + '>' + (ch ? 'Save changes' : 'No changes yet') + '</button></div></div>';
}
function shNumbers() {
  return shell('Your numbers', '<p class="lead">Optional. A lift you know helps your coach start you closer to your level.</p><div class="card" style="padding:4px 16px;margin-top:12px">' + numbersHTML(UI.edit.d) + '</div>' +
    '<p class="note" style="margin-top:12px;text-align:center">Lifts you have already logged keep their own targets.</p><div class="stack"><button class="btn btn-secondary" data-a="close">Done</button></div>');
}

/* ---------- the free timer cover ---------- */
function soFar(ms) { return '+' + Math.round(Math.floor(ms / 60000) * rate()) + ' min earned so far'; }
function vFree() {
  var f = freeRun(); if (!f) return '';
  var paused = !!f.pausedAt, el = freeElapsed();
  return '<div class="sess" data-tone="brand"><div class="stop">' + iconBtn('free-min', '', 'chevD', 'Minimize. Your timer keeps running') +
    '<div class="mid"><span class="dn" tabindex="-1" data-focus><i' + (paused ? ' class="paused"' : '') + '></i>' + esc(f.name) + (paused ? ' · paused' : '') + '</span></div><span></span></div>' +
    '<div class="cardio-mid">' + gem('brand', freeIcon(f.name), 'xl lit') + '<span class="freeclock" data-clk role="timer" aria-label="Time moved">' + clock(el / 1000) + '</span>' +
    '<div class="sofar" style="margin-top:0"><span class="chip">' + ic('bolt', 'i12') + '<span data-sofar>' + soFar(el) + '</span></span></div>' +
    (f.goal ? '<p>Goal: an easy ' + f.goal + ' minutes. Stop whenever you like.</p>' : '<p>' + esc(rateLine()) + '</p>') +
    '<p class="note" style="display:flex;gap:8px;align-items:center;text-align:left;max-width:290px">' + ic('watch', 'i18') + '<span>Already tracking on your Watch? No need to time it here too.</span></p></div>' +
    '<div class="sfoot"><div class="two"><button class="btn btn-secondary" style="min-height:64px" data-a="free-pause">' + ic(paused ? 'play' : 'pause') + (paused ? 'Resume' : 'Pause') + '</button>' +
    '<button class="btn btn-end" style="min-height:64px" data-a="free-end">' + ic('check') + 'End and log</button></div></div></div>';
}
/* ---------- a planned workout: the full screen arrives in part 2; until then a plain cover whose Close cancels it ---------- */
function vSession() {
  var s = ACTIVE || {}, tone = s.kind === 'recovery' ? 'recover' : toneOf(s.focus), title = dispTitle(s.title || (ACT && ACT.title) || 'Workout');
  return '<div class="sess" data-tone="' + tone + '"><div class="ph">' + gem(tone, GLYPH[tone], 'xl lit') + '<h2 tabindex="-1" data-focus>' + esc(title) + '</h2>' +
    '<button class="btn btn-secondary" data-a="sess-close">Close</button></div></div>';
}
/* ---------- plain screens for the full plan, progress and the summary until part 2 builds them ---------- */
function vWeek() {
  return '<div class="scr cover"><div class="scroll">' + subHdr('Your week') +
    '<div class="planlist">' + DAYS.map(function (x) { return '<button class="prow" style="width:100%;text-align:left" data-tone="' + (x.done ? 'done' : x.tone) + '" data-a="day" data-v="' + x.i + '">' + gem(x.done ? 'done' : x.tone, x.done ? 'check' : x.g, x.i === 0 ? 'lit' : '') + '<div><span class="dw">' + dayName(x.key, x.i) + ' · ' + fmtS(x.key) + '</span><h3>' + esc(x.title) + '</h3><p>' + esc(x.summary) + '</p></div></button>'; }).join('') + '</div>' +
    '<p class="note mx" style="margin-top:12px;text-align:center">' + esc((WK.thisWeek && WK.thisWeek.text) || '') + '. Your week always starts from today.</p></div></div>';
}
function vProgress() {
  var P = PROG && PROG.ok ? PROG : { recent: [], pounds: {} }, pd = P.pounds || {};
  var rows = (P.recent || []).map(function (r) { var tone = r.kind === 'free' ? 'brand' : r.kind === 'recovery' ? 'recover' : toneOf(r.focus);
    return '<div class="prow" data-tone="' + tone + '">' + gem(tone, r.kind === 'free' ? freeIcon(r.title) : GLYPH[tone], '') + '<div><span class="dw">' + fmtS(r.day) + '</span><h3>' + esc(dispTitle(r.title)) + '</h3><p>' + esc(dispSummary(r.summary)) + '</p></div></div>'; }).join('');
  return '<div class="scr cover"><div class="scroll">' + subHdr('Your progress') +
    '<div class="card mx" style="margin-top:12px;padding:14px 16px"><h3>' + plural(P.workoutsCompleted || 0, 'workout') + ' so far</h3><p class="note" style="margin-top:4px">' + nf(pd.lifetime || 0) + ' lb all time · ' + nf(pd.thisWeek || 0) + ' lb this week · ' + nf(pd.last30Days || 0) + ' lb in the last 30 days</p></div>' +
    '<div class="secrow"><span class="label">Recent workouts</span></div><div class="planlist">' + (rows || '<p class="note mx">Your first workout sets down the first plate.</p>') + '</div></div></div>';
}
function vSummary() {
  var d = DAYS[0];
  return '<div class="scr cover"><div class="scroll">' + subHdr('Summary') + '<div class="dayhead mx" style="margin-top:12px">' + gem('done', 'check', 'lg lit') + '<div><h3>' + esc(d.title) + '</h3><p>' + esc(d.summary) + '</p></div></div>' +
    '<p class="note mx" style="margin-top:12px">+' + doneEarned(d.key) + ' min of scroll time earned</p></div></div>';
}

/* ---------- drawing ---------- */
var BEHIND = ['.tab-contents', '.tab-bar', '.app-topbar', '#cx-mini', '#cx-pin'];
function setInert(list, on) { list.forEach(function (s) { var el = $(s); if (!el) return; if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); }); }
function onCoach() { var p = $('#tab-coach'); return !!(p && p.classList.contains('active')); }
function measure() { var ph = $('#phone-frame'); COMPACT = !!ph && ph.clientHeight < 700; }
function coverHTML() {
  switch (UI.cover) {
    case 'setup': return UI.setup ? vSetup() : '';
    case 'edit': return UI.edit ? vEdit() : '';
    case 'free': return freeRun() ? vFree() : '';
    case 'session': return ACTIVE ? vSession() : '';
    case 'week': return hasPlan() ? vWeek() : '';
    case 'progress': return hasPlan() ? vProgress() : '';
    case 'summary': return hasPlan() && DAYS[0] && DAYS[0].done ? vSummary() : '';
  }
  return '';
}
function sheetHTML() {
  var sh = UI.sheet; if (!sh) return '';
  if ((sh.n === 'change' || sh.n === 'day' || sh.n === 'list') && !hasPlan()) return '';
  if (sh.n === 'numbers' && !UI.edit) return '';
  switch (sh.n) {
    case 'earned': return shEarned(); case 'time': return shTime(); case 'change': return shChange();
    case 'list': return shDay(0); case 'day': return shDay(sh.i); case 'numbers': return shNumbers();
  }
  return '';
}
function render(nav) {
  if (!READY) return;
  measure(); PIN = '';
  var home = $('#coach-home');
  if (home) {
    var sc = $('#tab-coach .tab-scroll'), top = sc ? sc.scrollTop : 0;
    home.innerHTML = vHome();
    if (sc && !nav) sc.scrollTop = top;
  }
  var chip = $('#cx-sample'); if (chip) chip.innerHTML = SAMPLE ? '<span class="sample-chip"><svg class="icon icon-12" aria-hidden="true"><use href="#i-info"/></svg>Sample data</span>' : '';
  /* the cover */
  var cv = $('#cx-cover'), chtml = coverHTML();
  if (!chtml) UI.cover = null;
  var ckey = UI.cover ? UI.cover + ':' + (UI.setup ? UI.setup.step : '') : '';
  if (cv) {
    var osc = cv.querySelector('.scroll'), cst = osc && ckey === coverKeyOpen ? osc.scrollTop : 0;
    cv.innerHTML = chtml; cv.classList.toggle('on', !!UI.cover);
    if (UI.cover) { cv.setAttribute('role', 'dialog'); cv.setAttribute('aria-modal', 'true'); cv.setAttribute('aria-label', coverLabel()); } else { cv.removeAttribute('role'); cv.removeAttribute('aria-modal'); cv.removeAttribute('aria-label'); }
    var nsc = cv.querySelector('.scroll'); if (nsc) nsc.scrollTop = cst;
    if (ckey && ckey !== coverKeyOpen) { if (cv.firstElementChild && nav !== false && !reduced()) cv.firstElementChild.classList.add('enter'); focusIn(cv); }
  }
  coverKeyOpen = ckey;
  document.body.classList.toggle('cx-cover-open', !!UI.cover);
  /* the resume bar: a running timer is one tap away on every tab */
  var mini = $('#cx-mini'), f = freeRun(), showMini = !!f && UI.cover !== 'free';
  if (mini) {
    mini.classList.toggle('on', showMini);
    if (showMini) {
      mini.setAttribute('aria-label', 'Back to your timer'); mini.setAttribute('data-tone', 'brand');
      mini.innerHTML = gem('brand', freeIcon(f.name), 'sm') + '<span class="tx"><b>' + esc(f.name) + ' · <i data-clk>' + clock(freeElapsed() / 1000) + '</i></b><span>Timed workout' + (f.pausedAt ? ' · paused' : '') + '</span></span><span class="mopen">' + ic('up', 'i18') + '</span>';
    } else mini.innerHTML = '';
  }
  document.body.classList.toggle('cx-has-mini', showMini);
  var pin = $('#cx-pin'), showPin = !!PIN && onCoach() && !UI.cover && !UI.sheet && !f && !ACTIVE;
  if (pin) { pin.innerHTML = showPin ? PIN : ''; pin.classList.toggle('on', showPin); if (showPin) document.body.style.setProperty('--cx-pin-h', pin.offsetHeight + 'px'); }
  document.body.classList.toggle('cx-has-pin', showPin);
  /* the sheet */
  var box = $('#cx-sheets'), osb = box && box.querySelector('.sb'), sst = osb ? osb.scrollTop : 0, shtml = sheetHTML();
  if (!shtml) UI.sheet = null;
  var key = UI.sheet ? UI.sheet.n + ':' + (UI.sheet.i != null ? UI.sheet.i : '') : '';
  if (box) {
    box.innerHTML = shtml; box.classList.toggle('on', !!key);
    if (key && key === sheetKeyOpen) { Array.prototype.forEach.call(box.children, function (n) { n.classList.add('still'); }); var nsb = box.querySelector('.sb'); if (nsb) nsb.scrollTop = sst; }
    else if (key) { var she = box.querySelector('.sheet'); if (she) { try { she.focus({ preventScroll: true }); } catch (e) {} } }
  }
  sheetKeyOpen = key;
  document.body.classList.toggle('cx-sheet-open', !!key);
  setInert(BEHIND, !!(key || UI.cover));
  var cvi = $('#cx-cover'); if (cvi) { if (key && UI.cover) cvi.setAttribute('inert', ''); else cvi.removeAttribute('inert'); }
  wake(!!UI.cover && (UI.cover === 'free' || UI.cover === 'session'));
  tickStart();
}
function coverLabel() { return { setup: 'Build my plan', edit: 'Edit my plan', free: 'Timed workout', session: 'Workout', week: 'Your week', progress: 'Your progress', summary: 'Summary' }[UI.cover] || 'Coach'; }
function reduced() { try { return typeof prefersReducedMotion === 'function' ? prefersReducedMotion() : false; } catch (e) { return false; } }
function focusIn(root) {
  var t = root.querySelector('[data-focus]') || root.querySelector('button:not([disabled])');
  if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
}
function focusables(root) {
  return Array.prototype.filter.call(root.querySelectorAll('button, a[href], input, select, textarea, [tabindex]'), function (el) {
    return !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
}
/* the free timer clock: real timestamps from app.js, painted 4 times a second */
var TICK = null, lastLA = 0;
function tickStart() {
  var need = !!freeRun();
  if (need && !TICK) TICK = setInterval(paint, 250);
  if (!need && TICK) { clearInterval(TICK); TICK = null; }
}
function paint() {
  var f = freeRun(); if (!f) { tickStart(); return; }
  var el = freeElapsed(), t = clock(el / 1000), n = document.querySelectorAll('.cx [data-clk]'), i;
  for (i = 0; i < n.length; i++) if (n[i].textContent !== t) n[i].textContent = t;
  t = soFar(el); n = document.querySelectorAll('.cx [data-sofar]');
  for (i = 0; i < n.length; i++) if (n[i].textContent !== t) n[i].textContent = t;
  var now = Date.now();
  if (now - lastLA >= 1000) { lastLA = now; try { if (typeof updateLiveActivityCard === 'function') updateLiveActivityCard(); } catch (e) {} }
}
/* keep the screen awake while a workout cover is open; any failure is silent */
function wake(on) {
  try {
    if (on && !WL && navigator.wakeLock && document.visibilityState === 'visible') {
      WL = 'pending';
      navigator.wakeLock.request('screen').then(function (l) { if (WL !== 'pending') { try { l.release(); } catch (e) {} return; } WL = l; l.addEventListener('release', function () { if (WL === l) WL = null; }); }, function () { WL = null; });
    } else if (!on && WL) { var l = WL; WL = null; if (l !== 'pending') l.release().catch(function () {}); }
  } catch (e) { WL = null; }
}
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && UI.cover && (UI.cover === 'free' || UI.cover === 'session')) { WL = null; wake(true); } });

/* ---------- toasts (COACH_SPEC 5.25): 2.4 s, or 6 s with Undo ---------- */
var TT = null;
function toast(msg, undo) {
  var box = $('#toast-container'); if (!box) return;
  try { if (typeof syncToastPlacement === 'function') syncToastPlacement(true); } catch (e) {}
  Array.prototype.forEach.call(box.querySelectorAll('.cx-toast'), function (n) { n.remove(); });
  var t = document.createElement('div');
  t.className = 'toast cx-toast' + (undo ? ' has-undo' : '');
  t.setAttribute('role', 'status');
  var sp = document.createElement('span'); sp.textContent = msg; t.appendChild(sp);
  if (undo) { var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Undo'; b.addEventListener('click', function () { t.remove(); undo(); }); t.appendChild(b); }
  box.appendChild(t);
  clearTimeout(TT); TT = setTimeout(function () { t.remove(); try { if (typeof syncToastPlacement === 'function') syncToastPlacement(); } catch (e) {} }, undo ? 6000 : 2400);
}

/* ---------- every tap ---------- */
function draft() { return UI.cover === 'setup' && UI.setup ? UI.setup.d : UI.edit ? UI.edit.d : null; }
function opener() { var a = document.activeElement; return a && a !== document.body ? a : null; }
function refocus(el, fallback) {
  var t = el && el.isConnected && el.getClientRects().length ? el : (fallback ? $(fallback) : null);
  if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
}
function openSheet(n, extra) {
  if (!UI.sheet) UI.sheetOpener = opener();
  UI.sheet = { n: n }; if (extra != null) UI.sheet.i = extra;
  render();
}
function closeSheet() {
  if (!UI.sheet) return;
  var back = UI.sheetOpener; UI.sheet = null; UI.sheetOpener = null; render(); refocus(back, UI.cover ? '#cx-cover button' : '#coach-home button');
}
function openCover(c) {
  if (!UI.cover) UI.coverOpener = opener();
  UI.sheet = null; UI.cover = c; render(true);
}
function closeCover(target) {
  var back = UI.coverOpener; UI.cover = null; UI.coverOpener = null; render(true);
  refocus(target ? $(target) : back, '#coach-home button');
}
function busyFree() { if (freeRun()) { UI.sheet = null; render(); toast('End your timed workout first.'); return true; } return false; }
function busySession() { if (ACTIVE) { UI.sheet = null; render(); toast('Finish your workout first.'); return true; } return false; }
function after(r, msg, undo) {
  if (!r.ok) { UI.sheet = null; refresh(); render(); toastErr(r); return false; }
  UI.sheet = null; UI.sheetOpener = null; refresh(); render(); if (msg) toast(msg, undo); refocus(null, '#coach-home .hero button');
  return true;
}
function startPlanned() {
  if (busyFree()) return;
  if (ACTIVE) { openCover('session'); return; }
  var d = DAYS[0]; if (!d || !d.wid || !ACTS.canStart) { UI.sheet = null; refresh(); render(); return; }
  var r = cxRun('startSession', { today: coachToday(), workoutId: d.wid });
  if (!r.ok) { UI.sheet = null; refresh(); render(); toastErr(r); return; }
  ACT = { workoutId: d.wid, title: d.title, startedAt: Date.now() }; writeActive(ACT);
  refresh(); openCover('session');
}
function cancelPlanned() {
  cxRun('cancelSession', today()); ACT = null; writeActive(null); refresh(); closeCover();
}
function coachStartFree(name, goal) {
  name = String(name || 'Workout');
  if (busySession()) return;
  var s = demo(); if (!s) return;
  if (s.activeWorkout) { UI.sheet = null; openCover('free'); return; }
  s.activeWorkout = { name: name, startedAt: Date.now(), pausedTotalMs: 0, pausedAt: null, kind: 'free', goal: +goal || 0, open: true };
  if (!MEM && typeof saveState === 'function') saveState();
  try { if (typeof updateLiveActivityCard === 'function') updateLiveActivityCard(); } catch (e) {}
  UI.sheet = null; openCover('free');
}
function freeSave() { if (!MEM && typeof saveState === 'function') saveState(); }
function freePause() {
  var f = freeRun(); if (!f) return;
  if (f.pausedAt) { f.pausedTotalMs += Date.now() - f.pausedAt; f.pausedAt = null; } else f.pausedAt = Date.now();
  freeSave(); render(); paint();
}
function freeMin() { var f = freeRun(); if (f) { f.open = false; freeSave(); } closeCover('#cx-mini'); }
function endFree() {
  var s = demo(), f = freeRun(); if (!f) return;
  var min = Math.max(0, Math.round(freeElapsed() / 60000));
  s.activeWorkout = null; freeSave();
  try { if (typeof updateLiveActivityCard === 'function') updateLiveActivityCard(); } catch (e) {}
  UI.cover = null;
  if (min < 1) { closeCover(); toast('Too short to count - nothing logged.'); return; }
  var c = typeof creditWorkout === 'function' ? creditWorkout(f.name, min, { silent: true, kind: 'timed' }) : null;
  exec0('logFreeWorkout', { today: coachToday(), label: f.name, durationMinutes: min });
  refresh(); closeCover();
  toast(f.name + ' logged · +' + (c ? c.earned : min) + ' min of scroll time' + (c && c.shieldBanked ? ' · Shield banked' : ''));
}
/* a mutating op whose failure the person never needs to see (the earned time is already credited) */
function exec0(op, input) { try { cxRun(op, input); } catch (e) {} }
function act(a, v, el) {
  var d = draft(), f, x;
  switch (a) {
    case 'close': closeSheet(); break;
    case 'sheet': if (v === 'numbers' && !UI.edit) break; openSheet(v); break;
    case 'day': openSheet('day', +v); break;
    case 'nav': openCover(v); break;
    case 'back': if (UI.cover === 'edit') UI.edit = null; closeCover(); break;
    case 'start': startPlanned(); break;
    case 'resume': if (ACTIVE) openCover('session'); break;
    case 'resume-free': if (freeRun()) { var fr = freeRun(); fr.open = true; freeSave(); openCover('free'); } break;
    case 'open-summary': openCover('summary'); break;
    case 'sess-close': cancelPlanned(); break;
    case 'undo-choice':
      if (UI.swapBase) { x = UI.swapBase; f = cxRun('swapWorkout', { today: coachToday(), workoutId: x }); if (f.ok) UI.swapBase = null; after(f, 'Back to your plan for today.'); }
      else after(cxRun('clearTodayChoice', today()), 'Back to your plan for today.');
      break;
    case 'train-today': after(cxRun('trainToday', { today: coachToday(), choice: 'training' }), 'Training today. Use Change today to undo.'); break;
    case 'cardio-today': after(cxRun('trainToday', { today: coachToday(), choice: 'cardio' }), 'Cardio today. Use Change today to undo.'); break;
    case 'rest-today':
      after(cxRun('takeRestDay', today()), 'Rest day today. Nothing is lost.', function () { cxRun('clearTodayChoice', today()); refresh(); render(); });
      break;
    case 'swap-day':
      x = DAYS[0].wid; var prevBase = UI.swapBase;
      f = cxRun('swapWorkout', { today: coachToday(), workoutId: v });
      if (f.ok) UI.swapBase = (prevBase || x) === v ? null : (prevBase || x);
      if (after(f)) toast(DAYS[0].title + ' is today now.', function () { var r = cxRun('swapWorkout', { today: coachToday(), workoutId: x }); if (r.ok) UI.swapBase = prevBase; refresh(); render(); });
      break;
    case 'free': f = v.split(':'); if (freeRun()) { if (!busySession()) { UI.sheet = null; openCover('free'); } } else coachStartFree(f[0], f[1]); break;
    case 'other':
      if (busySession()) break;
      if (freeRun()) { UI.sheet = null; openCover('free'); break; }
      if (UI.sheet) { UI.sheet = null; UI.sheetOpener = null; render(); refocus($('#cx-time-btn'), '#coach-home button'); }
      if (typeof openOtherLibrary === 'function') openOtherLibrary();
      break;
    case 'free-min': freeMin(); break;
    case 'free-pause': freePause(); break;
    case 'free-end': endFree(); break;
    case 'open-setup': UI.setup = { step: 0, d: copy(DEFAULT_PROFILE) }; openCover('setup'); break;
    case 'setup-back': if (UI.setup.step === 0) { UI.setup = null; closeCover('#cx-build-btn'); } else { UI.setup.step--; render(); } break;
    case 'setup-next':
      if (UI.setup.step < 5) { UI.setup.step++; render(); break; }
      f = cxRun('setup', { today: coachToday(), profile: toProfile(d) });
      if (!f.ok) { if (errCode(f) === 'alreadySetUp') { UI.setup = null; refresh(); closeCover(); break; } toastErr(f); break; }
      UI.swapBase = null; refresh(); UI.setup.step = 6; render();
      break;
    case 'setup-done': UI.setup = null; closeCover(); refocus(null, '#coach-home .hero .btn-cta'); if (COMPACT) refocus(null, '#cx-pin .btn'); break;
    case 'open-edit':
      if (ACTIVE || freeRun()) { UI.sheet = null; render(); toast('Finish your workout first.'); break; }
      x = fromProfile(WK.profile); UI.edit = { d: x, o: copy(x) }; openCover('edit'); break;
    case 'edit-save':
      f = cxRun('editProfile', { today: coachToday(), profile: toProfile(UI.edit.d) });
      if (!f.ok) { if (errCode(f) === 'notSetUp' || errCode(f) === 'noPlan') { UI.edit = null; refresh(); closeCover(); break; } toastErr(f); break; }
      UI.edit = null; UI.swapBase = null; refresh(); closeCover(); toast('Plan updated. Your history and records stay.');
      break;
    case 'set':
      if (!d) break;
      f = v.split(':')[0]; x = v.split(':')[1];
      if (f === 'days') d.days = clamp(d.days + (+x), 2, 6); else if (f === 'daysv') d.days = +x; else if (f === 'mins') d.mins = +x; else d[f] = x;
      if (f === 'equip') d.anchors = d.anchors.filter(function (n) { return anchorIds(d.equip).indexOf(n.id) >= 0; });
      render(); break;
    case 'anchor':
      if (!d) break;
      x = d.anchors.filter(function (n) { return n.id === v; })[0];
      if (x) d.anchors.splice(d.anchors.indexOf(x), 1);
      else { var m = exInfo(v); d.anchors.push(m.logType === 'weightReps' ? { id: v, w: (m.start || [])[Math.min(2, XI[d.exp] + 1)] || m.minWeight || 5, r: 5 } : { id: v, w: 0, r: 10 }); }
      render(); break;
    case 'astep':
      if (!d) break;
      f = v.split(':'); x = d.anchors.filter(function (n) { return n.id === f[1]; })[0]; if (!x) break;
      var mi = exInfo(f[1]);
      if (f[0] === 'w') x.w = clamp(x.w + (+f[2]) * (mi.step || 5), mi.minWeight || 0, Math.min(995, mi.maxWeight || 995)); else x.r = clamp(x.r + (+f[2]), 1, mi.logType === 'weightReps' ? 12 : 60);
      render(); break;
  }
}
document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('.cx [data-a], #cx-mini') : null;
  if (!el || el.disabled) return;
  if (el.id === 'cx-mini') { act('resume-free', ''); return; }
  act(el.getAttribute('data-a'), el.getAttribute('data-v') || '', el);
});
document.addEventListener('input', function (e) {
  if (e.target.id !== 'cx-bw') return;
  var d = draft(); if (!d) return;
  var n = Math.min(700, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0);
  d.bodyWeight = n; if (String(n || '') !== e.target.value) e.target.value = n || '';
  /* no re-draw here or on blur: the field loses focus on the press of the next button, and a re-draw then would replace
     that button under the finger, so its first tap would be lost. Closing Your numbers re-draws Edit my plan and its count. */
});
document.addEventListener('keydown', function (e) {
  if (typeof topOpenDialog === 'function' && topOpenDialog()) return;
  if (e.key === 'Escape' && UI.sheet) { e.preventDefault(); closeSheet(); return; }
  if (e.key === 'Escape' && UI.cover) { var out = coverEscape(); if (out) { e.preventDefault(); out(); } return; }
  if (e.key !== 'Tab') return;
  var root = UI.sheet ? $('#cx-sheets .sheet') : UI.cover ? $('#cx-cover') : null;
  if (!root) return;
  var items = focusables(root); e.preventDefault();
  if (!items.length) { try { root.focus({ preventScroll: true }); } catch (x) {} return; }
  var i = items.indexOf(document.activeElement), next;
  if (e.shiftKey) next = i <= 0 ? items[items.length - 1] : items[i - 1];
  else next = (i === -1 || i === items.length - 1) ? items[0] : items[i + 1];
  next.focus();
});
/* Escape on a cover does what the cover's own leave button does, and only where that loses nothing
   (COACH_SPEC 2.1 and 2.2: covers close only by their buttons, which keeps setup answers, plan edits and a running workout safe).
   Your week, Your progress and the summary go back; the free timer minimizes and keeps running; Edit my plan goes back only with
   no edits; setup closes only on question 1 with nothing answered yet. The workout (its Close cancels it) and the ready screen stay. */
function coverEscape() {
  switch (UI.cover) {
    case 'week': case 'progress': case 'summary': return function () { act('back', ''); };
    case 'free': return function () { act('free-min', ''); };
    case 'edit': return UI.edit && !editChanged() ? function () { act('back', ''); } : null;
    case 'setup': return UI.setup && UI.setup.step === 0 && JSON.stringify(UI.setup.d) === JSON.stringify(DEFAULT_PROFILE) ? function () { act('setup-back', ''); } : null;
  }
  return null;
}
/* a phone keyboard opening over the body weight field can resize the window: no re-draw then, for the same reason as above
   (the next draw measures again) */
window.addEventListener('resize', function () { if (document.activeElement && document.activeElement.id === 'cx-bw') return; var was = COMPACT; measure(); if (was !== COMPACT) render(); });

/* ---------- sample states for checking (rule 7): real engine ops, held in memory only, with the SAMPLE caption ---------- */
var SAMPLE_PROFILE = { goal: 'buildMuscle', experience: 'some', daysPerWeek: 4, equipment: 'fullGym', sessionMinutes: 45, bodyWeight: 175 };
var NUMS_PROFILE = { goal: 'buildMuscle', experience: 'some', daysPerWeek: 4, equipment: 'fullGym', sessionMinutes: 45, anchors: [{ exerciseId: 'benchPress', weight: 135, reps: 5 }, { exerciseId: 'overheadPress', weight: 85, reps: 5 }] };
function itemsDone(s) {
  return s.items.map(function (it) {
    var t = it.target || {}, sets = [], k;
    if (it.logType === 'cardio') return { slot: it.slot, exerciseId: it.exerciseId, minutes: t.minutes };
    for (k = 0; k < (t.sets || 3); k++) sets.push(it.logType === 'weightReps' ? { weight: t.weight, reps: t.reps } : it.logType === 'reps' ? { reps: t.reps } : { seconds: t.seconds });
    return { slot: it.slot, exerciseId: it.exerciseId, sets: sets };
  });
}
function completeDay(st, k) {
  var w = q('week', { today: k }, st), c = w.ok && w.days[0]; if (!c || c.kind === 'rest' || c.done) return st;
  var s = q('session', { today: k }, st).session; if (!s) return st;
  var r = exec('completeSession', { today: k, workoutId: c.workoutId, durationMinutes: 30, items: itemsDone(s) }, st);
  return r.result && r.result.ok ? r.state : st;
}
function seedHistory(back, prof) {
  var t0 = coachToday(), st = freshState(), i, r = exec('setup', { today: addKey(t0, -back), profile: prof }, st);
  if (!r.result.ok) return st; st = r.state;
  for (i = back; i >= 1; i--) st = completeDay(st, addKey(t0, -i));
  return st;
}
function seedFresh(prof) { var r = exec('setup', { today: coachToday(), profile: prof }, freshState()); return r.result.ok ? r.state : freshState(); }
/* the three named seeds (?coachSeed=new|lived-in|bodyweight): "new" is a plan set up today with nothing logged,
   "lived-in" is 8 weeks of full-gym history, "bodyweight" is 8 weeks on a bodyweight-only plan */
var SEEDS = ['new', 'lived-in', 'bodyweight'];
var BW_PROFILE = { goal: 'buildMuscle', experience: 'some', daysPerWeek: 4, equipment: 'bodyweight', sessionMinutes: 45, bodyWeight: 175 };
function seedParam() { var v = param('coachSeed'); return v && SEEDS.indexOf(v) >= 0 ? v : ''; }
/* a seed's history, with today landing on the kind of day a state needs (want): it tries the state's own history length (pref) first,
   then each length over one full week. "new" has no history, so its today is always the plan's first workout. */
function seedPlan(name, want, pref, goal) {
  var p = copy(name === 'bodyweight' ? BW_PROFILE : SAMPLE_PROFILE), tries = [pref || 56, 56, 57, 58, 59, 60, 61, 62], i, st, w;
  if (goal) p.goal = goal;
  if (name === 'new') return seedFresh(p);
  for (i = 0; i < tries.length; i++) {
    st = seedHistory(tries[i], p);
    if (!want) return st;
    w = q('week', today(), st);
    if (w.ok && w.days && w.days[0] && w.days[0].kind === want && !w.days[0].done) return st;
  }
  return seedHistory(pref || 56, p);
}
/* the done-today sample credits its workout the way a finished coach workout does (creditWorkout, kind coach), in memory only,
   so the hero, the strip and the Earned today list tell the same story */
function sampleCredit() {
  var r = (q('progress', today()).recent || []).filter(function (x) { return x.day === coachToday() && x.kind !== 'free'; })[0];
  if (!r || typeof creditWorkout !== 'function') return;
  try { creditWorkout(dispTitle(r.title), r.durationMinutes || 0, { silent: true, quiet: true, kind: 'coach' }); } catch (e) {}
}
/* a test address opens a state on top of a seed (rule 11). Everything stays in memory (MEM): no coach key and no demo save is written. */
function route(name, seed) {
  MEM = true; SAMPLE = false; UI.sheet = null; UI.cover = null; UI.setup = null; UI.edit = null;
  var stay = false, sd = seed || 'lived-in';
  switch (name) {
    case 'first-visit': ST = freshState(); break;
    case 'setup': ST = freshState(); UI.setup = { step: 0, d: copy(DEFAULT_PROFILE) }; UI.cover = 'setup'; break;
    case 'setup-days': ST = freshState(); UI.setup = { step: 2, d: copy(DEFAULT_PROFILE) }; UI.cover = 'setup'; break;
    case 'setup-numbers': ST = freshState(); UI.setup = { step: 5, d: copy(DEFAULT_PROFILE) }; UI.cover = 'setup'; break;
    case 'setup-ready': ST = seedFresh(toProfile(DEFAULT_PROFILE)); UI.setup = { step: 6, d: copy(DEFAULT_PROFILE) }; UI.cover = 'setup'; break;
    case 'first-week': ST = seedFresh(NUMS_PROFILE); break;
    case 'rest-day': ST = seedPlan(sd, 'rest', 61); SAMPLE = true; break;
    case 'recovery-day': ST = seedPlan(sd, 'recovery', 58); SAMPLE = true; break;
    case 'cardio-day': ST = seedPlan(sd, 'cardio', 58, 'stayFit'); SAMPLE = true; break;
    case 'done-today': ST = completeDay(seedPlan(sd, 'training', 56), coachToday()); SAMPLE = true; sampleCredit(); break;
    case 'edit-plan': ST = seedPlan(sd); SAMPLE = true; stay = 'edit'; break;
    case 'earned': ST = seedPlan(sd); SAMPLE = true; UI.sheet = { n: 'earned' }; break;
    case 'change-today': ST = seedPlan(sd, 'training', 56); SAMPLE = true; UI.sheet = { n: 'change' }; break;
    case 'time': ST = seedPlan(sd); SAMPLE = true; UI.sheet = { n: 'time' }; break;
    case 'free':
      ST = seedPlan(sd); SAMPLE = true;
      var s = demo(); if (s) s.activeWorkout = { name: 'Walk', startedAt: Date.now() - 372000, pausedTotalMs: 0, pausedAt: null, kind: 'free', goal: 0, open: true };
      UI.cover = 'free'; break;
    case 'today': ST = seedPlan(sd, 'training', 56); SAMPLE = true; break;
    default: ST = seedPlan(sd); SAMPLE = true; /* a seed on its own: browse it from Coach home */
  }
  refresh();
  if (stay === 'edit') { var x = fromProfile(WK.profile); UI.edit = { d: x, o: copy(x) }; UI.cover = 'edit'; }
}
var COACH_STATES = ['first-visit', 'setup', 'setup-days', 'setup-numbers', 'setup-ready', 'first-week', 'today', 'rest-day', 'cardio-day', 'recovery-day', 'done-today', 'edit-plan', 'earned', 'change-today', 'time', 'free'];
function stateParam() { var v = param('coach'); return v && COACH_STATES.indexOf(v) >= 0 ? v : ''; }
/* true while a test address is open: app.js saveState asks this and writes nothing (rule 11, the helpers only read the address) */
function coachHoldsSaves() { return MEM || !!(stateParam() || seedParam()); }

/* ---------- what app.js calls ---------- */
var routed = false;
function init() {
  if (READY) return;
  if (!E) return;
  ST = cxLoad(); READY = true;
  var name = stateParam(), sd = seedParam();
  if (name || sd) route(name, sd);
  refresh();
  if (!MEM) {
    ACT = readActive();
    if (ACT && !ACTIVE) { ACT = null; writeActive(null); }
    if (!ACT && ACTIVE) { cxRun('cancelSession', today()); refresh(); }
    if (ACT && ACTIVE) UI.cover = 'session';
    var f = freeRun(); if (f && f.open && !UI.cover) UI.cover = 'free';
  }
}
function coachRestore() {
  init(); if (!READY) return;
  if (!routed) {
    routed = true;
    var tab = param('tab');
    if ((tab === 'coach' || tab === 'earn' || stateParam() || seedParam()) && typeof switchTab === 'function') { switchTab('coach'); return; }
  }
  render(true);
}
function coachOnTab() { init(); if (!READY) return; render(true); }
function coachRefresh() { if (!READY) return; refresh(); render(); }
function coachSignOutCleanup() {
  if (!READY) return;
  if (ACTIVE) cxRun('cancelSession', today());
  ACT = null; writeActive(null);
  UI.sheet = null; UI.cover = null; UI.setup = null; UI.edit = null; UI.swapBase = null;
  if (TICK) { clearInterval(TICK); TICK = null; }
  wake(false); refresh(); render();
}
function coachLogCrossing(name, minutes) {
  if (!READY || !(minutes >= 1)) return;
  exec0('logFreeWorkout', { today: coachToday(), label: String(name || 'Workout'), durationMinutes: minutes });
}
window.coachOnTab = coachOnTab; window.coachRefresh = coachRefresh; window.coachRestore = coachRestore;
window.coachSignOutCleanup = coachSignOutCleanup; window.coachLogCrossing = coachLogCrossing; window.coachStartFree = coachStartFree;
window.coachToday = coachToday; window.coachHoldsSaves = coachHoldsSaves;
})();
