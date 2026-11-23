/* Balance - the Coach tab (web demo): home, setup, Change today, Day detail,
   Earned today, the free timer, the planned workout and its summary, Your week
   and Your progress.
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
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  warn: '<path d="M12 3.800L2.700 19.800h18.600L12 3.800z"/><path d="M12 10v4.600"/><circle cx="12" cy="17.200" r=".9" fill="currentColor"/>'
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
var ACT = null;         /* the running planned workout's draft (newDraft): its items, logged sets, rest and pause */
var WK = null, ACTIVE = null, READY = false, COMPACT = false, PIN = '', WL = null;
var UI = { view: 'home', sheet: null, cover: null, setup: null, edit: null, swapBase: null, swapDay: '', sheetOpener: null, coverOpener: null, wedit: null, guardUntil: 0, pv: {} };
var sheetKeyOpen = '', coverKeyOpen = '';
var REV = 0;            /* counts engine state changes, so a cached Next time preview is never read against an older state */

function exec(op, input, st) {
  try { return E.run(op, st === undefined ? ST : st, input || {}); }
  catch (e) { return { result: { ok: false, error: { code: 'exception', message: '' } }, state: st === undefined ? ST : st }; }
}
function q(op, input, st) { var r = exec(op, input, st); return (r && r.result) || { ok: false }; }
function freshState() { return E.run('newState', null, {}).state; }
/* saved data the engine cannot read (APP_MAPPING errors): corruptData keeps the text under a second key before anything is saved
   and starts from a new state, with "Your coach data could not be read." and Set up again on home; newerVersion is never saved over */
var LOAD_ERR = '', KEPT = false, UKEY = 'balance_coach_state_unreadable';
function cxLoad() {
  var text = '';
  LOAD_ERR = ''; KEPT = false;
  try { text = localStorage.getItem(KEY) || ''; } catch (e) { text = ''; }
  var r = exec('load', { text: text }, null);
  /* the iPhone's keptUnreadable: the notice stays while a set-aside copy is kept and there is no plan, even after later
     saves made the main key readable again; building a plan hides it (home only shows it with no plan) */
  if (r.result && r.result.ok && r.state) { if (hasKeptCopy()) { LOAD_ERR = 'corrupt'; KEPT = true; } return r.state; }
  if (errCode(r.result) === 'newerVersion') LOAD_ERR = 'newer';
  else if (text) { LOAD_ERR = 'corrupt'; KEPT = keepUnreadable(text); }
  return freshState();
}
function keepUnreadable(text) {
  if (coachHoldsSaves()) return false;
  try {
    for (var n = 1; n <= 20; n++) {
      var k = n === 1 ? UKEY : UKEY + '_' + n, v = localStorage.getItem(k);
      if (v === text) return true;
      if (v === null) { localStorage.setItem(k, text); return localStorage.getItem(k) === text; }
    }
  } catch (e) {}
  return false;
}
function hasKeptCopy() {
  try { for (var n = 1; n <= 20; n++) if (localStorage.getItem(n === 1 ? UKEY : UKEY + '_' + n) !== null) return true; } catch (e) {}
  return false;
}
function cxSave() {
  if (MEM || LOAD_ERR === 'newer' || (LOAD_ERR === 'corrupt' && !KEPT)) return;
  try { var r = E.run('save', ST, {}); if (r.result && r.result.ok) localStorage.setItem(KEY, r.result.text); } catch (e) {}
}
/* every change goes through here: it keeps the new state only when the engine says ok, then saves it */
function cxRun(op, input) {
  var r = exec(op, input);
  if (r.result && r.result.ok && E.isMutating(op)) { ST = r.state; REV++; cxSave(); }
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

/* ---------- what changed since last time (engine B2: items[k].change) ---------- */
function upChange(it) { return !!(it && it.change && it.change.direction === 'up'); }
/* the raised ChangeTag on home (COACH_SPEC 4): mint, arrow up, then the engine's bare size "5 lb" / "1 rep" / "3 min" */
function raisedTag(it) { return '<span class="tag up" aria-label="raised">' + ic('up', 'i12') + esc(it.change.tag) + '</span>'; }
/* a target from the person's setup numbers (CoachDerived.startedFromNumbers): no history, not calibrating, engine fromNumbers */
function fromNums(it) { return !!it && !it.last && it.calibrating !== true && it.fromNumbers === true; }

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
function raisedCount(items) { var n = 0; items.forEach(function (it) { if (upChange(it)) n++; }); return n; }
function firstWeekLine(items) {
  if ((WK.weeksOnPlan || 0) > 1) return '';
  var fr = items.filter(function (x) { return !x.last && x.logType !== 'cardio'; }), seed = fr.filter(fromNums).length, cal = fr.length - seed;
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
      return '<div class="xrow"><span class="n">' + (i + 1) + '</span><span class="nm">' + esc(it.name) + '</span><span class="tg">' + tShort(it) + (upChange(it) ? raisedTag(it) : '') + '</span></div>';
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
    var it = items[0] || { name: 'Cardio', target: { minutes: t.raw.aboutMinutes } }, cup = upChange(it), from = cup ? +((it.change.previous && it.change.previous.minutes) || 0) : 0;
    return '<section class="hero" data-tone="cardio">' + ic('heart', 'mark') + heroTop(!run && anyChange()) +
      '<div class="hero-title">' + gem('cardio', 'heart', 'lg lit') + '<h2>' + esc(t.title) + '</h2></div><p class="hero-sub">' + esc(t.desc) + '</p>' +
      (cup && from ? '<p class="raised">' + ic('up', 'i14') + 'Up from ' + from + ' min last time</p>' : '') +
      '<div class="lines"><div class="ln two">' + ic('timer', 'i18') + '<span><b>' + esc(it.name) + '</b><small>Goal ' + ((it.target && it.target.minutes) || 0) + ' min</small></span>' + (cup ? raisedTag(it) : '') + '</div>' +
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
    '<button class="btn btn-cta xl" id="cx-build-btn" data-a="open-setup">Build my plan</button><p class="fine">Takes about a minute.</p></section>' + firstGrid();
}
function firstGrid() {
  return '<div class="secrow"><span class="label">Or just time a workout</span></div><div class="mx">' + quickGrid(true) + '</div>' +
    '<p class="note mx" style="margin-top:12px;text-align:center">' + esc(rateLine()) + '</p>';
}
/* the iPhone's wording and layout (Home/CoachView.swift): unreadable data takes the hero's place until a new plan is built;
   data from a newer version gets a callout above the hero on every visit, and nothing done here is saved */
function loadNotice() {
  if (LOAD_ERR === 'corrupt') return '<section class="hero" data-tone="brand">' + ic('warn', 'mark') +
    '<div class="hero-title" style="margin-top:8px">' + gem('brand', 'warn', 'lg lit') + '<h2 class="sm" id="cx-load-note" style="font-size:22px;letter-spacing:-.4px;line-height:1.2">Your coach data could not be read.</h2></div>' +
    '<p class="hero-sub" style="margin-top:12px">' + (KEPT ? 'A copy is kept on this phone. ' : '') + 'Answer the 6 questions again to get a new plan.</p>' +
    '<button class="btn btn-cta xl" style="margin:16px 0 0" data-a="open-setup">Set up again</button></section>';
  if (LOAD_ERR === 'newer') return '<div class="callout calm mx" id="cx-load-note" role="alert" style="margin-top:10px">' + ic('down', 'i18') + '<span>Your coach data was saved by a newer version of Balance. Update the app to keep using it. Changes made here are not saved.</span></div>';
  return '';
}
function dayBub(d) {
  return '<button class="day' + (d.i === 0 ? ' now' : '') + (d.done ? ' done' : '') + '" data-tone="' + d.tone + '" data-a="day" data-v="' + d.i + '" aria-label="' + dayName(d.key, d.i) + ', ' + fmtS(d.key) + ': ' + esc(d.title) + (d.done ? ', done' : '') + '">' +
    '<span class="dw">' + (d.i === 0 ? 'Today' : DOW[dateOf(d.key).getDay()]) + '</span><span class="bub">' + ic(d.done ? 'check' : d.g) + '</span><span class="nm">' + d.s + '</span></button>';
}
function platesFrom(list) { return list.filter(function (r) { return r.kind !== 'free'; }).map(function (r) { return { tone: r.kind === 'recovery' ? 'recover' : toneOf(r.focus), min: r.durationMinutes, kind: r.kind }; }); }
function vHome() {
  var h = strip();
  if (LOAD_ERR === 'newer') h += loadNotice();
  if (!hasPlan()) return h + (LOAD_ERR === 'corrupt' ? loadNotice() + firstGrid() : heroFirst());
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
    var c = it.change && (it.change.direction === 'up' || it.change.direction === 'down') ? it.change : null;
    return '<div class="lrow"><span class="n">' + (i + 1) + '</span><span><h3>' + esc(it.name) + '</h3><p>' + (it.last ? 'Last time ' + lastText(it) : it.logType === 'cardio' ? 'Logged by time' : fromNums(it) ? 'From your numbers' : it.calibrating ? 'First time - start light' : 'First time') + '</p></span>' +
      '<span class="tg">' + tShort(it) + (c ? '<br><span class="tag ' + c.direction + '">' + (c.direction === 'up' ? '+' : '-') + esc(c.tag) + '</span>' : '') + '</span></div>'; }).join('') + '</div>';
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
/* "up to {N} min each" on the ready screen: N is the longest training, cardio or recovery day in the list under it (the engine's
   aboutMinutes, else its minutes), the same number that row shows, so no row is ever longer than the header says. The chosen
   length is only the fallback when no day carries minutes (the iPhone's CoachDerived.readyAboutMinutes). */
function readyMinutes(d) {
  var n = 0;
  DAYS.forEach(function (x) { if (x.kind === 'rest') return; var m = x.raw.aboutMinutes != null ? x.raw.aboutMinutes : x.raw.minutes; if (m > n) n = m; });
  return 'up to ' + (n || (WK && WK.profile && WK.profile.sessionMinutes) || d.mins) + ' min';
}
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
function soFar(ms) { return '+' + Math.round(Math.round(ms / 60000) * rate()) + ' min earned so far'; }
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
/* ---------- a planned workout (COACH_SPEC 5.18 to 5.24, 6, 7, APP_MAPPING "Workout") ----------
   ACT is the running workout's draft: the engine's items with what was logged, the rest, the pause and the
   choices made. It is saved under its own key after every tap and every timer is a timestamp, so minimize,
   another tab, a reload or a closed browser all come back to the same set, rest and clock. */
var TEXTS = null;
function ctext(k, d) { if (!TEXTS) TEXTS = catalog().texts || {}; return TEXTS[k] || d; }
function lt(x) { return x.item.logType; }
function isMinItem(x) { return x.item.logType !== 'weightReps' && x.item.logType !== 'reps' && x.item.logType !== 'seconds'; }
function tval(it) { var t = it.target || {}; return it.logType === 'weightReps' || it.logType === 'reps' ? (t.reps || 8) : it.logType === 'seconds' ? (t.seconds || 30) : (t.minutes || 10); }
function tsets(it) { return Math.max(1, (it.target && it.target.sets) || 1); }
function freshEx(it, slot) { return { slot: slot, item: it, n: tsets(it), logs: [], cw: (it.target && it.target.weight) || 0, cr: tval(it), feel: null, skipped: false, earlier: false, pb: null }; }
function isDone(x) { return x.skipped || x.logs.length >= x.n; }
function allDone() { return ACT.items.every(isDone); }
function setsDone() { var n = 0; ACT.items.forEach(function (x) { n += x.logs.length; }); return n; }
function setsTotal() { var n = 0; ACT.items.forEach(function (x) { n += x.skipped ? x.logs.length : Math.max(x.n, x.logs.length); }); return n; }
function setsLeftCount() { var n = 0; ACT.items.forEach(function (x) { n += x.skipped ? 0 : Math.max(0, x.n - x.logs.length); }); return n; }
function nextOpen(i) { var n = ACT.items.length, k; for (k = 1; k <= n; k++) if (!isDone(ACT.items[(i + k) % n])) return (i + k) % n; return -1; }
function btnState() { var x = ACT.items[ACT.xi]; return UI.wedit ? 'edit' : ACT.rest ? 'rest' : isDone(x) ? (allDone() ? 'finish' : 'next') : 'log'; }
function sessEl() { if (!ACT) return 0; return Math.max(0, (ACT.pausedAt || Date.now()) - ACT.startedAt - (ACT.pausedTotalMs || 0)); }
function restLeft() { var r = ACT && ACT.rest; if (!r) return 0; return r.pausedLeft != null ? r.pausedLeft : Math.max(0, (r.endsAt - Date.now()) / 1000); }
function sessTone() { return ACT.kind === 'recovery' ? 'recover' : toneOf(ACT.focus); }
function running() { return !!(ACT && ACT.items && ACTIVE); }
function saveAct() { writeActive(ACT); }
function earlierIndex(slot) { var i; for (i = 0; i < ACT.items.length; i++) if (ACT.items[i].slot === slot && ACT.items[i].earlier) return i; return -1; }
function mainOf(d, slot) { var m = null; d.items.forEach(function (x) { if (x.slot === slot && !x.earlier) m = x; }); return m; }
function earlierOf(d, slot) { var e = null; d.items.forEach(function (x) { if (!e && x.slot === slot && x.earlier) e = x; }); return e; }
/* a new draft from the engine's session (startSession, or activeSession after a reload of an older draft) */
function newDraft(s, startedAt) {
  return { v: 2, workoutId: s.workoutId, title: s.title, day: s.day || coachToday(), kind: s.kind, focus: s.focus, about: s.aboutMinutes || s.minutes || 30,
    startedAt: startedAt || Date.now(), pausedTotalMs: 0, pausedAt: null, open: true, xi: 0, rest: null, restOn: prefGet('rest', true), sound: prefGet('sound', false), dist: 0, pendingAlways: [],
    items: (s.items || []).map(function (it) { return freshEx(it, it.slot); }), planMoves: planMovesOf(s) };
}
/* the plan's own move per slot as the workout started, so a swap back to it reads "Back to {move}." (owner ruling of 2026-11-22) */
function planMovesOf(s) { var m = {}; (s.items || []).forEach(function (it) { m[String(it.slot)] = it.exerciseId; }); return m; }
/* the rest timer and its sound are the person's own settings, kept between workouts (6.7) */
var PREF = { rest: 'balance_coach_rest_timer', sound: 'balance_coach_rest_sound' };
function prefGet(k, d) { try { var v = localStorage.getItem(PREF[k]); return v === null ? d : v === '1'; } catch (e) { return d; } }
function prefSet(k, on) { if (MEM) return; try { localStorage.setItem(PREF[k], on ? '1' : '0'); } catch (e) {} }

/* ---------- words (the iPhone app's CoachWorkoutText) ---------- */
function valText(x, w, r) { var l = lt(x); return l === 'weightReps' ? w + ' lb x ' + r : l === 'reps' ? plural(r, 'rep') : l === 'seconds' ? r + ' sec' : r + ' min'; }
function chipText(x, w, r) { var l = lt(x); return l === 'weightReps' ? w + ' × ' + r : l === 'reps' ? String(r) : l === 'seconds' ? r + 's' : r + ' min'; }
function logged(x) {
  var g = x.logs, l = lt(x); if (!g.length) return '';
  if (isMinItem(x)) return g[0].r + ' min';
  if (l === 'reps') return g.map(function (s) { return s.r; }).join(', ') + ' reps';
  if (l === 'seconds') return g.map(function (s) { return s.r; }).join(', ') + ' seconds';
  if (g.every(function (s) { return s.w === g[0].w; })) return g[0].w + ' lb x ' + g.map(function (s) { return s.r; }).join(', ');
  return g.map(function (s) { return s.w + ' x ' + s.r; }).join(', ') + ' lb';
}
function didText(x) { if (!x.logs.length) return x.skipped ? 'Skipped today' : 'Not logged today'; return 'Today ' + logged(x); }
function lastOf(x, short) {
  var l = x.item.last; if (!l) return '';
  if (isMinItem(x)) { var m = l.minutes != null ? l.minutes : (l.sets && l.sets[0] && l.sets[0].minutes); return m != null ? m + ' min' : ''; }
  var s = l.sets || []; if (!s.length) return '';
  if (lt(x) === 'reps') return s.map(function (y) { return y.reps; }).join(', ');
  if (lt(x) === 'seconds') return s.map(function (y) { return y.seconds; }).join(', ') + ' sec';
  var w = s[0].weight, reps = s.map(function (y) { return y.reps; }).join(', ');
  if (s.every(function (y) { return y.weight === w; })) return short ? w + ' × ' + reps : w + ' lb x ' + reps;
  return s.map(function (y) { return y.weight + '×' + y.reps; }).join(', ');
}
function lastLine(x) {
  var it = x.item, line = lt(x) === 'weightReps' && it.repsLow && it.repsHigh ? 'Aim for ' + it.repsLow + ' to ' + it.repsHigh + ' reps · ' : '', last = lastOf(x, false);
  if (last) return line + 'Last time ' + last;
  if (fromNums(it)) return line + 'First time';
  if (it.hint) return line + it.hint;
  return line + (it.calibrating ? 'First time - start light' : 'First time');
}
function mergedTail(x) { var last = lastOf(x, true); return last ? ' · last ' + last : ' · ' + (x.item.calibrating ? 'first time - start light' : 'first time'); }
function logDetail(x, w, r) { return isMinItem(x) ? x.item.name : valText(x, w, r) + (x.item.perHand ? ' each hand' : ''); }
function signedTag(row) { var d = row && row.direction; return d === 'up' ? '+' + row.tag : d === 'down' ? '-' + row.tag : d === 'same' ? 'Same' : ''; }
function tagCls(row) { return row && row.direction === 'up' ? 'up' : row && row.direction === 'down' ? 'down' : 'same'; }

/* ---------- what the coach is sent (6.10): one item per slot, earlier sets with the move they were logged on (B3) ---------- */
function engineSets(x) {
  var l = lt(x);
  return x.logs.map(function (s) { return l === 'weightReps' ? { weight: s.w, reps: s.r } : l === 'reps' ? { reps: s.r } : l === 'seconds' ? { seconds: s.r } : { minutes: s.r }; });
}
function recoverySplit(total, targets) {
  var left = Math.max(0, total);
  return targets.map(function (t, i) { var share = i === targets.length - 1 ? left : Math.min(left, Math.max(0, t)); left -= share; return share; });
}
function finishItems(d, minutes) {
  if (d.kind === 'cardio') {
    var c = d.items[0]; if (!c) return [];
    var o = { slot: c.slot, exerciseId: c.item.exerciseId, minutes: minutes };
    if (d.dist > 0) o.distanceHundredths = d.dist * 10;
    return [o];
  }
  if (d.kind === 'recovery') {
    var sh = recoverySplit(minutes, d.items.map(function (x) { return tval(x.item); }));
    return d.items.map(function (x, i) { return sh[i] > 0 ? { slot: x.slot, exerciseId: x.item.exerciseId, minutes: sh[i] } : { slot: x.slot, exerciseId: x.item.exerciseId, skipped: true }; });
  }
  var slots = [];
  d.items.forEach(function (x) { if (slots.indexOf(x.slot) < 0) slots.push(x.slot); });
  return slots.map(function (slot) {
    var m = mainOf(d, slot), e = earlierOf(d, slot); if (!m) return null;
    var o = { slot: slot, exerciseId: m.item.exerciseId };
    if (!m.logs.length) o.skipped = true; else if (isMinItem(m)) o.minutes = m.logs[0].r; else o.sets = engineSets(m);
    if (m.logs.length && m.feel) o.feel = m.feel;
    if (e && e.logs.length) o.earlierSets = { exerciseId: e.item.exerciseId, sets: engineSets(e).slice(0, 10) };
    return o;
  }).filter(Boolean);
}
/* "about {N} min left" (5.18): the workout's about-minutes times the share of work still to do */
function setWork(x) { return lt(x) === 'seconds' ? tval(x.item) * (x.item.perSide ? 2 : 1) + 15 : (x.item.perSide ? 70 : 40); }
function exSeconds(x) { if (isMinItem(x)) return 60 * tval(x.item); var s = tsets(x.item), rs = Math.max(0, x.item.restSeconds || 0); return s * setWork(x) + Math.max(0, s - 1) * rs; }
function minutesLeft() {
  var main = ACT.items.filter(function (x) { return !x.earlier; }), whole = 300, any = ACT.items.some(function (x) { return x.logs.length > 0; }), left = any ? 0 : 300;
  main.forEach(function (x, j) { whole += (j > 0 ? 60 : 0) + exSeconds(x); });
  main.forEach(function (x, j) {
    if (isDone(x)) return;
    var sl = Math.max(0, x.n - x.logs.length), st = x.logs.length > 0, rs = Math.max(0, x.item.restSeconds || 0);
    if (isMinItem(x)) { left += (st || j === 0 ? 0 : 60) + (sl > 0 ? 60 * tval(x.item) : 0); return; }
    var w = setWork(x);
    left += st ? sl * (w + rs) : (j > 0 ? 60 : 0) + sl * w + Math.max(0, sl - 1) * rs;
  });
  return Math.max(1, Math.round((ACT.about || 45) * left / Math.max(1, whole)));
}
function setsLine() { var d = setsDone(); return allDone() ? 'All ' + plural(d, 'set') + ' done' : d + ' of ' + setsTotal() + ' sets done · about ' + minutesLeft() + ' min left'; }
/* Swap is offered for a lifted move with alternatives that is not the kept first part of a swapped slot; once the new move has
   sets, its slot cannot change again (the engine keeps one earlier part per slot, B3) */
function canSwap(i) {
  var x = ACT.items[i]; if (!x || ACT.kind !== 'training' || x.earlier || isMinItem(x)) return false;
  if (!swapChoices(x).length && !(x.item.alternatives || []).length) return false;
  return !(earlierIndex(x.slot) >= 0 && x.logs.length > 0);
}
/* the moves the Swap list offers: the engine's alternatives, never a move already in today's workout (one move is never logged twice).
   The move done first in this slot stays on the list while the new one has no sets: picking it folds its sets back in. */
function swapChoices(x) {
  var used = {};
  ACT.items.forEach(function (y) { if (y === x) return; if (y.slot === x.slot && y.earlier && !x.logs.length) return; used[y.item.exerciseId] = 1; });
  return (x.item.alternatives || []).filter(function (a) { return !used[a.exerciseId] && a.exerciseId !== x.item.exerciseId; }).slice(0, 6);
}

/* the Next time line (5.18): the engine's own answer for what is logged so far, from a completeSession on a copy that is thrown away */
var PV = { key: '', rows: null };
function previewRow(x) {
  if (!x.logs.length) return null;
  var items = finishItems(ACT, Math.max(1, ACT.about || 1)), key = JSON.stringify(items) + '|' + coachToday() + '|' + REV;
  if (PV.key !== key) {
    var r = exec('completeSession', { today: coachToday(), workoutId: ACT.workoutId, durationMinutes: Math.max(1, ACT.about || 1), items: items });
    PV = { key: key, rows: r.result && r.result.ok && r.result.summary ? r.result.summary.next || [] : [] };
  }
  return PV.rows.filter(function (row) { return row.slot === x.slot; })[0] || null;
}
/* the steppers' ranges (the engine's weightStep, minWeight and maxWeight; values by 1, seconds by 5) */
function wStep(it) { return Math.max(1, it.weightStep || 5); }
function wMin(it) { return Math.max(0, it.minWeight || 0); }
function wMax(it) { return Math.max(wMin(it), Math.min(995, it.maxWeight || 995)); }
function vStep(x) { return lt(x) === 'seconds' ? 5 : 1; }
function vRange(x) { return lt(x) === 'seconds' ? [5, 600] : isMinItem(x) ? [1, 180] : [1, 99]; }

/* ---------- the workout screen (5.18) and the cardio and recovery screen (5.19) ---------- */
function ringHTML(left, total, label, big, attr) {
  var c = 2 * Math.PI * 54, f = total ? clamp(left / total, 0, 1) : 0, sw = big ? 6 : 8;
  return '<div class="ringbox' + (big ? ' big' : '') + '"' + (attr === 'rest' ? ' role="timer" aria-label="Rest"' : attr === 'cardio' ? ' role="timer" aria-label="Time moved"' : '') + '><svg viewBox="0 0 124 124" aria-hidden="true"><circle class="trk" cx="62" cy="62" r="54" fill="none" stroke-width="' + sw + '"/>' +
    '<circle class="arc" data-arc="' + attr + '" cx="62" cy="62" r="54" fill="none" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - f)).toFixed(1) + '"/></svg>' +
    '<div class="mid"><b ' + (attr === 'rest' ? 'data-rest' : 'data-clk') + '>' + clock(attr === 'rest' ? Math.ceil(left) : left) + '</b><span>' + label + '</span></div></div>';
}
function stepRow(f, label, val, unit, hint, md, less, more) {
  return '<div class="steprow' + (md ? ' md' : '') + '"><button class="stepbtn' + (md ? ' md' : '') + '" data-a="step" data-v="' + f + ':-1" aria-label="' + less + '">' + ic('minus') + '</button>' +
    '<div class="stepval" aria-live="polite"><span class="lb">' + label + '</span><span class="v">' + val + (unit ? '<small>' + unit + '</small>' : '') + '</span>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>' +
    '<button class="stepbtn' + (md ? ' md' : '') + '" data-a="step" data-v="' + f + ':1" aria-label="' + more + '">' + ic('plus') + '</button></div>';
}
function steppers(x, w, r, md) {
  var it = x.item, l = lt(x), h = '';
  if (l === 'weightReps') h += stepRow('w', 'Weight', w, 'lb', it.perHand ? 'each hand' : '', md, 'Less weight', 'More weight');
  if (l === 'weightReps' || l === 'reps') h += stepRow('r', 'Reps', r, '', it.perSide ? 'each side' : md && COMPACT && l === 'weightReps' && !ACT.rest && it.repsLow && it.repsHigh ? 'aim for ' + it.repsLow + ' to ' + it.repsHigh : '', md, 'Fewer reps', 'More reps');
  else if (l === 'seconds') h += stepRow('r', 'Seconds', r, 'sec', it.perSide ? 'each side' : '', md, 'Fewer seconds', 'More seconds');
  else h += stepRow('r', 'Minutes', r, 'min', '', md, 'Fewer minutes', 'More minutes');
  return h;
}
/* the line under the steppers (Swift WorkoutCue) */
function cueLine(x) {
  var it = x.item, e = UI.wedit, t = it.target || {}, l = lt(x);
  if (e) return '<p class="cue edit">' + ic('edit', 'i16') + 'Changing set ' + (e.j + 1) + ' · goal was ' + valText(x, t.weight || 0, tval(it)) + '</p>';
  var dw = l === 'weightReps' ? x.cw - (t.weight || 0) : 0, dv = x.cr - tval(it), u = l === 'seconds' ? 'sec' : isMinItem(x) ? 'min' : Math.abs(dv) === 1 ? 'rep' : 'reps';
  if (!x.logs.length && !dw && !dv) {
    if (fromNums(it)) return '<p class="cue">' + ic('info', 'i16') + 'Started from your numbers</p>';
    if (it.calibrating && l === 'weightReps') return '<p class="cue">' + ic('info', 'i16') + 'First time: start light. If a set feels easy, add weight on the next set.</p>';
    if (!it.last && (l === 'reps' || l === 'seconds')) return '<p class="cue">' + ic('info', 'i16') + 'First time: do what you can and log it.</p>';
    var notes = it.notes || [], cb = ctext('comebackNote', ''), tw = ctext('skippedTwiceNote', '');
    if (cb && notes.indexOf(cb) >= 0) return '<p class="cue">' + ic('info', 'i16') + esc(cb) + '</p>';
    if (tw && notes.indexOf(tw) >= 0 && (it.alternatives || []).length && canSwap(ACT.xi)) return '<button class="cue swapcue" data-a="sheet" data-v="swap">' + ic('swap', 'i16') + esc(tw) + '</button>';
  }
  if (!dw && !dv) return '<p class="cue ok">' + ic('check', 'i16') + 'On target</p>';
  if (dw > 0) return '<p class="cue ok">' + ic('up', 'i16') + dw + ' lb over the goal - log what you lift</p>';
  if (dw < 0) return '<p class="cue">' + (-dw) + ' lb under the goal - that\'s fine, log what you did</p>';
  if (dv > 0) return '<p class="cue ok">' + ic('up', 'i16') + dv + ' ' + u + ' over target - nice</p>';
  return '<p class="cue">' + (-dv) + ' ' + u + ' under target - that\'s fine, log what you did</p>';
}
var FEELS = [['easy', 'Easy'], ['justRight', 'Just right'], ['hard', 'Hard']];
function feelHTML(x) {
  return '<div class="feel"><p>How did that feel? <span>Optional</span></p><div class="opts" role="group" aria-label="How did ' + esc(x.item.name) + ' feel">' +
    FEELS.map(function (f) { return '<button class="' + (x.feel === f[0] ? 'on' : '') + '" data-a="feel" data-v="' + f[0] + '" aria-pressed="' + (x.feel === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div></div>';
}
function changeTag(row) { var t = signedTag(row); return t ? '<span class="tag ' + tagCls(row) + '">' + esc(t) + '</span>' : ''; }
function nextTimeHTML(x) {
  var row = previewRow(x); if (!row) return '';
  return '<p class="nexttime">Next time: <b>' + esc(row.text || '') + '</b>' + (row.change !== 'skipped' ? changeTag(row) : '') + '</p>';
}
function sessTop(withClock) {
  var p = !!ACT.pausedAt;
  return '<div class="stop">' + iconBtn('minimize', '', 'chevD', 'Minimize. Your workout keeps running') +
    '<div class="mid"><span class="dn" tabindex="-1" data-focus><i' + (p ? ' class="paused"' : '') + '></i>' + esc(dispTitle(ACT.title)) + (p ? ' · paused' : '') + '</span>' +
    (withClock ? '<span class="clock" data-clk role="timer" aria-label="Workout time">' + clock(sessEl() / 1000) + '</span>' : '') + '</div>' +
    (p ? iconBtn('pause', '', 'play', 'Paused. Open resume options') : iconBtn('pause', '', 'pause', 'Pause workout')) + '</div>';
}
function sofarChip() { return '<div class="sofar"><span class="chip">' + ic('bolt', 'i12') + '<span data-sofar>' + soFar(sessEl()) + '</span></span></div>'; }
function logBtnHTML() {
  var x = ACT.items[ACT.xi], st = btnState(), g = Date.now() < (UI.guardUntil || 0) ? ' guard' : '', nx = nextOpen(ACT.xi), e = UI.wedit;
  function b(cls, icon, t, sub, label) { return '<button class="logbtn' + cls + '" data-a="main" aria-label="' + esc(label || t + '. ' + sub) + '"><span class="ck">' + ic(icon) + '</span><span class="lt">' + esc(t) + '<small>' + esc(sub) + '</small></span></button>'; }
  if (st === 'edit') return b('', 'check', 'Save set ' + (e.j + 1), valText(x, e.w, e.r));
  if (st === 'rest') return b(' quiet' + g, 'skip', 'Skip rest', ACT.rest.ex && nx >= 0 ? 'Next: ' + ACT.items[nx].item.name : 'Set ' + (x.logs.length + 1) + ' is next');
  if (st === 'log') return b(g, 'check', isMinItem(x) ? 'Log ' + x.cr + ' min' : 'Log set ' + (x.logs.length + 1), logDetail(x, x.cw, x.cr));
  if (st === 'next' && nx >= 0) return b(' quiet' + g, 'arrow', 'Next exercise', ACT.items[nx].item.name + ' · ' + tShort(ACT.items[nx].item));
  return b(' finish' + g, 'check', 'Finish workout', 'See your summary', 'Finish workout. See your summary');
}
function vSession() {
  if (!running() || !ACT.items.length) return '';
  if (ACT.kind !== 'training') return vCardio();
  if (ACT.xi >= ACT.items.length) ACT.xi = 0;
  var x = ACT.items[ACT.xi], it = x.item, st = btnState(), e = UI.wedit, h, j, chips = '', card;
  h = '<div class="sess" data-tone="' + sessTone() + '">' + sessTop(true) + sofarChip() +
    '<div class="segs" aria-hidden="true">' + ACT.items.map(function (y, i) { return '<i class="' + (i === ACT.xi ? 'cur' : y.skipped && !y.logs.length ? 'skip' : isDone(y) ? 'done' : '') + '"></i>'; }).join('') + '</div>' +
    '<p class="setsline">' + setsLine() + '</p><div class="sbody">';
  var more = '<button class="pill round" data-a="sheet" data-v="menu" aria-label="More options for ' + esc(it.name) + '">' + ic('more') + '</button>';
  var gl = 'Goal <b>' + esc(tShort(it).replace(' · ', ' at ')) + '</b>' + esc(mergedTail(x));
  h += '<div class="exh"><span class="label">Exercise ' + (ACT.xi + 1) + ' of ' + ACT.items.length + '</span><div class="hrow"><h2>' + esc(it.name) + '</h2>' + more + '</div>' +
    '<p class="goal">Goal <b>' + esc(it.text || tShort(it)) + '</b></p><p class="last">' + esc(lastLine(x)) + '</p><p class="gl">' + gl + '</p></div>';
  h += '<div class="pills">' + (canSwap(ACT.xi) ? '<button class="pill" data-a="sheet" data-v="swap">' + ic('swap') + 'Swap</button>' : '') + '<button class="pill" data-a="sheet" data-v="xlist">' + ic('list') + 'All exercises</button><span style="flex:1"></span>' + more + '</div>';
  for (j = 0; j < x.n; j++) {
    if (j < x.logs.length) chips += '<button class="setc done' + (e && e.j === j ? ' edit' : '') + '" data-a="chip" data-v="' + j + '" aria-label="Set ' + (j + 1) + ', logged ' + esc(valText(x, x.logs[j].w, x.logs[j].r)) + '. Tap to change."><small>' + ic('check', 'i12') + 'Set ' + (j + 1) + '</small><b>' + esc(chipText(x, x.logs[j].w, x.logs[j].r)) + '</b></button>';
    else if (j === x.logs.length && !x.skipped) chips += e ? '<button class="setc now" data-a="chip" data-v="' + j + '" aria-label="Back to set ' + (j + 1) + '"><small>Set ' + (j + 1) + '</small><b>' + esc(chipText(x, x.cw, x.cr)) + '</b></button>' : '<div class="setc now" aria-current="step"><small>Set ' + (j + 1) + '</small><b>' + esc(chipText(x, x.cw, x.cr)) + '</b></div>';
    else chips += '<div class="setc"><small>Set ' + (j + 1) + '</small><b>' + (x.skipped ? 'skipped' : '·') + '</b></div>';
  }
  if (x.n < 5 && !isMinItem(x) && !x.skipped) chips += '<button class="setc add" data-a="addset" aria-label="Add a set">' + ic('plus', 'i18') + '</button>';
  h += '<div class="sets">' + chips + '</div>';
  if (st === 'edit') card = '<div class="logcard lc-log">' + steppers(x, e.w, e.r, COMPACT) + cueLine(x) + '</div>';
  else if (st === 'log') card = '<div class="logcard lc-log">' + steppers(x, x.cw, x.cr, COMPACT) + cueLine(x) + '</div>';
  else {
    var r = ACT.rest, band = r ? '<div class="restband"><button class="adj" data-a="rest-adj" data-v="-15" aria-label="15 seconds less rest">-15s</button>' + ringHTML(restLeft(), r.total, 'Rest', false, 'rest') + '<button class="adj" data-a="rest-adj" data-v="15" aria-label="15 seconds more rest">+15s</button></div>' : '';
    if (r && !r.ex) card = '<div class="logcard">' + band + '<p class="nextlbl">Next: set ' + (x.logs.length + 1) + '</p>' + steppers(x, x.cw, x.cr, true) + '</div>';
    else {
      var sk = x.skipped && !x.logs.length;
      var head = sk ? '<div class="donehead skipped"><span class="orb">' + ic('skip') + '</span><h3>Skipped</h3><p>Same target next time. Nothing is lost.</p><button class="btn btn-ghost" data-a="unskip">' + ic('undo') + 'Undo skip</button></div>'
        : '<div class="donehead' + (r ? ' slim' : '') + '"><span class="orb">' + ic('check') + '</span><h3>' + esc(it.name) + ' done</h3><p>' + esc(didText(x).replace(/^Today /, '')) + '</p></div>';
      card = '<div class="logcard fit">' + band + (r ? '' : head) + (sk ? '' : nextTimeHTML(x) + feelHTML(x)) + '</div>';
    }
  }
  return h + card + '</div><div class="sfoot">' + logBtnHTML() + '</div></div>';
}
function cardioLine() {
  if (ACT.kind === 'recovery') return ACT.items.map(function (x) { return x.item.name + ' ' + tval(x.item) + ' min'; }).join(', then ') + '. Keep it easy - this day helps you recover.';
  var it = ACT.items[0].item, ch = it.change, prev = ch && ch.direction === 'up' && ch.previous && ch.previous.minutes;
  return 'Goal ' + tval(it) + ' min' + (prev ? ', up from ' + prev + ' min' : '') + '. Go at a pace where you can still talk.';
}
function vCardio() {
  var goal = 0, rec = ACT.kind === 'recovery', dist = ACT.dist || 0;
  ACT.items.forEach(function (x) { goal += tval(x.item); });
  return '<div class="sess" data-tone="' + sessTone() + '">' + sessTop(false) + '<div class="cardio-mid">' +
    ringHTML(sessEl() / 1000, goal * 60, 'of ' + goal + ' min', true, 'cardio') + sofarChip() +
    '<h2>' + esc(rec ? 'Active recovery' : ACT.items[0].item.name) + '</h2><p>' + esc(cardioLine()) + '</p>' +
    (rec ? '' : '<div style="width:100%;max-width:300px"><span class="label" style="display:block;margin-bottom:8px">Distance · optional</span><div class="ministep"><button data-a="dist" data-v="-1" aria-label="Less distance">' + ic('minus', 'i20') + '</button>' +
    '<div class="mv" aria-live="polite">' + (dist ? (dist / 10).toFixed(1) : 'Not set') + '<small>' + (dist ? 'miles' : 'tap + to add') + '</small></div><button data-a="dist" data-v="1" aria-label="More distance">' + ic('plus', 'i20') + '</button></div></div>') + '</div>' +
    '<div class="sfoot"><button class="logbtn" data-a="main"><span class="ck">' + ic('check') + '</span><span class="lt">' + (rec ? 'Finish recovery' : 'Finish cardio') + '<small>Logged by time</small></span></button></div></div>';
}

/* ---------- the workout's sheets: Swap (5.20), the exercise menu (5.21), All exercises (5.22), Paused, Finish now and Discard (5.23) ---------- */
var EQUIP_WORD = { barbell: 'Barbell', dumbbell: 'Dumbbells', machine: 'Machine', cardioMachine: 'Machine', cable: 'Cable', bodyweight: 'Bodyweight' };
function swapLine(id) { var m = exInfo(id); return (m.muscleLabel ? m.muscleLabel + ' · ' : '') + (EQUIP_WORD[m.equipment] || 'No equipment'); }
function isBodyweight(id) { var q = exInfo(id).equipment; return q === 'bodyweight' || q === 'none' || !q; }
function foldBackNote(x) {
  if (x.logs.length) return '';
  var e = earlierIndex(x.slot) >= 0 ? ACT.items[earlierIndex(x.slot)] : null; if (!e || !e.logs.length) return '';
  return ' Picking ' + e.item.name + ' again brings back ' + (e.logs.length === 1 ? 'the set' : 'the ' + e.logs.length + ' sets') + ' you logged.';
}
function shSwap() {
  var x = ACT.items[ACT.xi], alts = swapChoices(x), sc = UI.sheet.scope || 'today';
  var b = '<p class="lead">Instead of <b style="color:var(--text)">' + esc(x.item.name) + '</b>. These work the same muscles with what you have.</p>';
  b += '<div class="seg" role="radiogroup" aria-label="How long to swap for" style="margin-top:14px">' + [['today', 'Just today'], ['always', 'Every time']].map(function (o) {
    return '<button role="radio" aria-checked="' + (sc === o[0]) + '" class="' + (sc === o[0] ? 'on' : '') + '" data-a="swap-scope" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
  b += alts.length ? '<div class="stack">' + alts.map(function (a) {
    return '<button class="opt" data-a="do-swap" data-v="' + esc(a.exerciseId) + '"><span class="sym">' + ic(isBodyweight(a.exerciseId) ? 'figure' : 'lift') + '</span><span><h3>' + esc(a.name) + '</h3><p>' + esc(swapLine(a.exerciseId)) + '</p></span>' + ic('chevR', 'i16 go') + '</button>'; }).join('') + '</div>'
    : '<div class="callout calm" style="margin-top:14px">' + ic('info', 'i18') + '<span>No other move fits this spot with your equipment.</span></div>';
  return shell('Swap exercise', b + '<p class="note" style="margin-top:12px;text-align:center">' + (x.logs.length ? 'The sets you already logged stay. ' : '') + 'Your coach gives the new move its own starting target.' + esc(foldBackNote(x)) + '</p>', { tone: sessTone() });
}
function shMenu() {
  var x = ACT.items[ACT.xi], b = '<div class="menu">';
  function row(a, icon, title, sub, val) { return '<button data-a="' + a + '"' + (val ? ' role="switch" aria-checked="' + (val === 'On') + '"' : '') + '><span class="symtile plain">' + ic(icon, 'i20') + '</span><span><h3>' + title + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</span><span class="val">' + (val || '') + '</span></button>'; }
  if (COMPACT) { if (canSwap(ACT.xi)) b += row('menu-swap', 'swap', 'Swap exercise', 'A different move for the same muscles.'); b += row('menu-list', 'list', 'All exercises', setsDone() + ' of ' + setsTotal() + ' sets done. Jump to any of them.'); }
  if (x.skipped) b += row('unskip', 'undo', 'Undo skip', 'Bring this exercise back.');
  else if (!isDone(x)) b += row('skip', 'skip', 'Skip this exercise', 'Same target next time. Nothing is lost.');
  if (x.n < 5 && !x.skipped && !isMinItem(x)) b += row('addset', 'plus', 'Add a set', plural(x.n, 'set') + ' now');
  if (x.n > Math.max(1, x.logs.length) && !x.skipped) b += row('remset', 'minus', 'Remove a set', plural(x.n, 'set') + ' now');
  b += row('opt-rest', 'timer', 'Rest timer', ACT.restOn ? 'Counts down after each set. You can always skip it.' : 'No countdown between sets.', ACT.restOn ? 'On' : 'Off');
  b += row('opt-sound', 'sound', 'Sound when rest ends', 'Your phone always buzzes. Sound is extra.', ACT.sound ? 'On' : 'Off');
  return shell(esc(x.item.name), b + '</div>', { tone: sessTone() });
}
function listLine(x) {
  if (x.skipped && !x.logs.length) return 'Skipped today';
  if (!x.logs.length) return 'Goal ' + (x.item.text || tShort(x.item));
  if (isDone(x)) return didText(x);
  return didText(x) + ' · set ' + (x.logs.length + 1) + ' of ' + x.n + ' is next';
}
function shXList() {
  var rows = ACT.items.map(function (x, i) {
    var done = isDone(x), cur = i === ACT.xi, sk = x.skipped && !x.logs.length, line = listLine(x);
    return '<button class="lrow' + (done && !x.skipped ? ' done' : cur ? ' cur' : '') + '" data-a="goto" data-v="' + i + '"' + (cur ? ' aria-current="step"' : '') + ' aria-label="Exercise ' + (i + 1) + ', ' + esc(x.item.name) + '. ' + esc(line) + (cur ? '. Current' : '') + '"><span class="n">' + (x.skipped ? ic('skip', 'i12') : done ? ic('check', 'i12') : (i + 1)) + '</span>' +
      '<span><h3>' + esc(x.item.name) + '</h3><p>' + esc(line) + '</p></span>' + ic('chevR', 'i16 go') + '</button>';
  }).join('');
  return shell('All exercises', '<p class="lead">' + setsDone() + ' of ' + setsTotal() + ' sets done. Tap an exercise to jump to it.</p><div class="card" style="padding:4px 14px;margin-top:12px">' + rows + '</div>', { tone: sessTone() });
}
function shPause() {
  var c = UI.sheet.c, left = setsLeftCount(), keep = '<button class="btn btn-secondary" data-a="keep-going">Keep going</button>';
  if (c === 'finish') return shell('Finish now?', '<p class="lead">' + (left === 1 ? '1 set not logged. That is fine. It just will not count toward next time.' : left + ' sets not logged. That is fine. They just will not count toward next time.') + '</p><div class="stack"><button class="btn btn-cta" data-a="finish-now">Finish and save</button>' + keep + '</div>');
  if (c === 'discard') return shell('Discard this workout?', '<p class="lead">Nothing will be saved and no time is earned.</p><div class="stack"><button class="btn btn-danger" data-a="discard">' + ic('trash') + 'Discard workout</button>' + keep + '</div>');
  return shell('Paused · <span data-pclk>' + clock(sessEl() / 1000) + '</span>', '<p class="lead">The timer is stopped. Paused time doesn\'t earn scroll time.</p>' + (ACT.kind === 'training' ? '<p class="note" style="margin-top:6px">' + setsDone() + ' of ' + setsTotal() + ' sets done.</p>' : '') +
    '<div class="stack"><button class="btn btn-cta" data-a="keep-going">' + ic('play') + 'Resume</button><button class="btn btn-secondary" data-a="finish-ask">Finish and save</button><button class="btn btn-danger" data-a="discard-ask">Discard this workout</button></div>', { tone: sessTone() });
}

/* ---------- workout logic (6.1 to 6.10) ---------- */
function buzz(p) { try { var ua = navigator.userActivation; if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p); } catch (e) {} }
var ACTX = null;
function beep() {
  try { var C = window.AudioContext || window.webkitAudioContext; if (!C) return; ACTX = ACTX || new C(); var o = ACTX.createOscillator(), g = ACTX.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ACTX.destination); o.start(); o.stop(ACTX.currentTime + 0.2); } catch (e) {}
}
/* spoken lines (10.3): one polite live region outside the screens that re-draw */
function say(msg) {
  var lv = document.getElementById('cx-live');
  if (!lv) { lv = document.createElement('div'); lv.id = 'cx-live'; lv.setAttribute('role', 'status'); lv.setAttribute('aria-live', 'polite'); lv.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'; document.body.appendChild(lv); }
  lv.textContent = ''; setTimeout(function () { lv.textContent = msg; }, 60);
}
function cur() { return ACT.items[ACT.xi]; }
function setGuard(ms) { UI.guardUntil = Date.now() + ms; setTimeout(function () { var b = $('#cx-cover .logbtn'); if (b && Date.now() >= (UI.guardUntil || 0)) b.classList.remove('guard'); }, ms + 40); }
function sessRender() { saveAct(); render(); }
function logSet() {
  var x = cur(); if (!x || isDone(x)) return;
  x.logs.push({ w: lt(x) === 'weightReps' ? x.cw : 0, r: x.cr });
  x.cr = tval(x.item);
  setGuard(600); buzz(12);
  var t = Math.max(0, x.item.restSeconds || 0);
  if (ACT.restOn && t > 0 && !allDone()) ACT.rest = { endsAt: Date.now() + t * 1000, total: t, ex: isDone(x), pausedLeft: null };
  sessRender();
}
/* how a rest ends: 'tap' (Skip rest), 'auto' (it ran out with the screen open) or 'quiet' (it ran out while away) */
function endRest(how) {
  var r = ACT && ACT.rest; if (!r) return;
  ACT.rest = null;
  if (r.ex && isDone(cur())) { var n = nextOpen(ACT.xi); if (n >= 0) ACT.xi = n; }
  if (how === 'tap') setGuard(500);
  sessRender();
  if (how === 'auto') {
    var x = cur(); buzz([70, 50, 70]); if (ACT.sound) beep();
    if (x) {
      say('Rest over. Set ' + (x.logs.length + 1) + ' of ' + x.item.name + '.');
      try { if (document.hidden && window.Notification && Notification.permission === 'granted') new Notification('Rest is over', { body: x.item.name + ': set ' + (x.logs.length + 1) + ' is next.' }); } catch (e) {}
    }
  }
}
function mainTap() {
  if (!running() || Date.now() < (UI.guardUntil || 0)) return;
  if (ACT.kind !== 'training') { finishWorkout(); return; }
  var x = cur(), st = btnState(), e = UI.wedit, n;
  if (st === 'edit') {
    if (x.logs[e.j]) { x.logs[e.j] = { w: lt(x) === 'weightReps' ? e.w : 0, r: e.r }; if (e.j === x.logs.length - 1 && lt(x) === 'weightReps') x.cw = e.w; }
    UI.wedit = null; setGuard(500); sessRender();
  } else if (st === 'rest') endRest('tap');
  else if (st === 'log') logSet();
  else if (st === 'next') { n = nextOpen(ACT.xi); if (n >= 0) ACT.xi = n; UI.wedit = null; setGuard(400); sessRender(); }
  else finishWorkout();
}
function stepVal(v) {
  var x = cur(); if (!x) return;
  var f = v.split(':')[0], d = +v.split(':')[1], e = UI.wedit, it = x.item, rg = vRange(x);
  if (f === 'w') { var w = clamp((e ? e.w : x.cw) + d * wStep(it), wMin(it), wMax(it)); if (e) e.w = w; else x.cw = w; }
  else { var r = clamp((e ? e.r : x.cr) + d * vStep(x), rg[0], rg[1]); if (e) e.r = r; else x.cr = r; }
  buzz(4); sessRender();
}
function tapChip(j) {
  var x = cur(), e = UI.wedit;
  if ((e && e.j === j) || (e && j >= x.logs.length)) UI.wedit = null;
  else if (j < x.logs.length) UI.wedit = { j: j, w: x.logs[j].w || x.cw, r: x.logs[j].r };
  else return;
  ACT.rest = null; sessRender();
}
function addSet() { var x = cur(); if (!x || x.n >= 5 || isMinItem(x) || x.skipped) return; x.n++; if (ACT.rest && ACT.rest.ex) ACT.rest.ex = false; UI.sheet = null; sessRender(); }
function remSet() {
  var x = cur(); if (!x || x.n <= Math.max(1, x.logs.length)) return;
  x.n--; if (allDone()) ACT.rest = null; else if (ACT.rest && isDone(x)) ACT.rest.ex = true;
  UI.sheet = null; sessRender();
}
function skipEx() {
  var x = cur(); if (!x || x.skipped || x.logs.length >= x.n) return;
  x.skipped = true; ACT.rest = null; UI.wedit = null; UI.sheet = null; sessRender();
  toast('Skipped ' + x.item.name + '. Same target next time.', function () { if (ACT && ACT.items.indexOf(x) >= 0 && x.skipped) { x.skipped = false; sessRender(); } });
}
function unskip() { var x = cur(); if (!x || !x.skipped) return; x.skipped = false; UI.sheet = null; sessRender(); }
function setFeel(v) { var x = cur(); if (!x) return; x.feel = x.feel === v ? null : v; sessRender(); }
function adjRest(s) {
  var r = ACT.rest; if (!r) return;
  if (r.pausedLeft != null) r.pausedLeft += s; else r.endsAt += s * 1000;
  r.total = Math.max(r.total, Math.ceil(restLeft()) + Math.max(0, s));
  if (restLeft() <= 0) { endRest('tap'); return; }
  sessRender();
}
function gotoEx(i) { if (!ACT.items[i]) return; ACT.xi = i; ACT.rest = null; UI.wedit = null; UI.sheet = null; UI.sheetOpener = null; sessRender(); refocus(null, '#cx-cover .logbtn'); }
function stepDist(d) { var t = ACT.dist || 0; ACT.dist = t === 0 ? (d > 0 ? 10 : 0) : clamp(t + d, 0, 999); sessRender(); }
function pauseWorkout() {
  if (!running()) return;
  if (!ACT.pausedAt) { ACT.pausedAt = Date.now(); if (ACT.rest && ACT.rest.pausedLeft == null) ACT.rest.pausedLeft = Math.max(0, (ACT.rest.endsAt - Date.now()) / 1000); saveAct(); }
  openSheet('pause');
}
function resumeWorkout() {
  if (!ACT || !ACT.pausedAt) return;
  ACT.pausedTotalMs = (ACT.pausedTotalMs || 0) + (Date.now() - ACT.pausedAt); ACT.pausedAt = null;
  if (ACT.rest && ACT.rest.pausedLeft != null) { ACT.rest.endsAt = Date.now() + ACT.rest.pausedLeft * 1000; ACT.rest.pausedLeft = null; }
  saveAct();
}
/* the engine's item for the current slot again, keeping what was logged (Swift refreshCurrentFromSession) */
function refreshFromSession() {
  var x = cur(), a = q('activeSession', today()), s = a.ok && a.active ? a.session : null; if (!x || x.earlier || !s) return;
  var it = (s.items || []).filter(function (y) { return y.slot === x.slot; })[0]; if (!it) return;
  if (it.exerciseId === x.item.exerciseId) x.item = it; else if (!x.logs.length) ACT.items[ACT.xi] = freshEx(it, x.slot);
  saveAct();
}
/* Swap (6.6, B3): before a set the new move takes the slot; after sets, those stay with the first move (sent as earlierSets) and the
   new move gets the engine's full target; picking the first move again before the new one has a set folds its sets back in */
function doSwap(id) {
  var x = cur(); if (!x || x.earlier) return;
  var always = UI.sheet && UI.sheet.scope === 'always', idx = ACT.xi;
  var r = cxRun('swapExercise', { today: coachToday(), workoutId: ACT.workoutId, slot: x.slot, exerciseId: id, scope: 'today' });
  var it = r.ok && r.session ? (r.session.items || []).filter(function (y) { return y.slot === x.slot; })[0] : null;
  if (!it) { refreshFromSession(); render(); return; }
  ACT.rest = null; UI.wedit = null; PV.key = '';
  var ei = earlierIndex(x.slot);
  if (!x.logs.length && ei >= 0 && ACT.items[ei].item.exerciseId === id) {
    var back = ACT.items[ei]; back.item = it; back.earlier = false; back.n = Math.min(5, Math.max(back.logs.length, back.pb || tsets(it), 1)); back.pb = null;
    ACT.items.splice(idx, 1); ACT.xi = ei < idx ? ei : ei - 1; ACT.items[ACT.xi] = back;
  } else if (!x.logs.length) ACT.items[idx] = freshEx(it, x.slot);
  else { x.pb = x.n; x.n = x.logs.length; x.earlier = true; ACT.items.splice(idx + 1, 0, freshEx(it, x.slot)); ACT.xi = idx + 1; }
  ACT.pendingAlways = (ACT.pendingAlways || []).filter(function (p) { return p.slot !== x.slot; });
  if (always) ACT.pendingAlways.push({ slot: x.slot, exerciseId: id });
  UI.sheet = null; UI.sheetOpener = null; sessRender(); refocus(null, '#cx-cover .logbtn');
  toast(ACT.planMoves && ACT.planMoves[String(x.slot)] === id ? 'Back to ' + it.name + '.' : 'Swapped to ' + it.name + ' ' + (always ? 'from now on.' : 'for today.'));
}

/* ---------- finish (6.10, 8.2) and discard ---------- */
var SUM = null, SKEY = 'balance_coach_summary';
function readSum() { if (MEM) return null; try { var t = localStorage.getItem(SKEY); var o = t ? JSON.parse(t) : null; return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
function writeSum(o) { if (MEM) return; try { if (o) localStorage.setItem(SKEY, JSON.stringify(o)); else localStorage.removeItem(SKEY); } catch (e) {} }
function movedToday() { var n = 0; demoEntries().forEach(function (e) { n += +e.mins || 0; }); return Math.round(n); }
function goalMin() { var s = demo(); return Math.max(1, (s && +s.workoutGoalMin) || 30); }
function recCards(list) {
  var order = [], names = {}, lines = {};
  (list || []).forEach(function (r) {
    var id = r.exerciseId, t = String(r.text || ''), k = t.lastIndexOf(': '); if (!id || k < 0) return;
    var name = r.name || '', est = r.type === 'estimatedMax', lead = t.slice(0, k);
    if (!(id in names)) { order.push(id); names[id] = name; }
    if (est) lead = 'New best max (about the most you could lift once)';
    else if (name) lead = lead.replace(' for ' + name, '').replace(' ' + name, '');
    (lines[id] = lines[id] || []).push({ lead: lead, value: t.slice(k + 2), est: est });
  });
  return order.map(function (id) { return { name: names[id], lines: lines[id] }; });
}
function sumPlates(P, fallback) {
  var plates = platesFrom(((P && P.recent) || []).filter(function (r) { return r.kind !== 'free'; }).slice(0, 5).reverse());
  if (!plates.length && fallback) plates = [fallback];
  return { plates: plates, earlier: Math.max(0, ((P && P.workoutsCompleted) || plates.length) - plates.length) };
}
function earlierRow(slot, name, did, next, stays) { return { slot: slot, name: name, tag: stays ? 'Same' : '', cls: 'same', did: did, next: stays ? next : '', why: stays ? 'Same target next time.' : '' }; }
function buildSummary(res, d, credit) {
  var sm = res.summary || {}, rec = res.record || {}, next = sm.next || [], items = rec.items || [], rows = [];
  next.forEach(function (row) {
    var slot = row.slot, main = mainOf(d, slot), e = earlierOf(d, slot), skipped = row.change === 'skipped', onPurpose = !!(main && main.skipped), did;
    if (e && e.logs.length) rows.push(earlierRow(slot, e.item.name, didText(e), e.item.text || '', !(d.pendingAlways || []).some(function (p) { return p.slot === slot; })));
    if (main && main.logs.length) did = didText(main);
    else if (d.kind !== 'training') { var mi = (items.filter(function (y) { return y.slot === slot; })[0] || {}).minutes || 0; did = mi > 0 ? 'Today ' + mi + ' min' : 'Not logged today'; }
    else did = onPurpose ? 'Skipped today' : 'Not reached - you finished early';
    rows.push({ slot: slot, name: row.name || (main && main.item.name) || '', tag: skipped ? (onPurpose ? 'Skipped' : 'Not done') : signedTag(row), cls: skipped ? 'same' : tagCls(row), did: did, next: row.text || '', why: skipped ? 'Same target next time.' : row.reason || '' });
  });
  var goal = 0; d.items.forEach(function (x) { if (isMinItem(x)) goal += tval(x.item); });
  var pl = sumPlates(PROG, { tone: sessToneOf(d), min: credit.minutes, kind: d.kind });
  if (pl.plates.length) pl.plates[pl.plates.length - 1].fresh = true;
  return { recordId: rec.id || '', day: rec.day || d.day, title: dispTitle(d.title), focus: d.focus, kind: d.kind, credit: credit, pounds: sm.pounds || 0,
    setsDone: d.items.reduce(function (a, x) { return a + x.logs.length; }, 0), setsTotal: d.items.reduce(function (a, x) { return a + (x.skipped ? x.logs.length : Math.max(x.n, x.logs.length)); }, 0),
    goalMinutes: goal, dist: d.kind === 'cardio' ? d.dist || 0 : 0, rows: rows, records: recCards(sm.records), nothingChanges: d.kind === 'recovery' && next.every(function (r) { return r.change === 'fixed'; }),
    plates: pl.plates, earlier: pl.earlier };
}
function sessToneOf(d) { return d.kind === 'recovery' ? 'recover' : toneOf(d.focus); }
/* "See summary" with no kept summary: rebuilt from the engine's record (no change sizes, so only Same and Skipped are tagged) */
function summaryFromRecord(id) {
  var f = q('record', { id: id }), rec = f.ok && f.record; if (!rec) return null;
  var items = rec.items || [], ex = [], earlier = {}, sets = 0, total = 0, goal = 0;
  function did(it, logs) { var l = it.logType; if (!logs.length) return it.skipped ? 'Skipped today' : 'Not logged today'; return 'Today ' + logged({ item: it, logs: logs }); }
  function logsOf(it) { return it.logType === 'cardio' ? ((it.minutes || 0) > 0 ? [{ w: 0, r: it.minutes }] : []) : (it.sets || []).map(function (s) { return { w: s.weight || 0, r: s.reps != null ? s.reps : s.seconds || 0 }; }); }
  items.forEach(function (it) {
    var lg = logsOf(it); ex.push({ it: it, logs: lg });
    if (it.earlier) { var el = logsOf(it.earlier); if (el.length) { earlier[it.slot] = { name: it.earlier.name, did: did(it.earlier, el) }; sets += el.length; total += el.length; } }
    if (it.logType === 'cardio') goal += (it.target && it.target.minutes) || 0;
    else { sets += lg.length; total += Math.max((it.target && it.target.sets) || 0, lg.length); }
  });
  var rows = [];
  (rec.next || []).forEach(function (row) {
    var e = ex.filter(function (y) { return y.it.slot === row.slot; })[0], skipped = row.change === 'skipped';
    if (earlier[row.slot]) rows.push(earlierRow(row.slot, earlier[row.slot].name, earlier[row.slot].did, '', true));
    var dd = e && e.logs.length ? did(e.it, e.logs) : e && e.it.logType === 'cardio' ? 'Not logged today' : 'Skipped today';
    rows.push({ slot: row.slot, name: (e && e.it.name) || '', tag: skipped ? 'Skipped' : row.change === 'same' ? 'Same' : '', cls: 'same', did: dd, next: row.text || '', why: skipped ? 'Same target next time.' : row.reason || '' });
  });
  var m = rec.durationMinutes || 0, pl = sumPlates(PROG, null);
  return { recordId: rec.id, day: rec.day, title: dispTitle(rec.title || 'Workout'), focus: rec.focus, kind: rec.kind || 'training',
    credit: { minutes: m, earned: Math.round(m * rate()), shield: '', shields: shields(), movedToday: movedToday(), goal: goalMin() },
    pounds: rec.pounds || 0, setsDone: sets, setsTotal: total, goalMinutes: goal, dist: Math.floor((rec.distanceHundredths || 0) / 10), rows: rows, records: recCards(rec.records),
    nothingChanges: rec.kind === 'recovery' && (rec.next || []).every(function (r) { return r.change === 'fixed'; }), plates: pl.plates, earlier: pl.earlier };
}
function summaryNow() {
  var d = DAYS[0], rid = d && d.raw && d.raw.recordId;
  if (SUM && ((rid && SUM.recordId === rid) || (!rid && SUM.day === coachToday()))) return SUM;
  if (!rid || !(d && d.done)) return null;
  SUM = summaryFromRecord(rid);
  return SUM;
}
function finishWorkout(seeded) {
  if (!running()) return false;
  var d = ACT, min = Math.round(sessEl() / 60000);
  UI.sheet = null; UI.wedit = null;
  if (min < 1) { cxRun('cancelSession', today()); ACT = null; writeActive(null); refresh(); if (!seeded) { closeCover(); toast('Too short to count - nothing logged.'); } return false; }
  var items = finishItems(d, min), sh0 = shields();
  var r = cxRun('completeSession', { today: coachToday(), workoutId: d.workoutId, durationMinutes: Math.min(600, min), items: items });
  /* earning comes from time moved, so it is credited once whether or not the engine took the log */
  var c = null; try { c = typeof creditWorkout === 'function' ? creditWorkout(dispTitle(d.title), min, { silent: true, quiet: !!seeded, kind: 'coach' }) : null; } catch (e) { c = null; }
  var credit = { minutes: min, earned: c ? c.earned : Math.round(min * rate()), shield: c && c.shieldBanked ? 'banked' : min >= 30 && sh0 >= 2 ? 'full' : '', shields: shields(), movedToday: movedToday(), goal: goalMin() };
  if (r.ok) {
    (d.pendingAlways || []).forEach(function (p) { cxRun('swapExercise', { today: coachToday(), workoutId: d.workoutId, slot: p.slot, exerciseId: p.exerciseId, scope: 'always' }); });
    ACT = null; writeActive(null); refresh();
    SUM = buildSummary(r, d, credit); writeSum(SUM);
    UI.cover = 'summary';
    if (!seeded) { render(true); buzz([20, 40, 20]); say('Workout done. ' + credit.earned + ' minutes of scroll time earned.'); }
    return true;
  }
  cxRun('cancelSession', today());
  var s2 = cxRun('logFreeWorkout', { today: coachToday(), label: dispTitle(d.title), durationMinutes: Math.min(600, min) });
  ACT = null; writeActive(null); refresh();
  if (!seeded) { closeCover(); toast(s2.ok ? 'Saved as a timed workout. Your plan did not change.' : 'Your plan did not change.'); }
  return false;
}
function discardWorkout() {
  cxRun('cancelSession', today()); ACT = null; writeActive(null); UI.sheet = null; UI.wedit = null; refresh(); closeCover();
  toast('Workout discarded. Nothing was saved.');
}
/* a reload, another tab or an older draft: the draft follows the engine's running session (rule: no draft, no session) */
function ensureDraft() {
  if (!ACTIVE) return;
  if (!ACT || ACT.v !== 2 || !Array.isArray(ACT.items) || ACT.workoutId !== ACTIVE.workoutId) { ACT = newDraft(ACTIVE, (ACT && ACT.startedAt) || Date.now()); saveAct(); }
}

/* ---------- the summary (5.24) ---------- */
function vSummary() {
  var m = summaryNow(); if (!m) return '';
  var cr = m.credit, met = cr.movedToday >= cr.goal, tiles = [], h, next = '', stat;
  tiles.push('<div class="tile"><b>' + cr.minutes + '<small>min</small></b><span>Time</span></div>');
  if (m.kind === 'training') {
    tiles.push('<div class="tile"><b>' + nf(m.pounds) + '<small>lb</small></b><span>Lifted</span></div>');
    tiles.push('<div class="tile"><b>' + m.setsDone + '<small>of ' + m.setsTotal + '</small></b><span>Sets</span></div>');
  } else {
    tiles.push('<div class="tile"><b>' + m.goalMinutes + '<small>min</small></b><span>Goal</span></div>');
    if (m.dist) tiles.push('<div class="tile"><b>' + (m.dist / 10).toFixed(1) + '<small>mi</small></b><span>Distance</span></div>');
  }
  var art = COMPACT ? { w: 230, h: 96, rx: 54, u: 0.62, base: m.earlier > 0 } : { w: 300, h: 138, rx: 74, u: 0.85, base: m.earlier > 0 };
  h = '<div class="scr cover" data-tone="done"><div class="scroll">' +
    '<div class="hdr sub" style="padding-left:20px"><h1 tabindex="-1" data-focus>Workout done</h1>' + sampleTag() + '<span class="grow"></span>' + iconBtn('sum-done', '', 'x', 'Close summary') + '</div>' +
    '<div class="sumhero"><div class="art">' + stackSVG(m.plates, art) + '</div>' +
    '<b class="big">+' + cr.earned + ' min</b><span class="cap">of scroll time earned</span><span class="sub">' + esc(m.title) + ' · ' + fmtD(m.day) + '</span></div>' +
    '<div class="tiles3"' + (tiles.length === 2 ? ' style="grid-template-columns:1fr 1fr"' : '') + '>' + tiles.join('') + '</div>';
  stat = '<div class="statline' + (met ? ' mint' : '') + '">' + ic(met ? 'check' : 'walk', 'i20') + '<span>' + (met ? 'Moved <b>' + cr.movedToday + ' min</b> today · ' + cr.goal + '-min goal met' : 'Moved <b>' + cr.movedToday + ' of ' + cr.goal + ' min</b> today') + '</span></div>';
  if (cr.shield === 'banked') stat += '<div class="statline">' + ic('shield', 'i20') + '<span><b>Streak Shield banked</b> · ' + cr.shields + ' of 2 Shields' + (cr.shields >= 2 ? ' · full' : '') + '</span></div>';
  if (cr.shield === 'full') stat += '<div class="statline">' + ic('shield', 'i20') + '<span><b>Shields full</b> · 2 of 2. You already hold the most, so none was added.</span></div>';
  stat += '<p class="note mx" style="margin-top:10px;text-align:center">Scroll time comes from minutes moved. Reps and pounds never change what you earn.</p>';
  if (m.nothingChanges) stat += '<p class="note mx" style="margin-top:6px;text-align:center;color:var(--text-2)">Nice work - same plan next time.</p>';
  else if (m.rows.length) {
    next = '<div class="secrow"><span class="label">Next time</span><span class="aside">From what you logged</span></div><div class="card mx" style="padding:4px 16px">' + m.rows.map(function (r) {
      return '<div class="nrow"><div class="top"><h3>' + esc(r.name) + '</h3>' + (r.tag ? '<span class="tag ' + r.cls + '">' + esc(r.tag) + '</span>' : '') + '</div>' +
        '<p class="did">' + esc(r.did) + '</p>' + (r.next ? '<p class="to"><span>Next: </span>' + esc(r.next) + '</p>' : '') + (r.why ? '<p class="why">' + esc(r.why) + '</p>' : '') + '</div>';
    }).join('') + '</div>';
  }
  if (COMPACT) { h += next; next = ''; }
  h += stat;
  if (m.records.length) {
    h += '<div class="secrow"><span class="label">New records</span><span class="aside">All time</span></div>';
    m.records.forEach(function (r) {
      h += '<div class="rec"><span class="orb">' + ic('trophy', 'i20') + '</span><div><h3>' + esc(r.name) + '</h3><p>' + r.lines.map(function (l) { return esc(l.lead) + ': <b>' + esc(l.value) + '</b>' + (l.est ? '<span class="est">Estimated</span>' : ''); }).join('<br>') + '</p></div></div>';
    });
  }
  h += next;
  return h + '</div><div class="foot"><div class="two"><button class="btn btn-secondary" data-a="sum-progress">' + ic('chart') + 'See progress</button><button class="btn btn-end" data-a="sum-done">Done</button></div></div></div>';
}

/* ---------- Your week (5.12) ---------- */
function vWeek() {
  var tw = WK.thisWeek || { done: 0, target: 0, text: '' }, i, dots = '';
  for (i = 0; i < (tw.target || 0); i++) dots += '<i' + (i < (tw.done || 0) ? ' class="on"' : '') + '>' + ic('check', 'i14') + '</i>';
  var stops = DAYS.map(function (d, n) { return TONE[d.done ? 'done' : d.tone][0] + ' ' + Math.round(n / Math.max(1, DAYS.length - 1) * 100) + '%'; }).join(', ');
  return '<div class="scr cover"><div class="scroll">' + subHdr('Your week') +
    '<div class="card wkcard"><div><h3>' + esc(tw.text) + '</h3><p>Missed days wait for you.</p></div><div class="dots" role="img" aria-label="' + esc(tw.text) + '">' + dots + '</div></div>' +
    '<div class="tl"><span class="rail" style="top:35px;bottom:35px;background:linear-gradient(180deg,' + stops + ')"></span>' +
    DAYS.map(function (d) {
      return '<button class="trow' + (d.i === 0 ? ' now' : '') + '" data-tone="' + (d.done ? 'done' : d.tone) + '" data-a="day" data-v="' + d.i + '"><span class="node">' + ic(d.done ? 'check' : d.g) + '</span>' +
        '<span style="min-width:0"><span class="dw">' + (d.i < 2 ? dayName(d.key, d.i) + ' · ' : '') + fmtD(d.key) + '</span><h3>' + esc(d.title) + '</h3><p>' + esc(d.summary) + '</p></span>' + ic('chevR', 'i16 go') + '</button>';
    }).join('') + '</div>' +
    '<p class="note mx" style="margin-top:14px">Week ' + (WK.weeksOnPlan || 1) + ' on your plan. Your week always starts from today. If you miss a workout it moves to your next training day.</p>' +
    '<div class="mx" style="margin-top:14px;padding-bottom:8px"><button class="btn btn-secondary" data-a="open-edit">' + ic('edit') + 'Edit my plan</button></div></div></div>';
}

/* ---------- Your progress (5.13, 5.14) ---------- */
var BAR_ORDER = ['push', 'pull', 'legs', 'upper', 'full', 'core', 'cardio', 'recover'];
var TONE_NAME = { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', full: 'Full body', core: 'Core', cardio: 'Cardio', recover: 'Recover', rest: 'Rest' };
function shortK(n) { return n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(n); }
function shortBig(n) { return n >= 1000000 ? (Math.round(n / 10000) / 100) + 'M' : nf(n); }
function pv() { return UI.pv || (UI.pv = {}); }
function byTone(w, field) { var o = {}; Object.keys(w.byFocus || {}).forEach(function (k) { var t = toneOf(k), v = (w.byFocus[k] || {})[field] || 0; if (v) o[t] = (o[t] || 0) + v; }); return o; }
function weekChart(P, byPounds) {
  var weeks = P.weeklyPounds || [], max = 1, used = {}, cols = '', axis = '', list = '', fld = byPounds ? 'pounds' : 'workouts';
  weeks.forEach(function (w) { max = Math.max(max, w[fld] || 0); });
  weeks.forEach(function (w, n) {
    var src = byTone(w, fld), tot = w[fld] || 0, now = n === weeks.length - 1, segs = '';
    BAR_ORDER.slice().reverse().forEach(function (t) { if (src[t]) { used[t] = 1; segs += '<i data-tone="' + t + '" style="height:' + Math.max(3, Math.round(src[t] / max * 118)) + 'px"></i>'; } });
    cols += '<div class="col' + (now ? ' cur' : '') + (tot ? '' : ' flat') + '"><span class="v">' + (tot ? (byPounds ? shortK(tot) : tot) : '') + '</span>' + (segs || '<i></i>') + '</div>';
    var dd = dateOf(w.weekStart);
    axis += '<span' + (now ? ' class="cur"' : '') + '>' + (dd.getMonth() + 1) + '/' + dd.getDate() + '</span>';
    list = '<div><span>Week of ' + fmtS(w.weekStart) + (now ? ' (this week)' : '') + '</span><b>' + (byPounds ? nf(tot) + ' lb' : plural(tot, 'workout')) + '</b></div>' + list;
  });
  var legend = BAR_ORDER.filter(function (t) { return used[t]; }).map(function (t) { return '<span data-tone="' + t + '"><i></i>' + TONE_NAME[t] + '</span>'; }).join('');
  return '<div class="card chart" role="img" aria-label="' + (byPounds ? 'Pounds lifted' : 'Workouts finished') + ' in each of the last 8 weeks. Use Show as a list for the numbers.">' +
    (pv().wlist ? '<div class="tlist" style="margin-top:-8px">' + list + '</div>' : '<div class="bars">' + cols + '</div><div class="axis">' + axis + '</div>') +
    '<div class="legend">' + legend + '</div>' +
    (byPounds ? '<p class="note" style="text-align:center;margin-top:8px">Bars are colored by the kind of day. Core, cardio and recovery days add no pounds.</p>' : '<p class="note" style="text-align:center;margin-top:8px">Bodyweight reps add no pounds, so this chart counts your workouts instead.</p>') +
    '<div class="btnrow"><button class="btn btn-ghost quiet" data-a="toggle" data-v="wlist">' + ic(pv().wlist ? 'chart' : 'list') + (pv().wlist ? 'Show as a chart' : 'Show as a list') + '</button></div></div>';
}
/* the lift chips: weightReps lifts with 2 or more sessions, in the color of the newest workout that holds the lift */
var LIFT_TONE = {};
function liftTone(id) {
  if (LIFT_TONE[id]) return LIFT_TONE[id];
  var lp = q('liftProgress', { today: coachToday(), exerciseId: id }), pts = (lp.ok && lp.points) || [], last = pts[pts.length - 1], tone = 'brand';
  if (last && last.recordId) { var r = q('record', { id: last.recordId }); if (r.ok && r.record) tone = r.record.kind === 'recovery' ? 'recover' : toneOf(r.record.focus); }
  if (tone === 'rest') tone = 'brand';
  return (LIFT_TONE[id] = tone);
}
function lineChart(id, name, tone) {
  var lp = q('liftProgress', { today: coachToday(), exerciseId: id }), pts = (lp.ok && lp.points) || [];
  if (pts.length < 2) return '';
  var c = TONE[tone] || TONE.brand, Wd = 322, H = 176, L0 = 34, R0 = 44, T0 = 14, B0 = 26, lo = Infinity, hi = -Infinity;
  pts.forEach(function (p) { lo = Math.min(lo, p.heaviest); hi = Math.max(hi, p.estimatedMax || p.heaviest); });
  lo = Math.max(0, Math.floor((lo - 8) / 10) * 10); hi = Math.ceil((hi + 6) / 10) * 10; if (hi <= lo) hi = lo + 10;
  function X(i) { return L0 + (Wd - L0 - R0) * (pts.length === 1 ? 0.5 : i / (pts.length - 1)); }
  function Y(v) { return T0 + (H - T0 - B0) * (1 - (v - lo) / (hi - lo)); }
  var g = '', k, v, runs = [], run = [];
  for (k = 0; k <= 3; k++) { v = lo + (hi - lo) * k / 3; g += '<line x1="' + L0 + '" x2="' + (Wd - R0) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="rgba(255,255,255,.07)"/><text x="' + (L0 - 7) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end" font-size="11" font-weight="600" fill="rgba(240,244,255,.55)">' + Math.round(v) + '</text>'; }
  /* the estimated max line breaks where a point has none (no work set of 12 reps or fewer) */
  pts.forEach(function (p, i) { if (p.estimatedMax) run.push(X(i).toFixed(1) + ',' + Y(p.estimatedMax).toFixed(1)); else { if (run.length) runs.push(run); run = []; } });
  if (run.length) runs.push(run);
  var pw = pts.map(function (p, i) { return X(i).toFixed(1) + ',' + Y(p.heaviest).toFixed(1); }).join(' '), last = pts[pts.length - 1], n = pts.length - 1;
  var svg = '<svg viewBox="0 0 ' + Wd + ' ' + H + '" width="100%" aria-hidden="true" style="display:block;overflow:visible">' + g +
    runs.map(function (r) { return '<polyline points="' + r.join(' ') + '" fill="none" stroke="rgba(240,244,255,.62)" stroke-width="1.8" stroke-dasharray="4 5" stroke-linecap="round"/>'; }).join('') +
    '<polyline points="' + pw + '" fill="none" stroke="' + c[0] + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 6px ' + c[0] + ')"/>' +
    pts.map(function (p, i) { return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.heaviest).toFixed(1) + '" r="' + (i === n ? 5 : 3.2) + '" fill="' + (i === n ? c[1] : '#0B0F1A') + '" stroke="' + c[0] + '" stroke-width="2"/>'; }).join('') +
    '<text x="' + (X(n) + 9).toFixed(1) + '" y="' + (Y(last.heaviest) + 4).toFixed(1) + '" font-size="12" font-weight="800" fill="' + c[1] + '">' + last.heaviest + ' lb</text>' +
    (last.estimatedMax ? '<text x="' + (X(n) + 9).toFixed(1) + '" y="' + (Y(last.estimatedMax) + 4).toFixed(1) + '" font-size="12" font-weight="700" fill="rgba(240,244,255,.8)">' + last.estimatedMax + ' lb</text>' : '') +
    '<text x="' + L0 + '" y="' + (H - 6) + '" font-size="11" font-weight="600" fill="rgba(240,244,255,.55)">' + fmtS(pts[0].day) + '</text>' +
    '<text x="' + (Wd - R0) + '" y="' + (H - 6) + '" text-anchor="end" font-size="11" font-weight="600" fill="rgba(240,244,255,.55)">' + fmtS(last.day) + '</text></svg>';
  var list = pts.slice().reverse().map(function (p) { return '<div><span>' + fmtS(p.day) + '</span><b>' + p.heaviest + ' lb' + (p.estimatedMax ? ' · estimated max ' + p.estimatedMax + ' lb' : '') + '</b></div>'; }).join('');
  return '<div class="card chart" data-tone="' + tone + '" role="img" aria-label="' + esc(name) + ': heaviest set and estimated max over time. Use Show as a list for the numbers.">' +
    (pv().llist ? '<div class="tlist" style="margin-top:-8px">' + list + '</div>' : svg) +
    '<div class="legend"><span data-tone="' + tone + '"><i></i>Heaviest set</span><span><i class="dash"></i>Estimated max</span></div>' +
    '<p class="note" style="text-align:center;margin-top:8px">Estimated max: about the most you could lift once, worked out from your sets. Not a test.</p>' +
    '<div class="btnrow"><button class="btn btn-ghost quiet" data-a="toggle" data-v="llist">' + ic(pv().llist ? 'chart' : 'list') + (pv().llist ? 'Show as a chart' : 'Show as a list') + '</button></div></div>';
}
function recordCards(P) {
  var list = (P.liftRecords || []).filter(function (r) { return r.heaviest || r.mostReps || r.longestHold; }), out = '', explained = false;
  function split(t) { t = String(t || ''); var k = t.indexOf(': '); return k < 0 ? ['', t] : [t.slice(0, k), t.slice(k + 2)]; }
  list.slice(0, pv().allrec ? 99 : 4).forEach(function (r) {
    var lines = [], s;
    if (r.heaviest) { s = split(r.heaviest.text); lines.push(esc(s[0]) + ': <b>' + esc(s[1]) + '</b>'); }
    if (r.bestEstimatedMax) { lines.push((explained ? 'Best max: ' : 'Best max (about the most you could lift once): ') + '<b>' + r.bestEstimatedMax.value + ' lb</b><span class="est">Estimated</span>'); explained = true; }
    if (r.mostReps) { s = split(r.mostReps.text); lines.push(esc(s[0]) + ': <b>' + esc(s[1]) + '</b>'); }
    if (r.longestHold) { s = split(r.longestHold.text); lines.push(esc(s[0]) + ': <b>' + esc(s[1]) + '</b>'); }
    out += '<div class="rec"><span class="orb">' + ic('trophy', 'i20') + '</span><div><h3>' + esc(r.name) + '</h3><p>' + lines.join('<br>') + '</p></div></div>';
  });
  if (list.length > 4) out += '<div class="btnrow"><button class="btn btn-ghost quiet" data-a="toggle" data-v="allrec">' + (pv().allrec ? 'Show fewer' : 'Show all ' + list.length + ' lifts') + '</button></div>';
  return { n: list.length, html: out };
}
function recTone(r) { return r.kind === 'free' ? 'brand' : r.kind === 'recovery' ? 'recover' : toneOf(r.focus); }
function emptyCard(icon, title, text) { return '<div class="card empty mx">' + ic(icon, 'i28') + '<h3>' + title + '</h3><p>' + text + '</p></div>'; }
function vProgress() {
  var P = PROG && PROG.ok ? PROG : { hasData: false, pounds: {}, weeklyPounds: [], liftRecords: [], recent: [] }, pd = P.pounds || {}, h;
  function tiles() {
    return '<div class="secrow"><span class="label">Pounds lifted</span></div><div class="tiles3 pl" style="margin-top:0">' +
      [['All time', pd.lifetime || 0, 'wide'], ['This week', pd.thisWeek || 0], ['Last 30 days', pd.last30Days || 0]].map(function (t) { return '<div class="tile' + (t[2] ? ' wide' : '') + '"><b>' + shortBig(t[1]) + '<small>lb</small></b><span>' + t[0] + '</span></div>'; }).join('') + '</div>' +
      '<p class="note mx" style="margin-top:10px">Weight × reps of every set. Bodyweight reps add no pounds.</p>';
  }
  if (!P.hasData) {
    return '<div class="scr cover"><div class="scroll">' + subHdr('Your progress') +
      '<div class="card stackhero"><div class="art">' + stackSVG([], { w: 300, h: 150, rx: 86, ghost: true }) + '</div><b class="big plain">0</b><span class="unit">workouts finished</span>' +
      '<span class="cap">Your first workout sets down the first plate.</span>' +
      '<button class="btn btn-cta" style="margin-top:16px" data-a="back">' + ic('play') + 'Go to today\'s workout</button></div>' + tiles() +
      '<div class="secrow"><span class="label">Each week</span><span class="aside">Last 8 weeks</span></div><div class="card chart"><div class="bars" style="height:64px">' + (P.weeklyPounds || []).map(function () { return '<div class="col flat"><i></i></div>'; }).join('') + '</div>' +
      '<div class="axis">' + (P.weeklyPounds || []).map(function (w) { var dd = dateOf(w.weekStart); return '<span>' + (dd.getMonth() + 1) + '/' + dd.getDate() + '</span>'; }).join('') + '</div>' +
      '<p class="note" style="text-align:center;margin-top:10px">No weeks yet. Your first finished workout starts this chart.</p></div>' +
      '<div class="secrow"><span class="label">Your lifts</span></div>' + emptyCard('chart', 'No lines yet', 'Each main lift gets its own line once you have logged it twice.') +
      '<div class="secrow"><span class="label">Records</span></div>' + emptyCard('trophy', 'No records yet', 'Records start the second time you do a lift. A first time is never a record.') +
      '<div class="secrow"><span class="label">Recent workouts</span></div>' + emptyCard('list', 'Nothing here yet', 'Every workout you finish is listed here.') + '</div></div>';
  }
  var recent = P.recent || [], plates = platesFrom(recent.filter(function (r) { return r.kind !== 'free'; }).slice(0, 10).reverse()), done = P.workoutsCompleted || 0, older = Math.max(0, done - plates.length), used = {}, legend = '';
  plates.forEach(function (p) { used[p.tone] = 1; });
  BAR_ORDER.forEach(function (t) { if (used[t]) legend += '<span data-tone="' + t + '"><i></i>' + TONE_NAME[t] + '</span>'; });
  var tw = P.thisWeek && P.thisWeek.text ? P.thisWeek.text + ' · week ' + (P.weeksOnPlan || 1) + ' on your plan<br>' : '';
  h = '<div class="scr cover"><div class="scroll">' + subHdr('Your progress') +
    '<div class="card stackhero"><div class="art">' + stackSVG(plates, { w: 300, h: 186, rx: 90, base: older > 0, baseLabel: older > 0 ? older + ' earlier' : '' }) + '</div>' +
    '<b class="big">' + done + '</b><span class="unit">' + (done === 1 ? 'workout finished' : 'workouts finished') + ' · all time</span>' +
    '<span class="cap">' + esc(tw).replace('&lt;br&gt;', '<br>') + 'One plate for every workout, in the color of that day.</span><div class="legend">' + legend + '</div></div>' + tiles();
  var byPounds = (pd.lifetime || 0) > 0;
  h += '<div class="secrow"><span class="label">' + (byPounds ? 'Pounds each week' : 'Workouts each week') + '</span><span class="aside">Last 8 weeks</span></div>' + weekChart(P, byPounds);
  var lifts = (P.liftRecords || []).filter(function (r) { return r.logType === 'weightReps' && r.sessions >= 2; });
  h += '<div class="secrow"><span class="label">Your lifts</span><span class="aside">Since you started</span></div>';
  if (lifts.length) {
    var sel = lifts.filter(function (r) { return r.exerciseId === pv().lift; })[0] || lifts[0]; pv().lift = sel.exerciseId;
    h += '<div class="liftchips">' + lifts.map(function (r) { var on = r.exerciseId === sel.exerciseId; return '<button data-tone="' + liftTone(r.exerciseId) + '" class="' + (on ? 'on' : '') + '" data-a="lift" data-v="' + esc(r.exerciseId) + '" aria-pressed="' + on + '">' + esc(r.name) + '</button>'; }).join('') + '</div><div style="height:10px"></div>' + lineChart(sel.exerciseId, sel.name, liftTone(sel.exerciseId));
  } else h += emptyCard('chart', 'No lines yet', 'Each main lift gets its own line once you have logged it twice.');
  var rc = recordCards(P);
  h += '<div class="secrow"><span class="label">Your records</span><span class="aside">All time</span></div>' + (rc.n ? rc.html : emptyCard('trophy', 'No records yet', 'Records start the second time you do a lift. A first time is never a record.'));
  var rows = recent.slice(0, pv().allrecent ? 10 : 5).map(function (r) {
    var t = recTone(r);
    return '<button class="rrow" data-a="recent" data-v="' + esc(r.id) + '">' + gem(t, r.kind === 'free' ? freeIcon(r.title) : GLYPH[t], 'sm') + '<span><h3>' + esc(dispTitle(r.title)) + '</h3><p>' + fmtD(r.day) + ' · ' + esc(dispSummary(r.summary)) + '</p></span>' + ic('chevR', 'i16 go') + '</button>';
  }).join('');
  h += '<div class="secrow"><span class="label">Recent workouts</span><span class="aside">Last ' + Math.min(10, recent.length) + '</span></div>' + (rows ? '<div class="card mx" style="padding:4px 14px 4px 12px">' + rows + '</div>' : emptyCard('list', 'Nothing here yet', 'Every workout you finish is listed here.')) +
    (recent.length > 5 ? '<div class="btnrow"><button class="btn btn-ghost quiet" data-a="toggle" data-v="allrecent">' + (pv().allrecent ? 'Show fewer' : 'Show all ' + recent.length) + '</button></div>' : '') +
    (P.freeWorkouts ? '<p class="note mx" style="margin-top:10px">Plus ' + plural(P.freeWorkouts, 'workout') + ' you timed without the coach.</p>' : '');
  return h + '<div style="height:12px"></div></div></div>';
}
/* ---------- Recent workout (5.15) ---------- */
function shRecent(id) {
  var f = q('record', { id: id }), r = f.ok && f.record; if (!r) return '';
  var t = recTone(r), items = r.items || [], exn = items.filter(function (x) { return !x.skipped || x.earlier; }).length, desc = r.kind === 'free' ? '' : ((catalog().tables || {}).descriptions || {})[r.focus] || '';
  var tiles = '<div class="tile"><b>' + (r.durationMinutes || 0) + '<small>min</small></b><span>Time</span></div>';
  if (r.kind === 'training') tiles += '<div class="tile"><b>' + nf(r.pounds || 0) + '<small>lb</small></b><span>Lifted</span></div>';
  tiles += '<div class="tile"><b>' + exn + '</b><span>' + (exn === 1 ? 'Exercise' : 'Exercises') + '</span></div>';
  var nrec = (r.records || []).length;
  return shell(fmtD(r.day), '<div class="dayhead">' + gem(t, r.kind === 'free' ? freeIcon(r.title) : GLYPH[t], 'lg lit') + '<div><h3>' + esc(dispTitle(r.title)) + '</h3>' + (desc ? '<p>' + esc(desc) + '</p>' : '') + '</div></div>' +
    '<div class="tiles3" style="margin:14px 0 0' + (r.kind === 'training' ? '' : ';grid-template-columns:1fr 1fr') + '">' + tiles + '</div>' +
    (nrec ? '<div class="statline" style="margin:10px 0 0">' + ic('trophy', 'i20 gold') + '<span><b>' + plural(nrec, 'new record') + '</b> that day</span></div>' : '') +
    '<div class="statline" style="margin:10px 0 0">' + ic('bolt', 'i20') + '<span><b>+' + Math.round((r.durationMinutes || 0) * rate()) + ' min</b> of scroll time earned</span></div>', { tone: t, sample: SAMPLE });
}
/* test addresses only (?coach=, ?coachSeed=): the in-memory coach state as the engine's own save text, so a check can ask the same
   engine for the numbers on screen. It reads nothing from storage and returns null on a real (stored) plan. */
function coachTestText() { if (!MEM || !READY) return null; try { var r = E.run('save', ST, {}); return r.result && r.result.ok ? r.result.text : null; } catch (e) { return null; } }
window.coachTestText = coachTestText;
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
    case 'session': ensureDraft(); return running() ? vSession() : '';
    case 'week': return hasPlan() ? vWeek() : '';
    case 'progress': return hasPlan() ? vProgress() : '';
    case 'summary': return hasPlan() ? vSummary() : '';
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
    case 'recent': return sh.id ? shRecent(sh.id) : '';
    case 'swap': return running() ? shSwap() : ''; case 'menu': return running() ? shMenu() : '';
    case 'xlist': return running() ? shXList() : ''; case 'pause': return running() ? shPause() : '';
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
    var keep = ckey && ckey === coverKeyOpen && cv.contains(document.activeElement) ? selOf(document.activeElement) : '';
    cv.innerHTML = chtml; cv.classList.toggle('on', !!UI.cover); cv.classList.toggle('compact', COMPACT);
    if (UI.cover) { cv.setAttribute('role', 'dialog'); cv.setAttribute('aria-modal', 'true'); cv.setAttribute('aria-label', coverLabel()); } else { cv.removeAttribute('role'); cv.removeAttribute('aria-modal'); cv.removeAttribute('aria-label'); }
    var nsc = cv.querySelector('.scroll'); if (nsc) nsc.scrollTop = cst;
    if (ckey && ckey !== coverKeyOpen) { if (cv.firstElementChild && nav !== false && !reduced()) cv.firstElementChild.classList.add('enter'); focusIn(cv); }
    else if (keep) refocus(keep, '#cx-cover .logbtn');
  }
  coverKeyOpen = ckey;
  document.body.classList.toggle('cx-cover-open', !!UI.cover);
  /* the resume bar: a running workout or timer is one tap away on every tab (COACH_SPEC 7) */
  var mini = $('#cx-mini'), f = freeRun(), runS = running() && UI.cover !== 'session', showMini = runS || (!!f && UI.cover !== 'free');
  if (mini) {
    mini.classList.toggle('on', showMini);
    if (runS) {
      var mt = sessTone(), mtr = ACT.kind === 'training';
      mini.setAttribute('aria-label', 'Back to ' + dispTitle(ACT.title).toLowerCase()); mini.setAttribute('data-tone', mt);
      mini.innerHTML = gem(mt, GLYPH[mt], 'sm') + '<span class="tx"><b>' + esc(dispTitle(ACT.title)) + ' · <i data-clk>' + clock(sessEl() / 1000) + '</i></b><span>' + (mtr ? setsDone() + ' of ' + setsTotal() + ' sets' : 'Logged by time') + (ACT.pausedAt ? ' · paused' : '') + '</span></span><span class="mopen">' + ic('up', 'i18') + '</span>';
    } else if (showMini) {
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
  var key = UI.sheet ? UI.sheet.n + ':' + (UI.sheet.i != null ? UI.sheet.i : '') + ':' + (UI.sheet.c || '') + ':' + (UI.sheet.id || '') : '';
  if (box) {
    var skeep = key && key === sheetKeyOpen && box.contains(document.activeElement) ? selOf(document.activeElement) : '';
    box.innerHTML = shtml; box.classList.toggle('on', !!key);
    if (key && key === sheetKeyOpen) { Array.prototype.forEach.call(box.children, function (n) { n.classList.add('still'); }); var nsb = box.querySelector('.sb'); if (nsb) nsb.scrollTop = sst; if (skeep) refocus(skeep, '#cx-sheets .sheet'); }
    else if (key) { var she = box.querySelector('.sheet'); if (she) { try { she.focus({ preventScroll: true }); } catch (e) {} } }
  }
  sheetKeyOpen = key;
  document.body.classList.toggle('cx-sheet-open', !!key);
  setInert(BEHIND, !!(key || UI.cover));
  var cvi = $('#cx-cover'); if (cvi) { if (key && UI.cover) cvi.setAttribute('inert', ''); else cvi.removeAttribute('inert'); }
  wake(!!UI.cover && (UI.cover === 'free' || UI.cover === 'session'));
  tickStart();
}
function coverLabel() { return { setup: 'Build my plan', edit: 'Edit my plan', free: 'Timed workout', session: ACT ? dispTitle(ACT.title) : 'Workout', week: 'Your week', progress: 'Your progress', summary: 'Workout done' }[UI.cover] || 'Coach'; }
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
/* the clocks: real timestamps (the free timer's from app.js, the workout's from its draft), painted 4 times a second;
   the rest ring and the cardio ring follow the same tick, and a rest that runs out ends here */
var TICK = null, lastLA = 0;
function tickStart() {
  var need = !!freeRun() || running();
  if (need && !TICK) TICK = setInterval(paint, 250);
  if (!need && TICK) { clearInterval(TICK); TICK = null; }
}
function paint() {
  var f = freeRun(), run = running(); if (!f && !run) { tickStart(); return; }
  if (run && ACT.rest && ACT.rest.pausedLeft == null && !ACT.pausedAt && ACT.rest.endsAt <= Date.now()) { endRest(Date.now() - ACT.rest.endsAt < 2000 ? 'auto' : 'quiet'); return; }
  var el = run ? sessEl() : freeElapsed(), t = clock(el / 1000), n = document.querySelectorAll('.cx [data-clk]'), i;
  for (i = 0; i < n.length; i++) if (n[i].textContent !== t) n[i].textContent = t;
  t = soFar(el); n = document.querySelectorAll('.cx [data-sofar]');
  for (i = 0; i < n.length; i++) if (n[i].textContent !== t) n[i].textContent = t;
  if (run) paintRings(el);
  var now = Date.now();
  if (now - lastLA >= 1000) { lastLA = now; try { if (typeof updateLiveActivityCard === 'function') updateLiveActivityCard(); } catch (e) {} }
}
function paintRings(el) {
  var c = 2 * Math.PI * 54, a = $('#cx-cover [data-arc="rest"]'), b, r = ACT.rest, left, tot;
  if (a && r) {
    left = restLeft(); a.setAttribute('stroke-dashoffset', (c * (1 - (r.total ? clamp(left / r.total, 0, 1) : 0))).toFixed(1));
    b = $('#cx-cover [data-rest]'); if (b && b.textContent !== clock(Math.ceil(left))) b.textContent = clock(Math.ceil(left));
  }
  a = $('#cx-cover [data-arc="cardio"]');
  if (a) { tot = 0; ACT.items.forEach(function (x) { tot += tval(x.item); }); a.setAttribute('stroke-dashoffset', (c * (1 - clamp(el / 1000 / Math.max(1, tot * 60), 0, 1))).toFixed(1)); }
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
/* the control that opened a sheet or cover, as a selector: every draw replaces the buttons, so the element itself would be gone */
var ROOTS = ['#cx-sheets', '#cx-cover', '#cx-mini', '#cx-pin', '#coach-home', '#tab-coach'];
function selOf(el) {
  if (!el || el === document.body || !el.closest) return '';
  if (el.id) return '#' + el.id;
  var b = el.closest('[data-a]'), root = ROOTS.filter(function (r) { return el.closest(r); })[0];
  if (!b || !root) return '';
  var v = b.getAttribute('data-v');
  return root + ' [data-a="' + b.getAttribute('data-a') + '"]' + (v != null ? '[data-v="' + v.replace(/"/g, '\\"') + '"]' : '');
}
function findSel(sel) {
  if (!sel) return null;
  var list = []; try { list = document.querySelectorAll(sel); } catch (e) { return null; }
  for (var i = 0; i < list.length; i++) if (list[i].getClientRects().length && !list[i].closest('[inert]')) return list[i];
  return null;
}
function opener() { return selOf(document.activeElement); }
function refocus(el, fallback) {
  var t = typeof el === 'string' ? findSel(el) : el && el.isConnected && el.getClientRects().length ? el : null;
  if (!t && fallback) t = findSel(fallback);
  if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
}
function openSheet(n, extra) {
  if (!UI.sheet) UI.sheetOpener = opener();
  UI.sheet = { n: n }; if (extra != null) UI.sheet.i = extra;
  render();
}
function closeSheet() {
  if (!UI.sheet) return;
  /* the Paused sheet and its Finish now? and Discard? steps: any way out (Keep going, X, Escape, the scrim) resumes (6.9) */
  if (UI.sheet.n === 'pause') resumeWorkout();
  var back = UI.sheetOpener; UI.sheet = null; UI.sheetOpener = null; render(); refocus(back, UI.cover ? '#cx-cover button' : '#coach-home button');
}
function openCover(c) {
  if (!UI.cover) UI.coverOpener = opener();
  UI.sheet = null; UI.cover = c; render(true);
}
function closeCover(target) {
  var back = UI.coverOpener; UI.cover = null; UI.coverOpener = null; render(true);
  refocus(target || back, '#coach-home button');
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
  ACT = newDraft(r.session, Date.now()); UI.wedit = null; UI.guardUntil = 0; PV.key = ''; saveAct();
  refresh(); openCover('session');
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
  var d = draft(), f, x, hadSheet = !!UI.sheet, back = UI.sheetOpener;
  actOn(a, v, el, d);
  /* a sheet closed by a choice inside it hands focus back to the control that opened it */
  if (hadSheet && !UI.sheet && (!document.activeElement || document.activeElement === document.body)) { UI.sheetOpener = null; refocus(back, UI.cover ? '#cx-cover .logbtn' : '#coach-home button'); }
}
function actOn(a, v, el, d) {
  var f, x;
  switch (a) {
    case 'close': closeSheet(); break;
    case 'sheet': if (v === 'numbers' && !UI.edit) break; openSheet(v); break;
    case 'day': openSheet('day', +v); break;
    case 'nav': openCover(v); break;
    case 'back': if (UI.cover === 'edit') UI.edit = null; closeCover(); break;
    case 'start': startPlanned(); break;
    case 'resume': if (ACTIVE) { ensureDraft(); ACT.open = true; saveAct(); openCover('session'); } break;
    case 'resume-free': if (freeRun()) { var fr = freeRun(); fr.open = true; freeSave(); openCover('free'); } break;
    case 'open-summary': openCover('summary'); break;
    /* the workout (5.18 to 5.23, 6) */
    case 'main': mainTap(); break;
    case 'step': if (running()) stepVal(v); break;
    case 'chip': if (running()) tapChip(+v); break;
    case 'addset': if (running()) addSet(); break;
    case 'remset': if (running()) remSet(); break;
    case 'skip': if (running()) skipEx(); break;
    case 'unskip': if (running()) unskip(); break;
    case 'feel': if (running()) setFeel(v); break;
    case 'rest-adj': if (running()) adjRest(+v); break;
    case 'goto': if (running()) gotoEx(+v); break;
    case 'dist': if (running()) stepDist(+v); break;
    case 'minimize': if (ACT) { ACT.open = false; saveAct(); } UI.wedit = null; closeCover('#cx-mini'); break;
    case 'pause': pauseWorkout(); break;
    case 'keep-going': closeSheet(); break;
    case 'finish-ask': if (running() && ACT.kind === 'training' && !allDone()) { UI.sheet.c = 'finish'; render(); } else finishWorkout(); break;
    case 'finish-now': finishWorkout(); break;
    case 'discard-ask': if (UI.sheet) { UI.sheet.c = 'discard'; render(); } break;
    case 'discard': discardWorkout(); break;
    case 'opt-rest': if (running()) { ACT.restOn = !ACT.restOn; prefSet('rest', ACT.restOn); if (!ACT.restOn) ACT.rest = null; sessRender(); } break;
    case 'opt-sound': if (running()) { ACT.sound = !ACT.sound; prefSet('sound', ACT.sound); sessRender(); } break;
    case 'menu-swap': if (UI.sheet) { UI.sheet = { n: 'swap' }; render(); } break;
    case 'menu-list': if (UI.sheet) { UI.sheet = { n: 'xlist' }; render(); } break;
    case 'swap-scope': if (UI.sheet) { UI.sheet.scope = v; render(); } break;
    case 'do-swap': if (running()) doSwap(v); break;
    /* the summary, Your week and Your progress */
    case 'sum-done': UI.sheet = null; closeCover('#coach-home .hero .btn'); break;
    case 'sum-progress': UI.sheet = null; UI.cover = 'progress'; render(true); break;
    case 'toggle': pv()[v] = !pv()[v]; render(); break;
    case 'lift': pv().lift = v; render(); break;
    case 'recent': if (!UI.sheet) UI.sheetOpener = opener(); UI.sheet = { n: 'recent', id: v }; render(); break;
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
      if (ACTIVE) { UI.sheet = null; render(); toast('Finish your workout first.'); break; }
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
  if (el.id === 'cx-mini') { act(running() ? 'resume' : 'resume-free', ''); return; }
  var a = el.getAttribute('data-a');
  if ((a === 'step' || a === 'dist') && HOLD.fired) { HOLD.fired = false; return; }
  act(a, el.getAttribute('data-v') || '', el);
});
/* holding a stepper repeats after 400 ms, 8 steps a second (6.2) */
var HOLD = { t: null, iv: null, fired: false };
function holdStop() { clearTimeout(HOLD.t); clearInterval(HOLD.iv); HOLD.t = HOLD.iv = null; }
document.addEventListener('pointerdown', function (e) {
  var el = e.target.closest ? e.target.closest('#cx-cover [data-a="step"], #cx-cover [data-a="dist"]') : null;
  holdStop(); HOLD.fired = false; if (!el || e.button > 0) return;
  var a = el.getAttribute('data-a'), v = el.getAttribute('data-v') || '';
  HOLD.t = setTimeout(function () {
    HOLD.fired = true; act(a, v);
    HOLD.iv = setInterval(function () { if (!running() || UI.cover !== 'session' || UI.sheet) { holdStop(); return; } act(a, v); }, 125);
  }, 400);
});
['pointerup', 'pointercancel'].forEach(function (t) { document.addEventListener(t, function () { var was = !!HOLD.t; holdStop(); if (was) setTimeout(function () { HOLD.fired = false; }, 0); }); });
window.addEventListener('blur', holdStop);
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
   no edits; setup closes only on question 1 with nothing answered yet. The workout and the ready screen stay: Escape never
   discards a set or ends a workout (on the Paused sheet it resumes, like Keep going). */
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
/* a running workout on a seed: the engine's startSession, then a draft with its clock set back el seconds */
function seedStart(el) {
  refresh();
  var d = DAYS[0]; if (!d || !d.wid || d.done) return false;
  var r = cxRun('startSession', { today: coachToday(), workoutId: d.wid }); if (!r.ok) return false;
  ACT = newDraft(r.session, Date.now() - (el || 0) * 1000); ACT.restOn = true; ACT.sound = false;
  refresh(); UI.cover = 'session';
  return true;
}
function seedSession(sd, logs, o) {
  o = o || {};
  ST = seedPlan(sd, o.kind || 'training', o.pref || 56, o.goal); SAMPLE = true;
  if (!seedStart(o.el)) return false;
  logs.forEach(function (k, i) { var x = ACT.items[i], j; if (!x) return; for (j = 0; j < k && j < x.n; j++) x.logs.push({ w: lt(x) === 'weightReps' ? x.cw : 0, r: x.cr }); });
  ACT.xi = o.xi || 0;
  return true;
}
function seedRest(left, ex) { var t = Math.max(left, (ACT.items[ACT.xi].item.restSeconds) || left); ACT.rest = { endsAt: Date.now() + left * 1000, total: t, ex: ex, pausedLeft: null }; }
/* the summary sample: the prototype's logs on the lifted moves, finished early at 46 minutes, through the real completeSession and creditWorkout */
function seedSummary(sd) {
  if (!seedSession(sd, [], { el: 2772 })) return;
  var logs = [[135, [8, 8, 8]], [85, [9, 9, 9]], [35, [11, 11, 10]], [45, [10, 10, 10]], [10, [12, 12, 12]]];
  ACT.items.forEach(function (x, i) { var l = logs[i]; if (l && lt(x) === 'weightReps') x.logs = l[1].map(function (r) { return { w: l[0], r: r }; }); });
  finishWorkout(true);
}
function route(name, seed) {
  MEM = true; SAMPLE = false; UI.sheet = null; UI.cover = null; UI.setup = null; UI.edit = null;
  ACT = null; SUM = null; UI.wedit = null; UI.guardUntil = 0; UI.pv = {}; LIFT_TONE = {}; PV.key = ''; LOAD_ERR = ''; REV++;
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
    /* the workout, at the prototype's moments: [n] = sets logged per exercise, at the target, el = seconds on the clock */
    case 'session': seedSession(sd, [1], { el: 262 }); break;
    case 'session-rest': if (seedSession(sd, [1], { el: 185 })) seedRest(92, false); break;
    case 'session-paused': if (seedSession(sd, [3, 3, 2], { xi: 2, el: 1112 })) { ACT.pausedAt = Date.now(); UI.sheet = { n: 'pause' }; } break;
    case 'session-feel': seedSession(sd, [3], { el: 560 }); break;
    case 'session-rest-ex': if (seedSession(sd, [3], { el: 560 })) seedRest(74, true); break;
    case 'session-cardio': seedSession(sd, [], { el: 850, kind: 'cardio', pref: 58, goal: 'stayFit' }); break;
    case 'session-min': if (seedSession(sd, [3, 3, 2], { xi: 2, el: 1112 })) { ACT.open = false; UI.cover = null; } break;
    case 'swap': if (seedSession(sd, [1], { el: 262 })) UI.sheet = { n: 'swap', scope: 'today' }; break;
    case 'summary': seedSummary(sd); break;
    case 'first-workout': ST = seedFresh(NUMS_PROFILE); seedStart(0); break;
    case 'week': ST = seedPlan(sd, 'training', 56); SAMPLE = true; UI.cover = 'week'; break;
    case 'progress': ST = seedPlan(sd); SAMPLE = true; UI.cover = 'progress'; break;
    case 'progress-empty': ST = seedFresh(SAMPLE_PROFILE); UI.cover = 'progress'; break;
    default: ST = seedPlan(sd); SAMPLE = true; /* a seed on its own: browse it from Coach home */
  }
  refresh();
  if (stay === 'edit') { var x = fromProfile(WK.profile); UI.edit = { d: x, o: copy(x) }; UI.cover = 'edit'; }
}
var COACH_STATES = ['first-visit', 'setup', 'setup-days', 'setup-numbers', 'setup-ready', 'first-week', 'today', 'rest-day', 'cardio-day', 'recovery-day', 'done-today', 'edit-plan', 'earned', 'change-today', 'time', 'free',
  'session', 'session-rest', 'session-paused', 'session-feel', 'session-rest-ex', 'session-cardio', 'session-min', 'swap', 'summary', 'first-workout', 'week', 'progress', 'progress-empty'];
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
    /* a reload or a closed browser comes back to the same exercise, chips, rest and clock (COACH_SPEC 7); no draft means no session */
    ACT = readActive(); SUM = readSum();
    if (ACT && !ACTIVE) { ACT = null; writeActive(null); }
    if (!ACT && ACTIVE) { cxRun('cancelSession', today()); refresh(); }
    if (ACT && ACTIVE) { ensureDraft(); if (ACT.open !== false) UI.cover = 'session'; }
    var f = freeRun(); if (f && f.open && !UI.cover) UI.cover = 'free';
  }
}
function coachRestore() {
  init(); if (!READY) return;
  if (!routed) {
    routed = true;
    var tab = param('tab');
    if ((tab === 'coach' || tab === 'earn' || stateParam() || seedParam() || (!tab && !MEM && ACT && ACTIVE)) && typeof switchTab === 'function') { switchTab('coach'); return; }
  }
  render(true);
}
function coachOnTab() { init(); if (!READY) return; render(true); }
function coachRefresh() { if (!READY) return; refresh(); render(); }
function coachSignOutCleanup() {
  if (!READY) return;
  if (ACTIVE) cxRun('cancelSession', today());
  ACT = null; writeActive(null); SUM = null; writeSum(null); UI.wedit = null;
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
