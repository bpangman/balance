/* ============================================================
   BALANCE APP - app.js
   Move to scroll. Earn social media time through exercise.
============================================================ */

// ===== STATE =====
const state = {
  remainingSeconds: 31 * 60,         // 31 min
  totalSeconds: (45 + 12) * 60,      // 45 base + 12 earned
  earnedMinutes: 12,
  streakDays: 12,
  streakShields: 0,
  dailyAllowanceMinutes: 45,
  selectedApps: ['TikTok', 'Instagram', 'YouTube'],
  currentTab: 'today',
  dailyHours: 3.5,
  earnRateMultiplier: 1,
  expiresAtMidnight: true,
  healthConnected: null,
  promoUsed: false,
  userName: '',            // doubles as the account nickname (item 5) - required once account creation exists
  account: { provider: null, accountId: null }, // item 5 - simulated SSO account
  lastWorkout: null,                 // { name, mins, at } - for honest Live Activity (B6)
  paywallYears: null,                // computed during onboarding step C, shown on paywall (B4)
  worktimeLoggedToday: [],
  pendingSession: null,               // item 2c - { appName, startedAt, plannedMinutes }
  activeWorkout: null,                // item 3b - { name, startedAt, pausedTotalMs, pausedAt }
  currentDay: null,                   // WF-03 - the calendar day these numbers belong to (YYYY-MM-DD)
  unlockMinutesToday: 0,              // W3 - minutes a partner approved today; not earned time, reset at midnight
  workoutGoalMin: 30,                 // WONB - daily movement goal, set in setup, editable in Settings
  // WFIX - when monitoring began (ms): the moment setup finished, or the first
  // app pick if none was picked then (null until that pick). A save from
  // before this field existed has no key at all and counts as "before today".
  monitoringStartedAt: undefined,
};

// W4 - app marks (DESIGN 2 app-mark table): a generic glyph or a single letter
// on the brand color. No real logo is drawn or bundled; the glyphs come from
// the sprite at the top of index.html.
const APP_ICONS = {
  Instagram: { bg: 'linear-gradient(135deg,#F09433,#E6683C,#DC2743,#CC2366,#BC1888)', glyph: 'i-camera' },
  TikTok:    { bg: '#010101', glyph: 'i-note' },
  X:         { bg: '#000', letter: 'X' },
  YouTube:   { bg: '#FF0000', glyph: 'i-play' },
  Snapchat:  { bg: '#FFFC00', letter: 'S', textColor: '#000' },
  Reddit:    { bg: '#FF4500', letter: 'R' },
};
const FALLBACK_APP_MARK = { bg: '#333', glyph: 'i-move' };

function appMarkInfo(appName) {
  return APP_ICONS[appName] || FALLBACK_APP_MARK;
}

// W4 - every icon rendered from JS goes through this helper so the markup is
// identical to the static <svg class="icon"><use href="#i-..."/></svg> tags in
// index.html and the sprite stays the single source of glyphs.
function iconHTML(id, cls) {
  return `<svg class="icon${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#${id}"/></svg>`;
}

function appMarkInnerHTML(appName) {
  const info = appMarkInfo(appName);
  return info.letter
    ? `<span class="mark-letter">${info.letter}</span>`
    : iconHTML(info.glyph, 'mark-glyph');
}

// Paints one .app-mark element: glyph or letter, brand background, glyph color.
function setAppMark(id, appName, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const info = appMarkInfo(appName);
  el.innerHTML = appMarkInnerHTML(appName);
  if (!opts.keepBackground) el.style.background = info.bg;
  el.style.color = info.textColor || '#fff';
}

// W4 / WF-22 - one glyph per workout type, shared by the quick-log grid, the
// Other library, the earned list and the Live Activity mock, so the same
// workout always shows the same figure. Anything unknown falls back to the
// generic "move" figure (DESIGN 2: figure.mixed.cardio).
const WORKOUT_GLYPHS = {
  Walk: 'i-walk', Run: 'i-run', Lift: 'i-lift', Strength: 'i-lift', Workout: 'i-lift',
  Yoga: 'i-yoga', Stretch: 'i-yoga', Cycle: 'i-cycle', Swim: 'i-swim', Hike: 'i-hike',
  Row: 'i-row', Dance: 'i-dance', Sports: 'i-ball', Climb: 'i-climb',
};
const WORKOUT_TINTS = { Lift: 'indigo', Strength: 'indigo', Workout: 'indigo', Yoga: 'indigo-light', Stretch: 'indigo-light' };
function workoutGlyphId(name) { return WORKOUT_GLYPHS[name] || 'i-move'; }
function workoutTint(name) { return WORKOUT_TINTS[name] || 'teal'; }

// Live Activity mock icon follows the workout type (WF-22).
function setLiveActivityIcon(workoutName) {
  const el = document.getElementById('la-icon');
  if (!el) return;
  el.className = `la-icon symbol-tile symbol-tile-sm tint-${workoutTint(workoutName)}`;
  el.innerHTML = iconHTML(workoutGlyphId(workoutName), 'icon-20');
}

const EXERCISE_LABELS = { walk: 'Walk', workout: 'Workout', stretch: 'Stretch' };
const ONE_HOUR_MS = 60 * 60 * 1000;

// XP-11 - one allowance range for onboarding and Settings, 5-minute steps,
// shared with the native app's BalanceDefaults.allowanceRange.
const ALLOWANCE_MIN = 15;
const ALLOWANCE_MAX = 240;
const ALLOWANCE_STEP = 5;

function clampAllowance(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 45;
  const stepped = Math.round(n / ALLOWANCE_STEP) * ALLOWANCE_STEP;
  return Math.min(ALLOWANCE_MAX, Math.max(ALLOWANCE_MIN, stepped));
}

// WONB - daily movement goal, same range and step as the native app's
// BalanceDefaults.workoutGoalRange / workoutGoalStep / workoutGoalDefault.
const WORKOUT_GOAL_MIN = 10;
const WORKOUT_GOAL_MAX = 120;
const WORKOUT_GOAL_STEP = 5;
const WORKOUT_GOAL_DEFAULT = 30;

function clampWorkoutGoal(value) {
  if (value == null || value === '') return WORKOUT_GOAL_DEFAULT;
  const n = Number(value);
  if (!Number.isFinite(n)) return WORKOUT_GOAL_DEFAULT;
  const stepped = Math.round(n / WORKOUT_GOAL_STEP) * WORKOUT_GOAL_STEP;
  return Math.min(WORKOUT_GOAL_MAX, Math.max(WORKOUT_GOAL_MIN, stepped));
}

// WF-02 - "signed out" is separate from "onboarded": the plan and history stay
// in balance_state while this flag is set, and signing back in clears it.
const SIGNED_OUT_KEY = 'balance_signed_out';

// WF-07 - intercept generation token. Every open and close bumps it; any
// timer the intercept started checks it before touching state, so closing
// the screen can never grant time later.
let interceptGen = 0;

// WF-28 / WONB - ordered setup steps, the same order as the iPhone app:
// sign in, nickname, pick apps, (Screen Time prompt), hours guess, your
// numbers, plan, movement goal, (Health prompt), then the paywall. The two
// prompts are look-alike popups, not steps. Sign in is never a back target
// once the user has signed in.
const OB_STEP_ORDER = ['ob-step-account', 'ob-step-nickname', 'ob-step-a', 'ob-step-b', 'ob-step-c', 'ob-step-d', 'ob-step-e'];

// Screen Time was already answered: going back to the app picker and forward
// again, or a reload, must not pop the permission a second time. Saved with
// the setup checkpoint.
let screenTimeAnswered = false;

// Toasts queued from a daily-reset (streak-shield save), shown once the app
// shell is ready.
let pendingToastMessages = [];

// Lock-screen widget and Live Activity ticks. The free timer itself runs on
// the Coach tab (coach.js); the source of truth is always state.activeWorkout's
// real timestamps (see computeActiveWorkoutElapsedMs).
let widgetInterval = null;
let laElapsedInterval = null;

// ===== RING DEPLETION COLOR (item 2d) =====
// One shared gradient (defined once in a zero-size <svg> at the top of the
// page, referenced by the Lock Screen ring that shows remaining time) whose
// two stop-color values get updated here on every repaint. Funneled through
// this single function so the ring's band always follows the same rule.
function applyRingDepletionColor(pct) {
  const stop1 = document.getElementById('ring-depletion-stop-1');
  const stop2 = document.getElementById('ring-depletion-stop-2');
  if (!stop1 || !stop2) return;
  let c1, c2;
  if (pct > 0.5) {
    c1 = '#34D399'; c2 = '#2DD4BF'; // mint/teal - unchanged from before
  } else if (pct > 0.25) {
    c1 = '#F59E0B'; c2 = '#FBBF24'; // amber - threshold moved from 0.2 to 0.25
  } else {
    c1 = '#FCA5A5'; c2 = '#F87171'; // coral family (matches .acc-trend.coral), not harsh red
  }
  stop1.setAttribute('stop-color', c1);
  stop2.setAttribute('stop-color', c2);
}

// ===== TODAY HERO AND LOCK SCREEN RING =====
// No more real-time countdown interval - the Today hero and the Lock Screen
// ring simply repaint from current state whenever something changes them or
// the app regains focus.
function updateRingDisplay() {
  const remaining = state.remainingSeconds;
  const total = state.totalSeconds;
  const pct = total > 0 ? remaining / total : 0;

  // WHERO - the Today hero is the balance scale; its big number is minutes
  // left rounded UP (WF-19), the same way the Lock Screen widget rounds:
  // "0 min left" must never show while apps are still unlocked.
  updateHeroScale();

  applyRingDepletionColor(pct);

  // Lock screen ring
  updateLockScreenWidgets();
}

// ===== TODAY HERO (WHERO) =====
// The balance scale (balance-hero.js 1.2.1, HERO_SPEC "For hosts"). One
// mapping turns the app's own numbers into the hero's inputs, so the hero
// never disagrees with the tiles, the caption or the Lock Screen widget:
//   tracking  - at least one app is picked (isTrackingApps)
//   screenMin - the last 5-min Screen Time checkpoint, the "Used today" number
//   moveMin   - the real minutes of today's logged workouts, summed
//   rate      - the earn rate; goalMin - the daily movement goal
//   earnedMin - state.earnedMinutes as credited, so a day on which the rate
//               changed still shows what was earned; made whole with
//               Math.round and never below 0
//   leftMin   - minutes left, rounded UP like the Lock Screen widget (WF-19)
//   allowance - the day's total less earned time (the base plus any minutes
//               a partner approved), never below 0
// It mounts once, the first time Today is on screen, with these numbers
// (never empty and pushed later), and stays transparent until its first
// frame is drawn. After that a change goes through setState only when an
// input really changed: a patch during the opening pour, even an unchanged
// one, would end its quiet start and make a balanced day celebrate.
const HERO_SCALE_KEYS = ['tracking', 'screenMin', 'moveMin', 'rate', 'goalMin', 'earnedMin', 'leftMin', 'allowance'];
const HERO_SCALE_POPUPS = ['confirm-popup', 'sso-mock-popup', 'screen-time-popup', 'health-popup'];
let heroScale = null;          // the one instance, for the life of the page
let heroScaleInputs = null;    // the inputs it was last given
let heroScaleLive = false;     // its canvas is in the layout (frame loop allowed)
let heroScaleMountQueued = false;

function heroScaleNumbers() {
  const moved = (state.worktimeLoggedToday || []).reduce((sum, w) => sum + (Number(w && w.mins) || 0), 0);
  return {
    tracking: isTrackingApps(),
    screenMin: getCheckpointMinutesToday(),
    moveMin: Math.max(0, Math.round(moved)),
    rate: state.earnRateMultiplier,
    goalMin: state.workoutGoalMin,
    earnedMin: Math.max(0, Math.round(Number(state.earnedMinutes) || 0)),
    leftMin: Math.ceil(state.remainingSeconds / 60),
    allowance: Math.max(0, dayTotalMinutes() - state.earnedMinutes),
  };
}

// Today is the screen in front, with no sheet, popup or Coach cover on top.
function heroScaleOnScreen() {
  const shell = document.getElementById('app-shell');
  const pane = document.getElementById('tab-today');
  if (!shell || !shell.classList.contains('active') || !pane || !pane.classList.contains('active')) return false;
  if (document.querySelector('.bottom-sheet.open')) return false;
  // Full-screen overlays (Lock Screen preview, share card, intercept) lay
  // over the shell without hiding it.
  if (document.querySelector('.overlay-screen.active')) return false;
  const body = document.body.classList;
  if (body.contains('cx-cover-open') || body.contains('cx-sheet-open')) return false;
  return !HERO_SCALE_POPUPS.some(id => {
    const el = document.getElementById(id);
    return !!(el && el.style.display && el.style.display !== 'none');
  });
}

function updateHeroScale() {
  if (!window.BalanceHero || !document.getElementById('hero-scale')) return;
  if (!heroScale) {
    // The mount waits for the end of the current task, so a repaint that
    // is still settling the day's numbers (paintAppShell) lands first.
    if (!heroScaleMountQueued && heroScaleOnScreen()) {
      heroScaleMountQueued = true;
      queueMicrotask(mountHeroScale);
    }
    return;
  }
  const next = heroScaleNumbers();
  if (heroScaleInputs && HERO_SCALE_KEYS.every(k => next[k] === heroScaleInputs[k])) return;
  heroScaleInputs = next;
  heroScale.setState(next);
}

function mountHeroScale() {
  heroScaleMountQueued = false;
  const canvas = document.getElementById('hero-scale');
  if (heroScale || !canvas || !heroScaleOnScreen()) return;
  const wrap = document.getElementById('hero-scale-wrap');
  heroScaleInputs = heroScaleNumbers();
  heroScaleLive = true;
  heroScale = BalanceHero.mount(canvas, Object.assign({}, heroScaleInputs, {
    onReady: () => { if (wrap) wrap.classList.add('is-ready'); },
  }));
}

// The hero stops its own frame loop when the page is hidden or its canvas is
// off screen. Tabs, screens and sheets here only fade (opacity and
// visibility), so the canvas would still count as on screen under them.
// While Today is covered or another tab shows, the frame on screen is copied
// to the still canvas and the live one leaves the layout, which stops its
// loop; it comes back when Today does, and a change made meanwhile animates
// then. Never destroyed: Today stays for the life of the page.
function syncHeroScale() {
  const canvas = document.getElementById('hero-scale');
  const still = document.getElementById('hero-scale-still');
  if (!canvas || !still) return;
  const live = heroScaleOnScreen();
  if (!heroScale) { if (live) updateHeroScale(); return; }
  if (live === heroScaleLive) return;
  heroScaleLive = live;
  if (live) {
    canvas.style.display = '';
    still.hidden = true;
    return;
  }
  if (canvas.width && canvas.height) {
    still.width = canvas.width;
    still.height = canvas.height;
    still.getContext('2d').drawImage(canvas, 0, 0);
  }
  still.hidden = false;
  canvas.style.display = 'none';
}

function watchHeroScale() {
  if (typeof MutationObserver !== 'function') return;
  const mo = new MutationObserver(syncHeroScale);
  const classTargets = [document.body, document.getElementById('tab-today')]
    .concat(Array.from(document.querySelectorAll('.screen, .bottom-sheet')));
  classTargets.forEach(el => { if (el) mo.observe(el, { attributes: true, attributeFilter: ['class'] }); });
  HERO_SCALE_POPUPS.forEach(id => {
    const el = document.getElementById(id);
    if (el) mo.observe(el, { attributes: true, attributeFilter: ['style'] });
  });
}

// ===== LOCK SCREEN WIDGETS =====
function updateLockScreenWidgets() {
  const mins = Math.ceil(state.remainingSeconds / 60);
  // item 2d - use the exact same pct as updateRingDisplay (raw seconds, not
  // ceil'd minutes) so the ring and its gradient never disagree on the band.
  const pct = state.totalSeconds > 0 ? state.remainingSeconds / state.totalSeconds : 0;

  // Label
  setTextContent('ls-ring-label', `${mins}m`);
  const wrMid = document.getElementById('ls-wr-mid');
  if (wrMid) wrMid.innerHTML = `${mins} min left · ${iconHTML('i-flame', 'icon-12')}${state.streakDays}`;

  // Bar
  const barFill = document.getElementById('ls-wr-bar-fill');
  if (barFill) barFill.style.width = `${(pct * 100).toFixed(1)}%`;

  // Ring arc
  const lsArc = document.getElementById('ls-ring-arc');
  if (lsArc) {
    const circumference = 150;
    const offset = circumference - (pct * circumference);
    lsArc.setAttribute('stroke-dashoffset', offset.toFixed(2));
  }
}

// ===== LIVE CLOCK (lock screen) =====
function startLiveClock() {
  updateClock();
  widgetInterval = setInterval(updateClock, 1000);
}

function stopLiveClock() {
  if (widgetInterval) { clearInterval(widgetInterval); widgetInterval = null; }
}

function updateClock() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const timeStr = `${h12}:${m.toString().padStart(2,'0')}`;
  setTextContent('ls-time', timeStr);

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  setTextContent('ls-date', dateStr);
}

// item 3b - shared timestamp math for the live workout timer. The source of
// truth is always real Date.now() timestamps (startedAt + accumulated pause
// time), never an interval's own counter, so a reload mid-workout recovers
// the correct elapsed time.
function computeActiveWorkoutElapsedMs(now) {
  const aw = state.activeWorkout;
  if (!aw) return 0;
  const referenceNow = aw.pausedAt || (now || Date.now());
  return Math.max(0, referenceNow - aw.startedAt - aw.pausedTotalMs);
}

function formatTimerMMSS(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Live Activity - honest version (B6, fix 10, item 3b). While a workout is
// actually running, this reflects the REAL elapsed time and the earn-rate
// framing. Once it's over, it falls back to the existing post-completion
// mock: only shows if a workout was logged < 60 min ago, and the progress
// denominator is the ACTUAL logged workout's duration (not a fixed 30-min
// guess), so it always hits 100% when the workout is really done.
function updateLiveActivityCard() {
  const card = document.getElementById('ls-live-activity');
  if (!card) return;
  const fill = document.getElementById('la-progress-fill');
  const badge = document.querySelector('.la-badge');

  if (state.activeWorkout) {
    card.style.display = 'block';
    const elapsedMs = computeActiveWorkoutElapsedMs();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const projected = Math.round(elapsedMinutes * state.earnRateMultiplier);
    const paused = !!state.activeWorkout.pausedAt;
    setTextContent('la-title', `${state.activeWorkout.name} ${paused ? 'paused' : 'in progress'}`);
    setLiveActivityIcon(state.activeWorkout.name);
    setTextContent('la-mins-earned', `+${projected} min earned`);
    setTextContent('la-elapsed', `${formatTimerMMSS(elapsedMs)} elapsed`);
    if (fill) {
      // No fixed target while it's still running - a gentle ramp against a
      // 30-min reference reads honestly without pretending to know when
      // the user will actually stop.
      const pct = Math.min((elapsedMinutes / 30) * 100, 100);
      fill.style.width = `${pct.toFixed(1)}%`;
    }
    if (badge) badge.classList.remove('la-badge-done');
    return;
  }

  // WC-18 - a logged workout is finished the moment it is logged (every
  // completion path stamps done: true), so it reads "done" right away with
  // the bar full, and stays visible for an hour.
  const last = state.lastWorkout;
  if (!last || (Date.now() - last.at) >= ONE_HOUR_MS) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  const agoSec = Math.max(0, Math.floor((Date.now() - last.at) / 1000));
  setTextContent('la-title', `${last.name} done`);
  const laTitle = document.getElementById('la-title');
  if (laTitle) laTitle.insertAdjacentHTML('beforeend', iconHTML('i-check', 'icon-14'));
  setLiveActivityIcon(last.name);
  setTextContent('la-mins-earned', `+${last.mins} min earned`);
  setTextContent('la-elapsed', agoSec < 60 ? 'just now' : `${Math.floor(agoSec / 60)} min ago`);
  if (fill) fill.style.width = '100%';
  if (badge) badge.classList.add('la-badge-done');
}

function startLaElapsed() {
  updateLiveActivityCard();
  laElapsedInterval = setInterval(updateLiveActivityCard, 1000);
}

function stopLaElapsed() {
  if (laElapsedInterval) { clearInterval(laElapsedInterval); laElapsedInterval = null; }
}

// ===== SCREEN NAVIGATION =====
let currentScreen = 'splash-screen';

// W6 (WV-11) - the incoming screen is stacked above the outgoing one
// (.screen-in, solid --bg) and fades in; the outgoing one stays fully opaque
// underneath until it is covered (.slide-out delays its opacity change by the
// fade length), so the old screen never ghosts through the new one.
const SCREEN_FADE_MS = 350;
function showScreen(id) {
  const prev = document.getElementById(currentScreen);
  const next = document.getElementById(id);
  if (!next) return;

  if (prev && prev !== next) {
    document.querySelectorAll('.screen.screen-in').forEach(el => { if (el !== next) el.classList.remove('screen-in'); });
    prev.classList.remove('active', 'screen-in');
    prev.classList.add('slide-out');
    next.classList.remove('slide-out');
    next.classList.add('screen-in');
    setTimeout(() => prev.classList.remove('slide-out'), SCREEN_FADE_MS + 50);
    setTimeout(() => { if (next.classList.contains('active')) next.classList.remove('screen-in'); }, SCREEN_FADE_MS + 50);
  }

  next.classList.add('active');
  currentScreen = id;
  syncToastPlacement();
}

// W6 (WV-25) - toasts sit at the top where there is no tab bar (splash,
// setup, paywall) and while any bottom sheet is open, so they
// never land on a CTA or a sheet row; at the bottom, above the tab bar, otherwise.
// A toast already on screen stays where it appeared (no jump when a sheet
// closes under it); the spot is re-read when the next toast shows or once
// the last one has gone. force = a new toast is about to show.
const TOAST_TOP_SCREENS = ['splash-screen', 'onboarding-screen', 'paywall-screen'];
function syncToastPlacement(force) {
  const container = document.getElementById('toast-container');
  if (!force && container && container.childElementCount > 0) return;
  const sheetOpen = !!document.querySelector('.bottom-sheet.open');
  document.body.classList.toggle('toast-top', sheetOpen || TOAST_TOP_SCREENS.includes(currentScreen) || earnMoreUnderToasts());
}

// WHERO - the hero made Today taller, so "+ Earn more" can be scrolled to
// where a bottom toast lands. While the button is there, toasts drop from
// the top instead, and toasts already showing move up if the button scrolls
// under them. The bottom toast column ends 22px above the tab bar (80px
// from the bottom, the bar is 58px), or 82px while the Coach resume bar
// shows (coach.css lifts it to 140px); each toast and its gap take about 56px.
function earnMoreUnderToasts() {
  if (currentScreen !== 'app-shell' || state.currentTab !== 'today') return false;
  const btn = document.getElementById('earn-more-btn');
  const bar = document.querySelector('#app-shell .tab-bar');
  const container = document.getElementById('toast-container');
  if (!btn || !bar || !container) return false;
  const b = btn.getBoundingClientRect();
  if (!b.height) return false;
  const zoneBottom = bar.getBoundingClientRect().top - (document.body.classList.contains('cx-has-mini') ? 82 : 22);
  const zoneTop = zoneBottom - 56 * (container.childElementCount + 1);
  return b.bottom > zoneTop && b.top < zoneBottom;
}
function liftToastsOffEarnMore() {
  const container = document.getElementById('toast-container');
  if (!container || !container.childElementCount || document.body.classList.contains('toast-top')) return;
  if (earnMoreUnderToasts()) document.body.classList.add('toast-top');
}

// W6 (WV-19) - one check for every motion effect JS drives itself (confetti,
// the Earn more pulse, count-ups). CSS handles the rest in its own
// prefers-reduced-motion block.
function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function syncEarnPulse() {
  const btn = document.getElementById('earn-more-btn');
  if (btn) btn.classList.toggle('btn-earn-pulse', !prefersReducedMotion());
}

function showOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function hideOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// ===== TABS =====
function switchTab(tabName) {
  if (tabName === 'earn') tabName = 'coach'; // the Earn tab became Coach; old links still land there
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const pane = document.getElementById(`tab-${tabName}`);
  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (pane) pane.classList.add('active');
  if (btn) btn.classList.add('active');

  state.currentTab = tabName;
  const shell = document.getElementById('app-shell');
  if (shell) shell.classList.toggle('on-coach', tabName === 'coach');
  if (typeof coachOnTab === 'function') coachOnTab(); // the Coach tab, its timer bar and pinned button

  if (tabName === 'today') {
    updateRingDisplay(); // item 2b - explicit repaint, not just tiles/chart
    refreshTodayNumbers();
  } else if (tabName === 'friends') {
    renderSarahStatus();
  }
}

// ===== ONBOARDING =====
// item 5 - account creation + nickname are now the first two steps.
let currentObStep = 'ob-step-account';

// dir = 1 moves forward (new step slides in from the right); dir = -1 is the
// back chevron (new step slides in from the left).
function showObStep(id, dir = 1) {
  const prev = document.getElementById(currentObStep);
  const next = document.getElementById(id);
  const outX = dir < 0 ? 30 : -30;
  const inX = dir < 0 ? -30 : 30;
  if (prev) {
    prev.classList.remove('active');
    prev.style.transform = `translateX(${outX}px)`;
    prev.style.opacity = '0';
    setTimeout(() => {
      prev.style.transform = '';
      prev.style.opacity = '';
    }, 350);
  }
  if (next) {
    next.style.transform = `translateX(${inX}px)`;
    next.style.opacity = '0';
    next.classList.add('active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        next.style.transform = '';
        next.style.opacity = '';
      });
    });
  }
  currentObStep = id;
  saveOnboardingProgress(); // fix 2 - every step transition checkpoints progress
}

// WF-28 / NO-28 - back chevron. Steps only, never a permission popup (those
// are answered once; see screenTimeAnswered), and never back to Sign in once
// signed in. Returning to the shock step shows the finished
// reveal instead of re-running the "crunching" beat.
function goBackObStep() {
  const idx = OB_STEP_ORDER.indexOf(currentObStep);
  if (idx <= 1) return;
  const target = OB_STEP_ORDER[idx - 1];
  showObStep(target, -1);
  if (target === 'ob-step-c') initOnboardingStepC({ instant: true });
}

// WC-28 - Continue on the app picker is live only once an app is picked.
function updateAppPickerNext() {
  const btn = document.getElementById('ob-a-next');
  if (btn) btn.disabled = state.selectedApps.length === 0;
}

// ===== ONBOARDING PROGRESS PERSISTENCE (fix 2) =====
// A reload mid-onboarding used to be binary on 'balance_onboarded' and wipe
// selectedApps, sending an in-progress user all the way back to Welcome.
// This checkpoints the current step + every choice made so far into its own
// key, separate from balance_state (which only exists post-onboarding).
const ONBOARDING_PROGRESS_KEY = 'balance_onboarding_progress';
// WONB - 2 = the iPhone-app order (Screen Time prompt right after the app
// picker, movement goal before the Health prompt). A checkpoint without it
// was saved in the old order and is moved onto the new one on load.
const ONBOARDING_FLOW_VERSION = 2;

function saveOnboardingProgress() {
  if (localStorage.getItem('balance_onboarded')) return; // done - nothing to checkpoint
  localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify({
    v: ONBOARDING_FLOW_VERSION,
    step: currentObStep,
    screenTimeAnswered, // WONB - a reload after the Screen Time prompt never shows it again
    workoutGoalMin: state.workoutGoalMin, // WONB
    selectedApps: state.selectedApps,
    dailyHours: state.dailyHours,
    dailyAllowanceMinutes: state.dailyAllowanceMinutes,
    earnRateMultiplier: state.earnRateMultiplier,
    expiresAtMidnight: state.expiresAtMidnight,
    userName: state.userName,
    paywallYears: state.paywallYears,
    account: state.account, // item 5
    healthConnected: state.healthConnected, // WF-12 - answered once, not re-asked after a reload on the paywall
  }));
}

function loadOnboardingProgress() {
  const raw = localStorage.getItem(ONBOARDING_PROGRESS_KEY);
  if (!raw) return null;
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  // The old "reveal" step and its made-up usage number are gone. Scrub both
  // from a saved checkpoint so a resumed session can never bring them back.
  let scrubbed = false;
  if ('actualDailyHours' in parsed) { delete parsed.actualDailyHours; scrubbed = true; }
  if (parsed.step === 'ob-step-b2') { parsed.step = 'ob-step-c'; scrubbed = true; }
  // WONB - a checkpoint from the old order. There the Screen Time prompt came
  // after the hours guess, so on the hours guess it had not been shown yet.
  // In the new order it comes right after the app picker, so that checkpoint
  // resumes on the app picker (apps and guess kept): the next Continue shows
  // the prompt once, then the hours guess. Later old steps (your numbers,
  // plan, paywall) had already answered it.
  if (parsed.v !== ONBOARDING_FLOW_VERSION) {
    if (parsed.step === 'ob-step-b') parsed.step = 'ob-step-a';
    else if (parsed.step === 'ob-step-c' || parsed.step === 'ob-step-d' || parsed.step === 'paywall') parsed.screenTimeAnswered = true;
    parsed.v = ONBOARDING_FLOW_VERSION;
    scrubbed = true;
  }
  // A step this build does not know (garbled or from a removed screen) would
  // leave the setup blank: drop it and start from the top instead.
  if (parsed.step && parsed.step !== 'paywall' && !OB_STEP_ORDER.includes(parsed.step)) {
    delete parsed.step;
    scrubbed = true;
  }
  const goal = clampWorkoutGoal(parsed.workoutGoalMin);
  if (parsed.workoutGoalMin !== goal) { parsed.workoutGoalMin = goal; scrubbed = true; }
  if (scrubbed) localStorage.setItem(ONBOARDING_PROGRESS_KEY, JSON.stringify(parsed));
  return parsed;
}

// Re-syncs every onboarding control from state after a mid-flow reload -
// normally these only get set by direct user interaction, never by state.
function resumeOnboardingUI(step) {
  document.querySelectorAll('.app-tile').forEach(tile => {
    tile.classList.toggle('selected', state.selectedApps.includes(tile.dataset.app));
  });

  const slider = document.getElementById('time-slider');
  if (slider) {
    const mins = Math.round(state.dailyHours * 60);
    slider.value = mins;
    const sliderVal = document.getElementById('slider-value');
    if (sliderVal) {
      const h = Math.floor(mins / 60), m = mins % 60;
      sliderVal.textContent = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
    }
  }

  if (step === 'ob-step-c') initOnboardingStepC();

  // item 5 - the nickname now lives on its own step, not the plan step.
  const nicknameInputResume = document.getElementById('nickname-input');
  if (nicknameInputResume) nicknameInputResume.value = state.userName || '';
  const planSlider = document.getElementById('plan-allowance-slider');
  if (planSlider) {
    planSlider.value = state.dailyAllowanceMinutes;
    setTextContent('plan-allowance-display', `${state.dailyAllowanceMinutes} min`);
  }
  document.querySelectorAll('#earn-rate-ctrl .earn-rate-btn').forEach(b => {
    b.classList.toggle('selected', parseFloat(b.dataset.rate) === state.earnRateMultiplier);
  });
  const expiresToggle = document.getElementById('expires-toggle');
  if (expiresToggle) expiresToggle.checked = state.expiresAtMidnight;
  updateAppPickerNext();
  renderWorkoutGoal(); // WONB
}

// WONB - every display of the daily movement goal: the setup step's number,
// its chips and earn line, and the Settings stepper. The earn line follows
// the plan's earn rate with the same rounding a logged workout uses.
function renderWorkoutGoal() {
  const goal = state.workoutGoalMin;
  setTextContent('goal-value-num', goal);
  const valueEl = document.getElementById('goal-value');
  if (valueEl) valueEl.setAttribute('aria-label', `${goal} minutes a day`);
  document.querySelectorAll('.goal-chip').forEach(chip => {
    const on = Number(chip.dataset.goal) === goal;
    chip.classList.toggle('selected', on);
    chip.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const earned = Math.round(goal * state.earnRateMultiplier);
  setTextContent('goal-earn-line', `${goal} min of movement earns ${earned} min of scroll time`);
  setTextContent('goal-set-val', `${goal} min`);
  updateHeroScale(); // WHERO - the goal mark, and the earn line after a rate change
}

// One write path for the goal, from the setup step and from Settings.
function setWorkoutGoal(value) {
  state.workoutGoalMin = clampWorkoutGoal(value);
  renderWorkoutGoal();
  if (localStorage.getItem('balance_onboarded')) saveState();
  else saveOnboardingProgress();
}

// The shock stat is built only from the user's own guess, rounded to the
// nearest 5 minutes, and says so. The paywall line reuses these exact helpers
// so the two screens can never show different numbers.
const SHOCK_YEARS_REMAINING = 50;
const SHOCK_WAKING_HOURS_PER_DAY = 16;

function roundedGuessMinutes() {
  return Math.round(state.dailyHours * 60 / 5) * 5;
}

function guessLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function guessYears() {
  const hours = roundedGuessMinutes() / 60;
  return (hours / SHOCK_WAKING_HOURS_PER_DAY) * SHOCK_YEARS_REMAINING;
}

let stepCGen = 0;

function initOnboardingStepC(opts = {}) {
  const gen = ++stepCGen; // a back-and-forth must not leave two reveal timers racing
  const computingState = document.getElementById('computing-state');
  const shockState = document.getElementById('shock-state');
  if (computingState) computingState.style.display = 'flex';
  if (shockState) shockState.style.display = 'none';

  const label = guessLabel(roundedGuessMinutes());
  const years = guessYears();
  const yearsStr = years.toFixed(1);
  state.paywallYears = years; // B4 - the paywall line recomputes from the same helpers

  const leadText = document.getElementById('shock-lead-text');
  const yearsEl = document.getElementById('shock-years');
  const mintEl = document.getElementById('shock-mint');

  if (leadText) leadText.textContent = `At ${label} a day, if that's about right, you'll spend`;
  if (yearsEl) yearsEl.textContent = `${yearsStr} years`;
  if (mintEl) mintEl.classList.remove('visible');

  if (opts.instant) {
    // Back from the plan step: the number was already revealed.
    if (computingState) computingState.style.display = 'none';
    if (shockState) shockState.style.display = 'flex';
    if (mintEl) mintEl.classList.add('visible');
    return;
  }

  // Show computing for 1.5s
  setTimeout(() => {
    if (gen !== stepCGen) return;
    if (computingState) computingState.style.display = 'none';
    if (shockState) shockState.style.display = 'flex';
    // After 1s, show mint line
    setTimeout(() => {
      if (gen !== stepCGen) return;
      if (mintEl) mintEl.classList.add('visible');
    }, 1000);
  }, 1500);
}

// ===== PAYWALL =====
const PROMO_CODES = ['FRIENDS', 'BETA', 'BLAKE'];

// WF-18 - the red border and the error line clear as soon as the user types
// again, on a valid code, and on sign out (so the next paywall visit is clean).
function clearPromoError() {
  const input = document.getElementById('promo-input');
  const errorEl = document.getElementById('promo-error');
  if (input) {
    input.style.borderColor = '';
    input.classList.remove('error');
  }
  if (errorEl) errorEl.style.display = 'none';
}

function handlePromoCode() {
  const input = document.getElementById('promo-input');
  const errorEl = document.getElementById('promo-error');
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  if (PROMO_CODES.includes(code)) {
    // Valid code
    clearPromoError();
    launchConfetti();
    showToast('Beta access unlocked');
    setTimeout(() => proceedToApp(), 1500);
  } else {
    // Invalid
    input.classList.remove('error');
    void input.offsetWidth; // reflow
    input.classList.add('error');
    input.style.borderColor = '#F87171';
    if (errorEl) errorEl.style.display = 'block';
    setTimeout(() => { input.classList.remove('error'); }, 500);
  }
}

function proceedToApp() {
  // Honest numbers for new users (A9, A13): a freshly onboarded user starts
  // at Day 1 with 0 minutes earned - the seed demo values are for the
  // pre-onboarding splash/demo state only.
  state.streakDays = 1;
  state.streakShields = 0;
  state.earnedMinutes = 0;
  state.unlockMinutesToday = 0;
  state.worktimeLoggedToday = [];
  state.pendingSession = null;
  state.activeWorkout = null;
  state.lastWorkout = null;
  state.currentDay = todayStr();
  // WFIX item 1 - monitoring begins now, or at the first app pick if none is picked yet.
  state.monitoringStartedAt = isTrackingApps() ? Date.now() : null;
  localStorage.setItem('balance_onboarded', '1');
  localStorage.removeItem(ONBOARDING_PROGRESS_KEY); // fix 2 - no lingering partial-onboarding state
  localStorage.removeItem(SIGNED_OUT_KEY);
  currentObStep = 'ob-step-account';
  showScreen('app-shell');
  state.remainingSeconds = state.dailyAllowanceMinutes * 60;
  state.totalSeconds = dayTotalMinutes() * 60;
  paintAppShell(); // WF-01 - the Coach UI always mirrors state (no timer left running)
  saveState();
}

// Everything the app shell paints from state, shared by the three ways in
// (splash when already onboarded, the end of onboarding, signing back in) and
// by the live day rollover (WF-03), so no entry point can leave a stale timer
// card, a dimmed tile or an unflushed toast behind.
function paintAppShell() {
  renderAppTiles();
  buildWeekChart();
  updateRingDisplay();
  updateDateLabel();
  updateGreeting();
  updateAllStreakDisplays();
  renderSarahStatus();
  updateShieldChip();
  renderStatusLayer(); // W5 - shield pill, streak dots, stat strip, hourly chart, baseline card
  updateRingCaption();
  updateEarnRateNote();
  setTextContent('earned-display', state.earnedMinutes);
  if (typeof coachRestore === 'function') coachRestore(); // item 3b - a running timer or workout stays evident across a reload
  resolvePendingSession();     // WF-09 - a session left mid-transition is charged now, not out of the blue later
  flushPendingToasts();
}

function flushPendingToasts() {
  if (!pendingToastMessages.length) return;
  const msgs = pendingToastMessages;
  pendingToastMessages = [];
  msgs.forEach((msg, i) => setTimeout(() => showToast(msg), i * 500));
}

// ===== NUMBERS ENGINE (A8) =====
// Single source of truth: minutes used today derives from the day's own numbers (total and remaining seconds).
function getUsedMinutesToday() {
  return Math.max(0, Math.round((state.totalSeconds - state.remainingSeconds) / 60));
}

// W5 - Screen Time reports usage at 5-min checkpoints, so every "used" figure
// on Today shows the last checkpoint reached, never a 1-min count.
function getCheckpointMinutesToday() {
  return Math.floor(getUsedMinutesToday() / 5) * 5;
}

// W5 - nothing is measured until at least one app is picked (honesty rule 1).
function isTrackingApps() {
  return state.selectedApps.length > 0;
}

// W3 - today's full budget: base allowance + workout minutes + minutes a
// partner approved. Every place that derives totalSeconds or prints the
// day's total goes through this, so a partner unlock survives a reload.
function dayTotalMinutes() {
  return state.dailyAllowanceMinutes + state.earnedMinutes + state.unlockMinutesToday;
}

// ===== APP TILES =====
// W5 (ND-16 parity, XP-23, WF-10) - Screen Time hands the real app ONE shared
// total at 5-min checkpoints, never per-app minutes, so the demo no longer
// invents a per-app split. The row shows the picked apps as marks, one
// "Used today" total and an "Add apps" tile. Apps the user never picked are
// never substituted in.
function renderAppTiles() {
  const container = document.getElementById('app-tiles-row');
  if (!container) return;
  container.innerHTML = '';

  const apps = state.selectedApps.slice();
  const isLocked = state.remainingSeconds <= 0; // truthful: only when time is actually up

  const marksRow = document.createElement('div');
  marksRow.className = 'app-marks-row';

  apps.forEach(appName => {
    const info = appMarkInfo(appName);
    const tile = document.createElement('button');
    tile.className = 'app-used-tile';
    tile.setAttribute('data-app', appName);
    tile.setAttribute('aria-label', isLocked ? `${appName}, locked` : appName);
    tile.innerHTML = `
      <div class="app-used-icon app-mark" style="background:${info.bg};color:${info.textColor||'#fff'}">${appMarkInnerHTML(appName)}</div>
      <span class="app-used-name">${appName}</span>
      ${isLocked ? `<span class="lock-badge" aria-hidden="true">${iconHTML('i-lock', 'icon-12')}</span>` : ''}
    `;
    // B1 - breathing pause before opening an app with time remaining; straight
    // to the intercept only once time is actually gone.
    tile.addEventListener('click', () => {
      if (state.remainingSeconds <= 0) {
        showIntercept(appName);
      } else {
        showBreathingPause(appName);
      }
    });
    marksRow.appendChild(tile);
  });

  const addTile = document.createElement('button');
  addTile.className = 'add-apps-tile';
  addTile.id = 'add-apps-tile';
  addTile.innerHTML = `
    <span class="add-apps-icon" aria-hidden="true">${iconHTML('i-plus', 'icon-16')}</span>
    <span class="app-used-name">Add apps</span>
  `;
  addTile.addEventListener('click', openAppsSheet);
  marksRow.appendChild(addTile);
  container.appendChild(marksRow);

  // One shared total in 5-min checkpoint steps. With no app picked nothing is
  // measured, so the tile says "Not tracking yet" instead of a number.
  const tracking = apps.length > 0;
  const used = getCheckpointMinutesToday();
  const total = document.createElement('div');
  total.className = 'used-total-tile' + (tracking ? '' : ' not-tracking');
  total.id = 'used-total-tile';
  total.setAttribute('aria-label', tracking
    ? `Used today, about ${used} minutes, one total shared across your apps`
    : 'Used today, not tracking yet. Add an app to start.');
  total.innerHTML = `
    <span class="used-total-glyph" aria-hidden="true">${iconHTML('i-hourglass', 'icon-16')}</span>
    <div class="used-total-text">
      <span class="used-total-label">Used today</span>
      <span class="used-total-sub">${tracking ? `${apps.length} ${apps.length === 1 ? 'app' : 'apps'} · one total, not per app` : 'Not tracking yet · add an app'}</span>
    </div>
    <span class="used-total-value">${tracking ? `<b>${used} min</b> <span class="used-total-est">est.</span>` : '<b>-</b>'}</span>
  `;
  container.appendChild(total);
}

// ===== APPS SHEET (W5, ND-16 parity) =====
// The "Add apps" tile opens this sheet so the picked apps can change after
// onboarding. Same overlay + sheet pattern as Settings. Toggling a tile saves
// at once and repaints every Today card that depends on the picked apps.
function renderAppsPickGrid() {
  const grid = document.getElementById('apps-pick-grid');
  if (!grid) return;
  grid.innerHTML = '';
  Object.keys(APP_ICONS).forEach(appName => {
    const info = appMarkInfo(appName);
    const on = state.selectedApps.includes(appName);
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'app-tile apps-pick-tile' + (on ? ' selected' : '');
    tile.setAttribute('data-app', appName);
    tile.setAttribute('aria-pressed', on ? 'true' : 'false');
    tile.innerHTML = `
      <div class="app-icon app-mark" style="background:${info.bg};color:${info.textColor||'#fff'}">${appMarkInnerHTML(appName)}</div>
      <span>${appName}</span>
    `;
    tile.addEventListener('click', () => {
      const nowOn = !tile.classList.contains('selected');
      tile.classList.toggle('selected', nowOn);
      tile.setAttribute('aria-pressed', nowOn ? 'true' : 'false');
      if (nowOn) {
        if (!state.selectedApps.includes(appName)) state.selectedApps.push(appName);
        // WFIX item 1 - setup finished with no app: monitoring begins at this first pick.
        if (state.monitoringStartedAt === null) state.monitoringStartedAt = Date.now();
      } else {
        state.selectedApps = state.selectedApps.filter(a => a !== appName);
      }
      saveState();
      // Repaint everything on Today that reads isTrackingApps(): the tiles
      // row, shield pill, streak dots, stat strip, hourly chart, baseline card
      // and the week chart's today bar, so no two cards disagree.
      refreshTodayNumbers();
    });
    grid.appendChild(tile);
  });
}

let appsSheetOpener = null;
function openAppsSheet() {
  appsSheetOpener = document.activeElement;
  renderAppsPickGrid();
  const overlay = document.getElementById('apps-overlay');
  const sheet = document.getElementById('apps-sheet');
  if (!overlay || !sheet) return;
  overlay.style.display = 'block';
  sheet.classList.add('open');
  sheet.style.transform = 'translateY(0)';
  sheet.setAttribute('tabindex', '-1');
  sheet.focus({ preventScroll: true });
  syncToastPlacement(); // W6 (WV-25)
}

function closeAppsSheet() {
  const overlay = document.getElementById('apps-overlay');
  const sheet = document.getElementById('apps-sheet');
  if (!overlay || !sheet) return;
  overlay.style.display = 'none';
  sheet.classList.remove('dragging');
  sheet.style.transform = 'translateY(100%)';
  sheet.classList.remove('open');
  syncToastPlacement(); // W6 (WV-25)
  // Focus goes back to the opener when it is still on screen and focusable
  // (the off-state shield pill stops being a button once an app is picked);
  // otherwise to the freshly rendered Add apps tile.
  const opener = appsSheetOpener;
  appsSheetOpener = null;
  const openerOk = opener && opener.isConnected &&
    (opener.tagName === 'BUTTON' || opener.getAttribute('tabindex') === '0');
  const back = openerOk ? opener : document.getElementById('add-apps-tile');
  if (back) back.focus({ preventScroll: true });
}

// ===== STATUS LAYER (W5, XP-24) =====
// Mirrors the native Today order: shield pill, streak dots, stat strip,
// hourly chart, baseline card. Every number is either live demo state or
// sits under a SAMPLE / DEMO caption in the markup.
function renderStatusLayer() {
  renderShieldStatusPill();
  renderStreakDots();
  renderStatStrip();
  buildHourChart();
  renderBaselineCard();
}

// Demo wording only. The web demo never blocks an app, so the pill says what
// WOULD be on for the picked apps and never reads as a real-blocking claim.
// Off state (no app picked): amber dot, and the pill becomes a button that
// opens the app picker (DESIGN 3, shield status pill).
function renderShieldStatusPill() {
  const text = document.getElementById('shield-status-text');
  if (!text) return;
  const n = state.selectedApps.length;
  const off = n === 0;
  text.textContent = off
    ? 'Demo - pick apps to see blocking'
    : `Demo - blocking would be on for ${n} ${n === 1 ? 'app' : 'apps'}`;
  const pill = document.getElementById('shield-status-pill');
  if (!pill) return;
  pill.classList.toggle('is-off', off);
  if (off) {
    pill.setAttribute('role', 'button');
    pill.setAttribute('tabindex', '0');
    pill.setAttribute('aria-label', 'Demo - pick apps to see blocking. Opens the app picker.');
  } else {
    pill.removeAttribute('role');
    pill.removeAttribute('tabindex');
    pill.removeAttribute('aria-label');
  }
}

// Streak dots: built from the real streak, never from the sample week. The
// streak starts at 1 on the first day and grows by one for each finished day
// kept within the allowance, so the last (streak - 1) days are under budget.
// A streak of 0 means yesterday went over with no Streak Shield left. Any
// older day is "no data" (hollow), so a brand-new user never sees checks for
// days before they joined. Today is "in progress" while apps are tracked.
// Shape plus color, so no state relies on color alone.
// WFIX item 3 - one list of day results for the last 7 days (index 0 = six
// days ago, index 6 = today): 'under', 'over', 'none' (no data) or 'today'.
// The streak dots and the week chart's check marks both read it, so the two
// can never disagree.
function streakDayResults() {
  const streak = Math.max(0, Math.floor(state.streakDays || 0));
  const keptDays = Math.min(6, Math.max(0, streak - 1));
  const tracking = isTrackingApps();
  const out = [];
  for (let i = 0; i < 7; i++) {
    const daysBack = 6 - i;
    if (daysBack === 0) out.push(tracking ? 'today' : 'none');
    else if (daysBack <= keptDays) out.push('under');
    else if (streak === 0 && daysBack === 1) out.push('over');
    else out.push('none');
  }
  return out;
}

function renderStreakDots() {
  const row = document.getElementById('streak-dots');
  if (!row) return;
  const DAY_LETTERS = ['S','M','T','W','T','F','S'];
  const todayDow = new Date().getDay();
  const tracking = isTrackingApps();
  const results = streakDayResults();
  let under = 0;
  let known = 0;
  const cols = [];
  for (let i = 0; i < 7; i++) {
    const daysBack = 6 - i;
    const letter = DAY_LETTERS[(todayDow - daysBack + 7) % 7];
    const isToday = daysBack === 0;
    const result = results[i];
    let cls = 'dot-none';
    let glyph = '';
    if (result === 'today') {
      cls = 'dot-today';
    } else if (result === 'under') {
      cls = 'dot-under';
      glyph = iconHTML('i-check', 'icon-12');
      under++; known++;
    } else if (result === 'over') {
      cls = 'dot-over';
      glyph = iconHTML('i-close', 'icon-12');
      known++;
    }
    cols.push(`<div class="streak-dot-col${isToday ? ' is-today' : ''}"><span class="streak-dot ${cls}">${glyph}</span><span class="streak-dot-day">${letter}</span></div>`);
  }
  row.innerHTML = cols.join('');
  const todayPart = tracking ? 'today in progress' : 'not tracking yet';
  row.setAttribute('aria-label', known
    ? `This week: ${under} of ${known} finished days under budget, ${todayPart}`
    : `This week: no finished days yet, ${todayPart}`);
}

// Stat strip: Earned today (bolt, indigo), Shields (shield, teal, "1 of 2"),
// Allowance (hourglass, amber). One combined label per tile; glyph hidden.
const MAX_STREAK_SHIELDS = 2;
function renderStatStrip() {
  const strip = document.getElementById('stat-strip');
  if (!strip) return;
  const tiles = [
    { glyph: 'i-earn', tint: 'indigo', value: `${state.earnedMinutes} min`, label: 'Earned today',
      a11y: `Earned today, ${state.earnedMinutes} minutes` },
    { glyph: 'i-shield', tint: 'teal', value: `${state.streakShields} of ${MAX_STREAK_SHIELDS}`, label: 'Shields',
      a11y: `Shields, ${state.streakShields} of ${MAX_STREAK_SHIELDS}` },
    { glyph: 'i-hourglass', tint: 'amber', value: `${state.dailyAllowanceMinutes} min`, label: 'Allowance',
      a11y: `Allowance, ${state.dailyAllowanceMinutes} minutes a day` },
  ];
  strip.innerHTML = tiles.map(t => `
    <div class="stat-tile" role="group" aria-label="${t.a11y}">
      <span class="stat-glyph stat-glyph-${t.tint}" aria-hidden="true">${iconHTML(t.glyph, 'icon-16')}</span>
      <span class="stat-value">${t.value}</span>
      <span class="stat-label">${t.label}</span>
    </div>`).join('');
}

// Hourly chart, labeled "Sample data" in the card title. The demo has no
// per-hour record, so it spreads today's "Used today" checkpoint total over
// the hours already past using a fixed sample shape, in 5-min steps. The bars
// therefore always add up to the total on the same screen and never invent
// extra minutes. Past hours draw teal; the current hour and the hours still to
// come draw as empty tracks, with a 1px "now" line. Between midnight and 1 am
// no hour has passed yet, so hour 0 holds the total and draws as measured;
// otherwise the bars would add up to 0 while Used today shows minutes.
// WFIX - on the day monitoring began, the hours before that moment were never
// measured: they draw as unmeasured tracks and hold no minutes. The hour it
// began in is the first measured hour (it holds the total while it is still
// the current hour, the same rule as midnight to 1 am). From the next day on,
// and for a save that has no start time, every past hour is measured.
const HOURLY_SAMPLE_SHAPE = [5, 0, 0, 0, 0, 0, 5, 10, 10, 5, 5, 5, 15, 10, 5, 5, 5, 10, 10, 15, 20, 15, 10, 5];
function monitoringStartHourToday(now) {
  const t = state.monitoringStartedAt;
  if (typeof t !== 'number' || !Number.isFinite(t)) return 0;
  const start = new Date(t);
  const sameDay = start.getFullYear() === now.getFullYear()
    && start.getMonth() === now.getMonth()
    && start.getDate() === now.getDate();
  return sameDay ? start.getHours() : 0;
}
// First and last measured hour (inclusive). startHour 0 gives the old rule:
// hours 0 to nowHour - 1, or hour 0 alone before 1 am.
function measuredHourRange(nowHour, startHour = 0) {
  const first = Math.min(Math.max(0, startHour), nowHour);
  const last = Math.max(first, nowHour - 1);
  return { first, last };
}
function hourlySampleMinutes(nowHour, totalMinutes, startHour = 0) {
  const out = new Array(24).fill(0);
  const steps = Math.floor(totalMinutes / 5);
  if (steps <= 0) return out;
  const { first, last } = measuredHourRange(nowHour, startHour);
  let weights = HOURLY_SAMPLE_SHAPE.slice(first, last + 1);
  let weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) { weights = weights.map(() => 1); weightSum = weights.length; }
  // Largest-remainder split so the 5-min steps add up exactly.
  const raw = weights.map(w => (w / weightSum) * steps);
  const base = raw.map(Math.floor);
  let left = steps - base.reduce((a, b) => a + b, 0);
  raw.map((r, h) => ({ h, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || b.h - a.h)
    .forEach(({ h }) => { if (left > 0) { base[h] += 1; left--; } });
  base.forEach((n, i) => { out[first + i] = n * 5; });
  return out;
}
function buildHourChart() {
  const chart = document.getElementById('hour-chart');
  if (!chart) return;
  const now = new Date();
  const nowHour = now.getHours();
  const tracking = isTrackingApps();
  const startHour = monitoringStartHourToday(now); // WFIX item 1
  const { first, last } = measuredHourRange(nowHour, startHour);
  const minutes = hourlySampleMinutes(nowHour, tracking ? getCheckpointMinutesToday() : 0, startHour);
  const max = Math.max(...minutes, 15);
  chart.innerHTML = minutes.map((mins, h) => {
    const measured = tracking && h >= first && h <= last;
    const pct = measured ? Math.round((mins / max) * 100) : 0;
    return `<div class="hour-col ${measured ? 'measured' : 'unmeasured'}"><div class="hour-fill" style="height:${pct}%"></div></div>`;
  }).join('');
  const nowLine = document.createElement('div');
  nowLine.className = 'hour-now-line';
  nowLine.style.left = `${(((nowHour + now.getMinutes() / 60) / 24) * 100).toFixed(2)}%`;
  chart.appendChild(nowLine);
}

// Baseline card: the user's own guess (rounded to 5 min by the same helper
// the shock stat uses) against what the demo has counted so far today.
// No invented "actual" figure anywhere in this card.
function renderBaselineCard() {
  const rows = document.getElementById('baseline-rows');
  if (!rows) return;
  const guessMin = roundedGuessMinutes();
  const tracking = isTrackingApps();
  const todayMin = tracking ? getCheckpointMinutesToday() : 0;
  const scale = Math.max(guessMin, todayMin, 5);
  const pct = m => (m > 0 ? Math.max(2, Math.round((m / scale) * 100)) : 0);
  rows.innerHTML = `
    <div class="baseline-row">
      <span class="baseline-label">Your guess</span>
      <div class="baseline-bar" aria-hidden="true"><div class="baseline-fill baseline-fill-guess" style="width:${pct(guessMin)}%"></div></div>
      <span class="baseline-value" id="baseline-guess-value">${guessLabel(guessMin)}</span>
    </div>
    <div class="baseline-row">
      <span class="baseline-label">So far today</span>
      <div class="baseline-bar" aria-hidden="true"><div class="baseline-fill baseline-fill-today" style="width:${pct(todayMin)}%"></div></div>
      <span class="baseline-value" id="baseline-today-value">${tracking ? `${guessLabel(todayMin)} <span class="baseline-est">est.</span>` : '<span class="baseline-est">Not tracking yet</span>'}</span>
    </div>`;
}

// ===== WEEKLY CHART =====
// The 6 historical days stay hardcoded for the demo; today's bar is always
// the real, live "used minutes" / earned minutes so it can never disagree
// with the Today hero (A8).
const WEEK_SOCIAL_HISTORICAL = [42, 38, 45, 29, 45, 22, 31];
const WEEK_EARNED_HISTORICAL = [8, 12, 0, 15, 5, 20, 12];
const WEEK_TODAY_IDX = 6;

function getWeekSeries() {
  const social = WEEK_SOCIAL_HISTORICAL.slice();
  const earned = WEEK_EARNED_HISTORICAL.slice();
  // W5 - same 5-min checkpoint as Used today, and nothing is measured while
  // no app is picked (the today bar then reads "-", see buildWeekChart).
  social[WEEK_TODAY_IDX] = isTrackingApps() ? getCheckpointMinutesToday() : 0;
  earned[WEEK_TODAY_IDX] = state.earnedMinutes;
  return { social, earned };
}

// fix 7 - two slim side-by-side bars per day (social=mint, earned=amber),
// a dashed reference line at the user's daily allowance, and a tiny mint
// check glyph on days that stayed under it. Today uses live numbers; the other 6 days
// are labeled sample history so the fake part is honest about being fake.
function buildWeekChart() {
  const chart = document.getElementById('week-chart');
  if (!chart) return;
  chart.innerHTML = '';

  // WF-21 - the chart is the last 7 days ending today, so the last column is
  // always today's real weekday and the six before it are the sample history.
  const DAY_LETTERS = ['S','M','T','W','T','F','S'];
  const todayDow = new Date().getDay();
  const days = [];
  for (let back = 6; back >= 0; back--) days.push(DAY_LETTERS[(todayDow - back + 7) % 7]);
  const { social, earned } = getWeekSeries();
  const todayIdx = WEEK_TODAY_IDX;
  const tracking = isTrackingApps();
  const allowance = state.dailyAllowanceMinutes;
  // WFIX item 3 - the earlier days' checks come from the same day results as
  // the streak dots; only the bar heights are sample history.
  const dayResults = streakDayResults();
  // WFIX repair - the drawn sample bar never contradicts that day result: a
  // kept day ('under') is drawn at or under the goal line and the day that
  // went over is drawn above it, keeping the sample's day-to-day shape. Today
  // keeps its own height. WHERO item 8e - a 'none' day (no data) keeps its
  // sample height unless that would rise above the goal line (low
  // allowances); then it is drawn under the line the same way a kept day is.
  const sampleMax = Math.max(...WEEK_SOCIAL_HISTORICAL);
  for (let i = 0; i < social.length; i++) {
    if (i === todayIdx) continue;
    const shape = social[i] / sampleMax;
    if (dayResults[i] === 'under' && social[i] > allowance) social[i] = Math.round(allowance * (0.6 + 0.3 * shape));
    else if (dayResults[i] === 'over' && social[i] <= allowance) social[i] = Math.round(allowance * (1.15 + 0.2 * shape));
    else if (dayResults[i] === 'none' && social[i] > allowance) social[i] = Math.round(allowance * (0.6 + 0.3 * shape));
  }
  // fix 7 - headroom is derived from the DATA, not from whichever value
  // (data or allowance) currently happens to be the max. The old formula
  // multiplied the max by 1.15, so whenever the allowance itself was the
  // max, scaleMax = allowance * 1.15 and the goal line landed at a fixed
  // 1/1.15 (86.9565%) no matter how high the allowance went - it only
  // ever moved when the DATA stayed the dominant term. Fixed additive
  // headroom based on the data means the line actually moves both ways.
  // WHERO item 8e - the earlier days' sample earned bars count as data too,
  // so lowering the no-data bars never pushes an earned bar past the top.
  const dataMax = Math.max(...social, ...earned.slice(0, todayIdx));
  const headroom = Math.max(dataMax, 1) * 0.15;
  const scaleMax = Math.max(dataMax, allowance) + headroom;
  const goalPct = Math.min(100, (allowance / scaleMax) * 100);

  const barsRow = document.createElement('div');
  barsRow.className = 'week-bars-row';
  const labelsRow = document.createElement('div');
  labelsRow.className = 'week-labels-row';

  days.forEach((day, i) => {
    const socialPct = Math.min(100, (social[i] / scaleMax) * 100);
    const earnedPct = Math.min(100, (earned[i] / scaleMax) * 100);
    const isToday = i === todayIdx;
    // Today: checked while tracked and within the allowance (no check while
    // nothing is tracked: there is no measured day to judge). Earlier days:
    // checked only where the streak dots show a kept day.
    const underAllowance = isToday
      ? (tracking && social[i] <= allowance)
      : dayResults[i] === 'under';

    const wrap = document.createElement('div');
    wrap.className = 'chart-bar-wrap';
    wrap.innerHTML = `
      <div class="chart-bar-bg">
        <div class="chart-bar-col">
          ${isToday ? `<span class="chart-bar-value" data-target="${socialPct}">${tracking ? social[i] : '-'}</span>` : ''}
          <div class="chart-bar-fill social${isToday ? ' today' : ''}" style="height:0%" data-target="${socialPct}"></div>
        </div>
        <div class="chart-bar-col">
          <div class="chart-bar-fill earned${isToday ? ' today' : ''}" style="height:0%" data-target="${earnedPct}"></div>
        </div>
      </div>
    `;
    barsRow.appendChild(wrap);

    const labelCol = document.createElement('div');
    labelCol.className = 'week-label-col';
    labelCol.innerHTML = `
      <span class="chart-day-label">${isToday ? '<b style="color:#fff">'+day+'</b>' : day}</span>
      <span class="chart-day-check"${underAllowance ? '' : ' style="visibility:hidden"'}>${iconHTML('i-check', 'icon-12')}</span>
    `;
    labelsRow.appendChild(labelCol);
  });

  const goalLine = document.createElement('div');
  goalLine.className = 'chart-goal-line';
  // W6 (WV-05) - the row reserves 20px on top for today's value, so the line
  // is placed inside the 80px bar area, not the full row height.
  goalLine.style.bottom = `calc((100% - 20px) * ${(goalPct / 100).toFixed(4)})`;
  barsRow.appendChild(goalLine);
  // WV-05 - the goal label is a pill in the title row, never on the line.
  setTextContent('chart-goal-pill', `Goal ${allowance} min`);

  chart.appendChild(barsRow);
  chart.appendChild(labelsRow);

  // Animate bars in after a frame
  requestAnimationFrame(() => {
    setTimeout(() => {
      chart.querySelectorAll('.chart-bar-fill').forEach((bar, i) => {
        setTimeout(() => {
          bar.style.height = bar.dataset.target + '%';
          bar.style.transition = 'height 0.6s cubic-bezier(0.4,0,0.2,1)';
        }, i * 40);
      });
      // WV-05 - today's value rides just above its own bar, on the same curve.
      const value = chart.querySelector('.chart-bar-value');
      if (value) setTimeout(() => { value.style.bottom = `calc(${value.dataset.target}% + 4px)`; }, todayIdx * 2 * 40);
    }, 100);
  });
}

// ===== EARNED TODAY LIST (fix 3) =====
// Single source of truth: state.worktimeLoggedToday. Rebuilt from state (not
// appended DOM-only) so a page reload always reflects reality, and an empty
// day shows an honest empty state instead of a phantom seeded entry.
function renderEarnedList() {
  if (typeof coachRefresh === 'function') coachRefresh(); // the list lives in Coach's Earned today sheet
}

// Cheap, event-driven refresh of everything derived from "used minutes today" (A8).
function refreshTodayNumbers() {
  updateHeroScale(); // WHERO - the hero reads the same numbers (an app picked or dropped, minutes earned)
  renderAppTiles();
  buildWeekChart();
  renderStatusLayer(); // W5 - the stat strip and baseline card derive from the same numbers
}

// ===== DATE LABEL =====
function updateDateLabel() {
  const el = document.getElementById('app-date-label');
  if (!el) return;
  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  el.textContent = `Today, ${months[now.getMonth()]} ${now.getDate()}`;
}

// ===== INTERCEPT SCREEN =====
function updateInterceptRewards() {
  document.querySelectorAll('.intercept-row').forEach(row => {
    const base = parseInt(row.dataset.baseMins, 10);
    const mins = Math.round(base * state.earnRateMultiplier);
    row.dataset.mins = mins;
    const rewardEl = row.querySelector('.ex-reward');
    if (rewardEl) rewardEl.textContent = `+${mins} min`;
  });
}

// W6 (WV-23) - the ask block and the partner reply share one fixed slot
// (index.html #intercept-slot). Both stay laid out so the slot height never
// changes; only the active one is visible. mode: 'ask' | 'response' | 'none'.
function setInterceptSlot(mode) {
  const slot = document.getElementById('intercept-slot');
  const bottom = document.getElementById('intercept-bottom');
  const resp = document.getElementById('partner-response');
  if (slot) slot.dataset.mode = mode;
  if (bottom) {
    bottom.classList.toggle('slot-hidden', mode !== 'ask');
    bottom.setAttribute('aria-hidden', mode === 'ask' ? 'false' : 'true');
  }
  if (resp) {
    resp.classList.toggle('slot-hidden', mode !== 'response');
    resp.setAttribute('aria-hidden', mode === 'response' ? 'false' : 'true');
  }
}

function showIntercept(appName) {
  interceptGen++;        // WF-07 - any timer from a previous open is now stale
  interceptAskCount = 0; // B3 - fresh ask count each time the intercept opens

  setAppMark('intercept-app-icon', appName);
  setTextContent('intercept-allowance', dayTotalMinutes());
  setTextContent('intercept-title', state.userName ? `Time's up, ${state.userName}.` : `Time's up.`);
  updateInterceptRewards(); // A6 - reward rows reflect the current earn-rate multiplier

  // Reset states
  const options = document.getElementById('intercept-options');
  const optionsLabel = document.querySelector('.intercept-options-label');
  const tracking = document.getElementById('tracking-state');
  const success = document.getElementById('intercept-success');
  const waiting = document.getElementById('pr-waiting');
  const declined = document.getElementById('pr-declined');
  const approved = document.getElementById('pr-approved');

  if (options) options.style.display = 'flex';
  if (optionsLabel) optionsLabel.style.display = 'block';
  if (tracking) tracking.style.display = 'none';
  if (success) success.style.display = 'none';
  setInterceptSlot('ask');
  if (waiting) waiting.style.display = 'block';
  if (declined) declined.style.display = 'none';
  if (approved) approved.style.display = 'none';

  showOverlay('intercept-screen');
}

function hideIntercept() {
  interceptGen++; // WF-07 - closing invalidates every pending intercept timer
  hideOverlay('intercept-screen');
}

// A2 - ✕ / "I'll wait until tomorrow" both close without earning, and reset
// the partner-response state so the next open starts clean.
function closeInterceptNoEarn() {
  hideIntercept();
  setInterceptSlot('ask');
  interceptAskCount = 0;
}

// B3 / XP-10 - scripted demo reply, labeled as a demo on screen: the first
// ask is declined with an "Ask again" option; the second is approved and
// grants a flat 30 partner minutes (never multiplied, never earned time).
// No code is ever shown here; the real app's partner texts it back.
let interceptAskCount = 0;

function askSarah() {
  const gen = interceptGen; // WF-07 - bail out below if the intercept closed or reopened
  interceptAskCount++;
  const waiting = document.getElementById('pr-waiting');
  const declined = document.getElementById('pr-declined');
  const approved = document.getElementById('pr-approved');

  setInterceptSlot('response');
  if (waiting) waiting.style.display = 'block';
  if (declined) declined.style.display = 'none';
  if (approved) approved.style.display = 'none';

  setTimeout(() => {
    if (gen !== interceptGen) return;
    if (waiting) waiting.style.display = 'none';
    if (interceptAskCount === 1) {
      if (declined) declined.style.display = 'block';
    } else {
      if (approved) approved.style.display = 'block';
      grantPartnerMinutes(30);
      renderSarahStatus(); // the Friends card reads the persisted counter
      launchConfetti();
      setTimeout(() => {
        if (gen !== interceptGen) return;
        hideIntercept();
        interceptAskCount = 0;
      }, 1500);
    }
  }, 3000);
}

// B1 - breathing pause overlay shown before opening an app with time left.
let breathingTimer = null;
let breathingAppName = null; // item 2c - which app "Open X" should start a session for

// W6 (WV-24) - the 4-second pause counts down on the button itself
// ("Open TikTok in 4s", 3s, 2s, 1s), then shows the normal label and unlocks.
// The countdown runs with reduced motion too; only the ring animation stops.
const BREATHING_PAUSE_S = 4;
function renderBreathingOpenLabel(btn, appName, secondsLeft) {
  if (!btn) return;
  btn.textContent = '';
  if (secondsLeft > 0) {
    btn.textContent = `Open ${appName} in ${secondsLeft}s`;
    return;
  }
  const name = document.createElement('span');
  name.id = 'breathing-open-appname';
  name.textContent = appName;
  btn.append('Open ', name, ' (uses your time)');
}

function showBreathingPause(appName) {
  breathingAppName = appName;
  setAppMark('breathing-app-icon', appName);
  setTextContent('breathing-app-name', appName);
  const openBtn = document.getElementById('breathing-open-btn');
  let secondsLeft = BREATHING_PAUSE_S;
  if (openBtn) openBtn.disabled = true;
  renderBreathingOpenLabel(openBtn, appName, secondsLeft);
  showOverlay('breathing-screen');
  if (breathingTimer) clearInterval(breathingTimer);
  breathingTimer = setInterval(() => {
    secondsLeft--;
    renderBreathingOpenLabel(openBtn, appName, secondsLeft);
    if (secondsLeft <= 0) {
      clearInterval(breathingTimer);
      breathingTimer = null;
      if (openBtn) openBtn.disabled = false;
    }
  }, 1000);
}

function hideBreathingPause() {
  hideOverlay('breathing-screen');
  if (breathingTimer) { clearInterval(breathingTimer); breathingTimer = null; }
}

// ===== APP SESSION (item 2c) =====
// Tapping "Open X" starts a simulated doom-scroll session: a plausible
// randomized length (8-15 min, tuned so a full ~45-57 min allowance runs out in
// roughly 3-5 taps - see final report), a short honest "leaving Balance"
// transition, then an automatic return that deducts only what was actually
// available (remaining can never go negative).
let pendingSessionTimer = null;

function startAppSession(appName) {
  hideBreathingPause();
  // WF-09 - a session left unresolved (reload inside the transition) is
  // charged first, never silently overwritten.
  if (state.pendingSession) {
    resolvePendingSession({ quiet: true });
    if (state.remainingSeconds <= 0) return; // that used the last of it; the intercept is up
  }
  const plannedMinutes = Math.floor(Math.random() * 8) + 8; // 8-15 min
  state.pendingSession = { appName, startedAt: Date.now(), plannedMinutes };
  saveState();
  showAppTransition(appName);
}

function showAppTransition(appName) {
  const info = appMarkInfo(appName);
  const screen = document.getElementById('app-transition-screen');
  if (screen) screen.style.background = info.bg;
  setAppMark('transition-app-icon', appName, { keepBackground: true });
  setTextContent('transition-app-name', appName);
  const nameEl = document.getElementById('transition-app-name');
  const capEl = document.querySelector('.app-transition-caption');
  const textColor = info.textColor || '#fff';
  if (nameEl) nameEl.style.color = textColor;
  if (capEl) capEl.style.color = textColor === '#000' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.75)';
  showOverlay('app-transition-screen');
  clearTimeout(pendingSessionTimer);
  pendingSessionTimer = setTimeout(() => {
    hideOverlay('app-transition-screen');
    resolvePendingSession();
  }, 1800);
}

// Idempotent - a no-op if there's no pending session (already resolved, or
// none started). Deducts min(plannedMinutes, remaining) so remaining can
// never go negative, then returns to Today - straight to the intercept if
// that used up the last of it, matching the old countdown's zero-path.
// opts.quiet skips the tab switch and the "Welcome back" toast (used when a
// stale session is charged right before a new one starts); the intercept still
// opens if that used the last of the time.
function resolvePendingSession(opts = {}) {
  const session = state.pendingSession;
  if (!session) return;
  state.pendingSession = null;

  const plannedSeconds = session.plannedMinutes * 60;
  const actualSeconds = Math.min(plannedSeconds, state.remainingSeconds);
  const actualMinutes = Math.round(actualSeconds / 60);
  state.remainingSeconds = Math.max(0, state.remainingSeconds - actualSeconds);

  updateRingDisplay();
  refreshTodayNumbers();
  saveState();
  if (!opts.quiet) switchTab('today');

  if (state.remainingSeconds <= 0) {
    renderAppTiles(); // fix 5 - lock badges appear the instant time actually hits 0
    showIntercept(session.appName);
  } else if (!opts.quiet) {
    const minsLeft = Math.ceil(state.remainingSeconds / 60);
    showToast(`Welcome back. ${actualMinutes} min on ${session.appName} this session - ${minsLeft} min left today.`);
  }
}

// item 2b/2c - eagerly resolve a pending session once its planned time has
// genuinely elapsed (a real background/foreground cycle or a page reload).
// Guarded on real elapsed time so a quick focus blip can't double-credit or
// resolve early.
function maybeAutoResolvePendingSession() {
  const session = state.pendingSession;
  if (!session) return;
  if (Date.now() - session.startedAt >= session.plannedMinutes * 60000) {
    resolvePendingSession();
  }
}

// ===== EARN MINUTES (shared logic) =====
function addEarnedMinutes(mins) {
  state.earnedMinutes += mins;
  state.remainingSeconds += mins * 60;
  state.totalSeconds += mins * 60;
  setTextContent('earned-display', state.earnedMinutes);
  updateRingDisplay();
  refreshTodayNumbers(); // A8 - chart/tiles stay consistent
  saveState(); // A7
}

// W3 / XP-10 - a partner approval adds minutes to today only. It is kept
// apart from earnedMinutes (nobody worked out), survives a reload through
// state.unlockMinutesToday, and applyDailyReset clears it at midnight.
// Used minutes (total minus remaining) do not move, so no tile or chart
// can mistake the grant for scrolling.
function grantPartnerMinutes(mins) {
  state.unlockMinutesToday += mins;
  state.remainingSeconds += mins * 60;
  state.totalSeconds += mins * 60;
  // The intercept's "used your N minutes" line is left alone here: it is set
  // on every open, and the new minutes are not used yet.
  updateRingDisplay();
  updateRingCaption();
  refreshTodayNumbers();
  saveState();
}

// ===== LIVE WORKOUT TIMER (item 3b) =====
// The free timer now lives on the Coach tab (coach.js): a full-screen cover
// and, minimized, a resume bar on every tab. It keeps using
// state.activeWorkout and computeActiveWorkoutElapsedMs, so a reload
// recovers the real elapsed time, and it credits through creditWorkout.

// ===== SHARED WORKOUT CREDIT (drives Earned Today, Streak Shield) =====
// Every workout-completion path (Quick log's live timer, the "Other"
// library) funnels through here so the downstream effects can never
// diverge. duration is always REAL minutes, never a picked/retroactive value.
// opts.quiet (WF-26, a workout credited during the day rollover) skips the
// confetti and the live toast; any toast goes through the pending queue.
// opts.silent skips both toasts because the caller (the Coach tab) shows its
// own; opts.kind ('timed' or 'coach') is kept on the earned row for its sub line.
// Returns what was credited, so that caller can word its toast.
function creditWorkout(workoutName, duration, opts = {}) {
  const quiet = !!opts.quiet;
  const silent = !!opts.silent;
  let shieldBanked = false;
  const earnedMins = Math.round(duration * state.earnRateMultiplier);
  addEarnedMinutes(earnedMins);
  state.lastWorkout = { name: workoutName, mins: earnedMins, at: Date.now(), done: true }; // B6, WC-18
  if (!quiet) launchConfetti();

  const entry = { label: workoutName, mins: duration, earned: earnedMins };
  if (opts.kind) { entry.kind = opts.kind; entry.at = Date.now(); }
  state.worktimeLoggedToday.push(entry);
  updateHeroScale(); // WHERO - the movement minutes changed after addEarnedMinutes repainted

  if (!quiet && !silent) showToast(`Logged! +${earnedMins} min earned 🎉`);

  // B2 - a 30-min-plus workout banks a Streak Shield (max 2).
  if (duration >= 30 && state.streakShields < 2) {
    state.streakShields++;
    shieldBanked = true;
    updateShieldChip();
    if (silent) { /* the caller words its own toast (see opts.silent above) */ }
    else if (quiet) pendingToastMessages.push('Streak Shield earned!'); // no emoji: a Coach timer that crosses midnight lands here
    else setTimeout(() => showToast('Streak Shield earned!'), 400);
  }

  saveState();
  renderEarnedList();
  return { earned: earnedMins, shieldBanked };
}

// ===== CONFETTI =====
function launchConfetti() {
  if (prefersReducedMotion()) return; // W6 (WV-19) - no confetti with Reduce Motion
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const parent = canvas.parentElement;
  canvas.width = parent.offsetWidth;
  canvas.height = parent.offsetHeight;

  const colors = ['#6366F1','#A855F7','#2DD4BF','#34D399','#F59E0B','#F87171','#fff'];
  const particles = [];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 2,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      opacity: 1,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    });
  }

  let frame = 0;
  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.rotation += p.rotSpeed;
      p.opacity -= 0.008;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    frame++;
    if (frame < 120) requestAnimationFrame(drawFrame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  drawFrame();
}

// ===== TOAST =====
function showToast(message, duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  syncToastPlacement(true); // W6 (WV-25)
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); syncToastPlacement(); }, duration);
}

// ===== UTIL =====
function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ===== DISPLAY HELPERS (A5, A9, A13, B2) =====

// A5 - the allowance caption under the Today hero honors the expires-at-midnight toggle.
function updateRingCaption() {
  const caption = document.querySelector('.ring-caption');
  if (!caption) return;
  const expiryText = state.expiresAtMidnight ? 'resets at midnight' : 'earned time carries over';
  const partnerPart = state.unlockMinutesToday > 0 ? ` + ${state.unlockMinutesToday} min from Sarah` : '';
  caption.innerHTML = `${state.dailyAllowanceMinutes} min allowance + <span id="earned-display">${state.earnedMinutes}</span> min earned${partnerPart} · ${expiryText}`;
}

// Earn-rate line (same strings as the real app), shared by every Coach screen
// that states the rate. Refreshed whenever the rate changes, in onboarding or
// in Settings.
function earnRateLine() {
  const rate = state.earnRateMultiplier;
  return rate === 1
    ? 'Every minute you move earns 1 minute of scroll time.'
    : `Every minute you move earns ${rate} min of scroll time - change it in Settings.`;
}
function updateEarnRateNote() {
  if (typeof coachRefresh === 'function') coachRefresh();
}

// item 5 - shared nickname validation: onboarding's nickname step and the
// Settings > Account nickname field both use this, so the rule can never
// drift between the two entry points.
function validateNickname(raw) {
  const trimmed = (raw || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 20) return null;
  return trimmed;
}

// A9 - time-aware greeting. The nickname is required now (item 5 - it
// identifies the account), so this always has a name to show once onboarded.
function getGreeting() {
  const h = new Date().getHours();
  const period = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return state.userName ? `${period}, ${state.userName}` : period;
}

function updateGreeting() {
  setTextContent('greeting-text', getGreeting());
}

// A13 - "Day 1" reads better than "1 days".
function formatStreakText(n) {
  if (!(n > 0)) return 'No streak'; // WHERO item 8h - words at 0, never "0 days" (fits the 375 greeting row)
  return n === 1 ? 'Day 1' : `${n} days`;
}

function updateAllStreakDisplays() {
  setTextContent('streak-display', formatStreakText(state.streakDays));
}

// B2 - streak-shield chip next to the streak pill.
function updateShieldChip() {
  const chip = document.getElementById('shield-chip');
  if (!chip) return;
  if (state.streakShields > 0) {
    chip.style.display = 'inline-flex';
    chip.innerHTML = `${iconHTML('i-shield', 'icon-14')}×${state.streakShields}`;
  } else {
    chip.style.display = 'none';
  }
  renderStatStrip(); // W5 - the Shields tile follows the chip
}

// ===== KEYBOARD-AWARE CTA (item 4) =====
// .btn-primary is normally bottom-pinned (margin-top:auto) so it reads well
// with no keyboard on screen. On a real iPhone, focusing a text input can
// bring up a keyboard tall enough that its accessory bar overlaps a
// bottom-pinned CTA. Scoped to exactly the input+CTA pair passed in - every
// other screen's CTA placement is untouched.
function setupKeyboardAwareCTA(inputEl, containerEl, ctaEl) {
  if (!inputEl || !containerEl || !ctaEl) return;

  // keyboard-fix - iOS's own "scroll the focused input into view" native
  // behavior ignores CSS scroll-margin and will happily scroll this input's
  // top edge to y=0 of the container, landing it under the status bar /
  // Dynamic Island since the container fills the full screen edge-to-edge.
  // Root-caused with the simulator's Web Inspector attached live: on the
  // name-entry screen there simply isn't enough vertical room, with the
  // keyboard open, to show BOTH the input clear of the status bar AND the
  // CTA clear of the keyboard at the same scroll position - the daily
  // allowance/earn-rate/expires rows between them are taller than what's
  // left of the screen. No amount of scroll-position math resolves that;
  // the two concerns need to be decoupled instead:
  //   1. Clamp scroll so the input never goes above its safe-area padding.
  //   2. Only if the CTA genuinely doesn't fit in what's left of the visible
  //      area at that scroll position, lift it out of normal flow into a
  //      fixed position just above the keyboard, so it no longer depends on
  //      scroll at all. (On the paywall the CTA sits ABOVE the promo input
  //      in the layout, so floating it there risks overlapping the content
  //      below it - this only engages where it's actually needed.)
  function clampInputSafe() {
    if (document.activeElement !== inputEl) return;
    const containerRect = containerEl.getBoundingClientRect();
    const inputRect = inputEl.getBoundingClientRect();
    const topPad = parseFloat(getComputedStyle(containerEl).paddingTop) || 54;
    const inputTopInContent = (inputRect.top - containerRect.top) + containerEl.scrollTop;
    const maxScrollTop = Math.max(0, inputTopInContent - topPad - 12);
    if (containerEl.scrollTop > maxScrollTop) {
      containerEl.scrollTop = maxScrollTop;
    }
  }

  let floated = false;
  function floatCTA() {
    if (floated || !window.visualViewport) return;
    const vv = window.visualViewport;
    const rect = ctaEl.getBoundingClientRect();
    ctaEl.style.position = 'fixed';
    ctaEl.style.left = `${rect.left}px`;
    ctaEl.style.width = `${rect.width}px`;
    ctaEl.style.bottom = `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop + 12)}px`;
    ctaEl.style.zIndex = '50';
    floated = true;
  }

  function unfloatCTA() {
    if (!floated) return;
    ctaEl.style.position = '';
    ctaEl.style.left = '';
    ctaEl.style.width = '';
    ctaEl.style.bottom = '';
    ctaEl.style.zIndex = '';
    floated = false;
  }

  // After the input-safe scroll clamp, check whether the CTA (still in
  // normal flow at this point) actually fits in what's left of the visible
  // (non-keyboard) area. Only float it if it doesn't.
  function reconcileCTA() {
    if (document.activeElement !== inputEl) return;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    if (floated) {
      // Re-check whether floating is still needed (e.g. keyboard height
      // changed) by measuring as if it were back in flow - simplest robust
      // signal is just to keep floating once engaged for this focus
      // session; unfloat() on blur resets it for next time.
      return;
    }
    const ctaRect = ctaEl.getBoundingClientRect();
    if (ctaRect.bottom > viewportHeight - 4) {
      floatCTA();
    }
  }

  function reveal() {
    if (document.activeElement !== inputEl) return;
    let extraPad = 160;
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      extraPad = Math.max(160, Math.round(keyboardHeight) + 24);
    }
    containerEl.style.paddingBottom = `${extraPad}px`;
    requestAnimationFrame(() => {
      clampInputSafe();
      reconcileCTA();
    });
  }

  function clear() {
    containerEl.style.paddingBottom = '';
    unfloatCTA();
  }

  function onContainerScroll() {
    clampInputSafe();
  }

  // item 5 - a real tap on the CTA blurs inputEl first (mousedown/touchstart
  // fires before the click), and clear() used to run synchronously on that
  // blur - yanking the bottom padding away and re-flowing the layout right
  // between the finger going down and lifting up. On a screen where the CTA
  // sits close to the input (exactly the nickname step, now a mandatory tap
  // right after typing), that shift can move the button out from under the
  // tap, silently swallowing it. Debouncing clear() past the click/tap
  // window fixes the swallowed tap without reintroducing the keyboard
  // overlap this function exists to prevent.
  let blurClearTimer = null;
  inputEl.addEventListener('focus', () => {
    clearTimeout(blurClearTimer);
    reveal();
    containerEl.addEventListener('scroll', onContainerScroll);
  });
  inputEl.addEventListener('blur', () => {
    containerEl.removeEventListener('scroll', onContainerScroll);
    clearTimeout(blurClearTimer);
    blurClearTimer = setTimeout(clear, 300);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', reveal);
  }
}

// ===== BOTTOM SHEETS (W6: WV-22, WF-11) =====
// One controller for every sheet: dialog focus (moved into the sheet on open,
// back to the opener on close), the header close button, Escape, a scrim tap,
// and drag-to-dismiss on the grabber or header (past 120px, or a fast flick).
const SHEET_DISMISS_PX = 120;
const SHEET_FLICK_PX_PER_MS = 0.6;
const sheetClosers = {};  // sheet id -> the close function that owns its state
const sheetOpeners = {};  // sheet id -> element focused before it opened

function openSheet(sheetId, overlayId, fallbackOpenerId) {
  const sheet = document.getElementById(sheetId);
  if (!sheet) return;
  const overlay = overlayId ? document.getElementById(overlayId) : null;
  const active = document.activeElement;
  sheetOpeners[sheetId] = (active && active !== document.body && !sheet.contains(active))
    ? active
    : (fallbackOpenerId ? document.getElementById(fallbackOpenerId) : null);
  if (overlay) overlay.style.display = 'block';
  sheet.classList.remove('dragging');
  sheet.classList.add('open');
  sheet.style.transform = 'translateY(0)';
  if (!sheet.hasAttribute('tabindex')) sheet.setAttribute('tabindex', '-1');
  sheet.focus({ preventScroll: true });
  syncToastPlacement();
}

function closeSheet(sheetId, overlayId) {
  const sheet = document.getElementById(sheetId);
  if (!sheet) return;
  const overlay = overlayId ? document.getElementById(overlayId) : null;
  const wasOpen = sheet.classList.contains('open');
  if (overlay) overlay.style.display = 'none';
  sheet.classList.remove('dragging');
  sheet.style.transform = 'translateY(100%)';
  sheet.classList.remove('open');
  syncToastPlacement();
  const opener = sheetOpeners[sheetId];
  sheetOpeners[sheetId] = null;
  if (wasOpen && opener && opener.isConnected && typeof opener.focus === 'function' &&
      (sheet.contains(document.activeElement) || document.activeElement === document.body)) {
    opener.focus({ preventScroll: true });
  }
}

function registerSheet(sheetId, closeFn) {
  const sheet = document.getElementById(sheetId);
  if (!sheet) return;
  sheetClosers[sheetId] = closeFn;
  sheet.querySelectorAll('[data-close-sheet]').forEach(btn => btn.addEventListener('click', closeFn));

  // Drag down on the grabber or the header row. Buttons inside the header
  // (the close button) keep their normal tap.
  let startY = 0, dy = 0, startT = 0, pointerId = null;
  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button, input, a, label')) return;
    pointerId = e.pointerId;
    startY = e.clientY;
    startT = performance.now();
    dy = 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* capture is best effort */ }
    sheet.classList.add('dragging');
  };
  const onMove = (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const onUp = (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    pointerId = null;
    sheet.classList.remove('dragging');
    const elapsed = Math.max(1, performance.now() - startT);
    const flick = dy > 40 && dy / elapsed > SHEET_FLICK_PX_PER_MS;
    if (dy > SHEET_DISMISS_PX || flick) closeFn();
    else sheet.style.transform = 'translateY(0)';
  };
  sheet.querySelectorAll('.sheet-handle, .sheet-header').forEach(zone => {
    zone.addEventListener('pointerdown', onDown);
    zone.addEventListener('pointermove', onMove);
    zone.addEventListener('pointerup', onUp);
    zone.addEventListener('pointercancel', onUp);
  });
}

// Escape closes the confirm dialog first, then the open sheet.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const confirmPopup = document.getElementById('confirm-popup');
  if (confirmPopup && confirmPopup.style.display === 'flex') {
    e.preventDefault();
    hideConfirm();
    return;
  }
  const openId = Object.keys(sheetClosers).find(id => {
    const el = document.getElementById(id);
    return el && el.classList.contains('open');
  });
  if (openId) {
    e.preventDefault();
    sheetClosers[openId]();
  }
});

// WFIX item 5 - while a sheet or the confirm dialog is open, Tab and
// Shift+Tab cycle through its own controls and never reach the dimmed screen
// behind it. Focus is wrapped by hand (not inert), so the scrim tap, the
// Escape handler above and drag-to-close keep working exactly as before.
const FOCUS_TRAP_SHEETS = ['apps-sheet', 'settings-sheet', 'legal-sheet', 'other-sheet'];
function topOpenDialog() {
  const confirmPopup = document.getElementById('confirm-popup');
  if (confirmPopup && confirmPopup.style.display === 'flex') return confirmPopup;
  const stPopup = document.getElementById('screen-time-popup'); // WHERO item 8g
  if (stPopup && stPopup.style.display === 'flex') return stPopup;
  for (const id of FOCUS_TRAP_SHEETS) {
    const el = document.getElementById(id);
    if (el && el.classList.contains('open')) return el;
  }
  return null;
}
// WFIX repair - the Legal sheet's text box carries tabindex="0" in index.html,
// so it stays a Tab stop inside the trap and PageDown, End and the arrow keys
// can still scroll it (the browser's own scroller stop is skipped once Tab is
// handled here).
function dialogFocusables(root) {
  return Array.from(root.querySelectorAll('button, a[href], input, select, textarea, [tabindex]'))
    .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== 'hidden');
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const dialog = topOpenDialog();
  if (!dialog) return;
  e.preventDefault();
  const items = dialogFocusables(dialog);
  if (!items.length) { dialog.focus({ preventScroll: true }); return; }
  const idx = items.indexOf(document.activeElement);
  let next;
  if (e.shiftKey) next = idx <= 0 ? items[items.length - 1] : items[idx - 1];
  else next = (idx === -1 || idx === items.length - 1) ? items[0] : items[idx + 1];
  next.focus();
});

// ===== SETTINGS SHEET =====
let settingsOpen = false;

function openSettings() {
  openSheet('settings-sheet', 'settings-overlay', 'gear-btn');
  settingsOpen = true;
  // A1 - initialize from state, not stale local vars
  setTextContent('allow-val', `${state.dailyAllowanceMinutes} min`);
  setTextContent('goal-set-val', `${state.workoutGoalMin} min`); // WONB
  // fix 6 - sync the earn-rate segmented control's selected button from state
  document.querySelectorAll('#settings-earn-rate-ctrl .earn-rate-btn').forEach(b => {
    b.classList.toggle('selected', parseFloat(b.dataset.rate) === state.earnRateMultiplier);
  });
  // WF-23 - the expiry choice made in onboarding is editable here too.
  const settingsExpires = document.getElementById('settings-expires-toggle');
  if (settingsExpires) settingsExpires.checked = !!state.expiresAtMidnight;
  updateSettingsAccountSection(); // item 5 - re-sync every time the sheet opens
}

// item 5 - Settings > Account: nickname + which provider they signed in
// with. Skips re-writing the nickname field while the user is actively
// typing in it (openSettings() re-runs this any time the sheet re-opens).
function updateSettingsAccountSection() {
  const nickInput = document.getElementById('settings-nickname-input');
  if (nickInput && document.activeElement !== nickInput) {
    nickInput.value = state.userName || '';
  }
  const providerLabel = document.getElementById('settings-provider-label');
  if (providerLabel) {
    providerLabel.textContent = (state.account && state.account.provider) || '-';
  }
}

// A1 - Daily-allowance stepper: writes state, recomputes total, clamps
// remaining, and keeps every display of it (Today hero, caption, intercept) in sync.
function applyAllowanceChange(newAllowance) {
  const usedSeconds = state.totalSeconds - state.remainingSeconds;
  state.dailyAllowanceMinutes = newAllowance;
  state.totalSeconds = dayTotalMinutes() * 60;
  state.remainingSeconds = Math.max(0, Math.min(state.totalSeconds, state.totalSeconds - usedSeconds));
  setTextContent('allow-val', `${state.dailyAllowanceMinutes} min`);
  setTextContent('intercept-allowance', dayTotalMinutes());
  updateRingDisplay();
  updateRingCaption();
  refreshTodayNumbers();
  saveState();
}

function closeSettings() {
  closeSheet('settings-sheet', 'settings-overlay');
  settingsOpen = false;
}

// ===== OTHER WORKOUT LIBRARY SHEET (item 3c) =====
// Same sheet controller as Settings, its own overlay + sheet.
function openOtherLibrary() {
  openSheet('other-sheet', 'other-overlay', 'other-workout-tile');
}

function closeOtherLibrary() {
  closeSheet('other-sheet', 'other-overlay');
}

// ===== SAVE/LOAD (A4, A11) =====
function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  return Math.round((d2 - d1) / 86400000);
}

// WF-03 - the page can stay open across midnight (it ships as a home-screen
// web app). Compare the day the numbers belong to with the clock and run the
// daily reset the moment they differ: before every save, on return to the
// foreground, and once a minute. Returns true when a reset ran.
let dayCheckRunning = false;

function ensureCurrentDay() {
  const today = todayStr();
  if (!state.currentDay) { state.currentDay = today; return false; }
  if (state.currentDay === today) return false;
  if (!localStorage.getItem('balance_onboarded')) { state.currentDay = today; return false; } // nothing real to roll over yet
  if (daysBetween(state.currentDay, today) < 0) { state.currentDay = today; return false; } // clock moved backward (fix 14)
  if (dayCheckRunning) return false;
  dayCheckRunning = true;
  try {
    applyDailyReset(state.currentDay, today);
    paintAppShell(); // ring, caption, tiles, date pill, greeting, streak, chart, timer card
  } finally {
    dayCheckRunning = false;
  }
  return true;
}

// Single storage key (A11) - everything lives in balance_state.
function saveState() {
  if (typeof coachHoldsSaves === 'function' && coachHoldsSaves()) return; // a Coach test address (?coach= or ?coachSeed=) only reads; it never writes the saved demo
  ensureCurrentDay(); // WF-03 - never stamp a new date on yesterday's numbers
  localStorage.setItem('balance_state', JSON.stringify({
    earnedMinutes: state.earnedMinutes,
    unlockMinutesToday: state.unlockMinutesToday, // W3
    streakDays: state.streakDays,
    streakShields: state.streakShields,
    dailyAllowanceMinutes: state.dailyAllowanceMinutes,
    selectedApps: state.selectedApps,
    healthConnected: state.healthConnected,
    earnRateMultiplier: state.earnRateMultiplier,
    expiresAtMidnight: state.expiresAtMidnight,
    remainingSeconds: state.remainingSeconds,
    userName: state.userName,
    dailyHours: state.dailyHours, // W5 - the baseline card shows the user's own guess after a reload
    workoutGoalMin: state.workoutGoalMin, // WONB
    monitoringStartedAt: state.monitoringStartedAt, // WFIX item 1 - left out of the save while undefined (older saves)
    account: state.account, // item 5
    lastWorkout: state.lastWorkout,
    worktimeLoggedToday: state.worktimeLoggedToday,
    pendingSession: state.pendingSession,
    activeWorkout: state.activeWorkout,
    savedDate: state.currentDay || todayStr(), // WF-03 - the day the numbers belong to, not the clock
  }));
}

// New day (A13, B2, WF-04, WF-05, WF-26).
// Streak rule: the last saved day counts when its used minutes stayed within
// that day's allowance (base + earned + minutes a partner approved). A day
// over the allowance spends a Streak Shield, or ends the
// streak. Days with no saved data at all (the app was never opened) neither
// count nor break. Earned time carries over only if it was not used and the
// expiry toggle is off; minutes a partner approved never carry over. A
// workout still running at midnight is credited to the new day instead of
// being dropped.
function applyDailyReset(prevDateStr, curDateStr) {
  const daysElapsed = daysBetween(prevDateStr, curDateStr);
  state.currentDay = curDateStr; // first, so the saves below cannot re-enter this reset

  // Yesterday's verdict, from the numbers as they stood when that day ended.
  const usedYesterday = getUsedMinutesToday();
  const allowanceYesterday = dayTotalMinutes();
  const yesterdayKept = usedYesterday <= allowanceYesterday;

  // A live workout that crossed midnight: remember it, credit it below (WF-26).
  const crossingWorkout = state.activeWorkout;
  const crossingMinutes = crossingWorkout
    ? Math.max(0, Math.round(computeActiveWorkoutElapsedMs() / 60000))
    : 0;
  state.activeWorkout = null;
  state.pendingSession = null;

  // Carry only the unused part of what was earned (WF-04). Minutes a partner
  // approved (W3) were granted after time ran out, so they are the last ones
  // spent: anything left at midnight is theirs first, and those never carry.
  // Only what is left beyond them can be unused earned time.
  const leftoverMinutes = Math.floor(state.remainingSeconds / 60);
  const unusedEarned = leftoverMinutes - state.unlockMinutesToday;
  const carried = state.expiresAtMidnight
    ? 0
    : Math.max(0, Math.min(unusedEarned, state.earnedMinutes));
  state.earnedMinutes = carried;
  state.unlockMinutesToday = 0; // W3 - a partner unlock is for one day only, never carried
  state.remainingSeconds = (state.dailyAllowanceMinutes + carried) * 60;
  state.totalSeconds = state.remainingSeconds;
  state.lastWorkout = null;
  state.worktimeLoggedToday = [];
  if (carried > 0) pendingToastMessages.push(`${carried} min of unused earned time carried over`);

  if (daysElapsed >= 1) {
    if (yesterdayKept) {
      state.streakDays += 1;
    } else if (state.streakShields > 0) {
      state.streakShields -= 1;
      pendingToastMessages.push(`Streak Shield used - ${state.streakDays}-day streak saved`);
    } else {
      state.streakDays = 0;
    }
  }

  saveState(); // persist the reset with today's savedDate right away

  if (crossingWorkout && crossingMinutes > 0) {
    creditWorkout(crossingWorkout.name, crossingMinutes, { quiet: true });
    if (typeof coachLogCrossing === 'function') coachLogCrossing(crossingWorkout.name, crossingMinutes); // the coach's history counts it too
    pendingToastMessages.push('Your workout from last night was logged today.');
  }
}

function loadState() {
  state.currentDay = todayStr();
  const raw = localStorage.getItem('balance_state');
  let saved = null;
  if (raw) {
    try { saved = JSON.parse(raw); } catch (e) { saved = null; }
  }

  if (!saved) {
    // One-time legacy fallback (A11) - read the old key once, then never again.
    const legacyApps = localStorage.getItem('balance_selected_apps');
    if (legacyApps) {
      try { state.selectedApps = JSON.parse(legacyApps); } catch (e) { /* ignore */ }
    }
    return;
  }

  // An older save may still carry the made-up "actual usage" number from the
  // removed reveal step. Drop it before it can land on state, and rewrite the
  // save so it is gone from storage too.
  let scrubbedStaleKeys = false;
  if ('actualDailyHours' in saved) {
    delete saved.actualDailyHours;
    scrubbedStaleKeys = true;
  }

  Object.assign(state, saved);

  // item 5 - guard against a missing/malformed account object from an older
  // save or a garbled value, so downstream code can always assume the shape.
  if (!state.account || typeof state.account !== 'object') {
    state.account = { provider: null, accountId: null };
  }

  // item 2c/3b - guard against a missing/malformed pendingSession or
  // activeWorkout from an older save or a garbled value.
  if (!state.pendingSession || typeof state.pendingSession !== 'object') {
    state.pendingSession = null;
  }
  if (!state.activeWorkout || typeof state.activeWorkout !== 'object') {
    state.activeWorkout = null;
  }

  // fix 9 - corrupt-storage guard: coerce every numeric field through
  // Number(...) and fall back to a sane default on any non-finite result
  // (NaN/Infinity), so a garbled localStorage value (e.g. earnedMinutes
  // stored as the string "not-a-number") can't leak into captions/labels
  // anywhere it's displayed, not just the Today hero (which clamps its own).
  const numericDefaults = {
    earnedMinutes: 0,
    unlockMinutesToday: 0,
    streakDays: 1,
    streakShields: 0,
    dailyAllowanceMinutes: 45,
    earnRateMultiplier: 1,
    remainingSeconds: 45 * 60,
  };
  Object.keys(numericDefaults).forEach(key => {
    const n = Number(state[key]);
    state[key] = Number.isFinite(n) ? n : numericDefaults[key];
  });

  // WFIX item 1 - the start time is a finite number, or null while setup
  // finished with no app picked. Anything else (missing in an older save, or
  // garbled) means "started before today", so a returning visitor sees no jump.
  if (state.monitoringStartedAt !== null &&
      !(typeof state.monitoringStartedAt === 'number' && Number.isFinite(state.monitoringStartedAt))) {
    state.monitoringStartedAt = undefined;
  }

  // XP-11 - a stored allowance outside today's range snaps into it (5-min steps).
  state.dailyAllowanceMinutes = clampAllowance(state.dailyAllowanceMinutes);
  // WONB - a save from before the movement goal existed has none: 30. Any
  // stored value snaps into 10 to 120 in 5-min steps.
  state.workoutGoalMin = clampWorkoutGoal(state.workoutGoalMin);
  // Totals are derived, never stored; the day engine below reads them.
  state.totalSeconds = dayTotalMinutes() * 60;
  state.remainingSeconds = Math.max(0, Math.min(state.remainingSeconds, state.totalSeconds));

  const today = todayStr();

  if (!saved.savedDate || saved.savedDate === today) {
    state.currentDay = today;
  } else {
    const daysElapsed = daysBetween(saved.savedDate, today);
    if (daysElapsed < 0) {
      // fix 14 - clock-skew guard: the saved date is LATER than today (the
      // system clock moved backward). Don't run the daily reset at all -
      // that would zero earnedMinutes/worktimeLoggedToday and leave the
      // streak logic in a half-updated state. Just re-stamp today's date;
      // nothing else changes.
      state.currentDay = today;
      saveState();
    } else {
      applyDailyReset(saved.savedDate, today);
    }
  }

  if (scrubbedStaleKeys) saveState();
}

function replayDemo() {
  localStorage.clear();
  location.reload();
}

// ===== ACCOUNT (item 5) =====

// Generic destructive-action confirm dialog, shared by Sign out and Delete
// account so both get the same "no dead end, always cancelable" treatment.
let confirmCallback = null;
let confirmOpener = null; // WFIX item 5 - focus goes back here when the dialog closes

function showConfirm(title, body, onConfirm, okLabel = 'Confirm') {
  setTextContent('confirm-title', title);
  setTextContent('confirm-body', body);
  setTextContent('confirm-ok-btn', okLabel);
  confirmCallback = onConfirm;
  const popup = document.getElementById('confirm-popup');
  if (!popup) return;
  const active = document.activeElement;
  confirmOpener = (active && active !== document.body && !popup.contains(active)) ? active : null;
  popup.style.display = 'flex';
  const cancel = document.getElementById('confirm-cancel-btn');
  if (cancel) cancel.focus({ preventScroll: true });
}

function hideConfirm() {
  const popup = document.getElementById('confirm-popup');
  const wasOpen = !!(popup && popup.style.display === 'flex');
  if (popup) popup.style.display = 'none';
  confirmCallback = null;
  const opener = confirmOpener;
  confirmOpener = null;
  if (wasOpen && opener && opener.isConnected && typeof opener.focus === 'function') {
    opener.focus({ preventScroll: true });
  }
}

// Sign out (WF-02) only signs the account out. The plan, streak, earned time,
// history and nickname stay in balance_state on this device, balance_onboarded
// stays set, and a balance_signed_out flag routes the next launch to the
// sign-in step; signing back in clears the flag and lands straight in the app.
// Every session-only beat and timer is stopped here (WF-16, WF-01) because
// sign out never reloads the page.
function signOutAccount() {
  closeSettings();
  state.account = { provider: null, accountId: (state.account && state.account.accountId) || null };
  localStorage.setItem(SIGNED_OUT_KEY, 'true');
  localStorage.removeItem(ONBOARDING_PROGRESS_KEY);

  // W3 - the partner card reflects persisted state only; just repaint it.
  renderSarahStatus();

  // Overlays and their timers.
  hideBreathingPause();
  clearTimeout(pendingSessionTimer);
  pendingSessionTimer = null;
  hideOverlay('app-transition-screen');
  hideIntercept();
  hideLockScreen();
  hideShareScreen();
  closeOtherLibrary();

  // A running workout or an unresolved session does not follow the account.
  state.activeWorkout = null;
  state.pendingSession = null;
  if (typeof coachSignOutCleanup === 'function') coachSignOutCleanup(); // stops the timer, closes Coach's cover and sheet, cancels a planned workout
  saveState();

  // Paywall leftovers from an earlier pass through onboarding.
  const promoWrap = document.getElementById('promo-input-wrap');
  if (promoWrap) promoWrap.style.display = 'none';
  const promoInputEl = document.getElementById('promo-input');
  if (promoInputEl) promoInputEl.value = '';
  clearPromoError();

  switchTab('today');
  showScreen('onboarding-screen');
  showObStep('ob-step-account');
}

// Delete account wipes everything and returns to the very start - same as
// Replay demo, which already does a full localStorage.clear() (so account
// state is guaranteed gone too, not just reset).
function deleteAccount() {
  closeSettings();
  replayDemo();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {

  // item 5 - #phone-frame must never scroll: every full-screen popup
  // (Screen Time / Health / SSO mock / confirm dialog) is positioned via
  // position:absolute; inset:0 relative to it, on the assumption it sits at
  // scrollTop 0. #phone-frame uses overflow:hidden, which blocks user-driven
  // scrolling but NOT a browser-native "scroll the focused element into
  // view" - focusing a button/input nested a few levels deep (e.g. Confirm
  // inside the sign-out dialog, or a field inside the now-taller Settings
  // sheet) can walk up the ancestor chain and leave #phone-frame itself with
  // a stray scrollTop, which then silently shifts every inset:0 overlay off
  // screen. Snap it back immediately if that ever happens.
  const phoneFrameEl = document.getElementById('phone-frame');
  if (phoneFrameEl) {
    phoneFrameEl.addEventListener('scroll', () => {
      phoneFrameEl.scrollTop = 0;
      phoneFrameEl.scrollLeft = 0;
    });
  }

  loadState();

  // W6 (WV-19) - no pulsing Earn more button with Reduce Motion on
  syncEarnPulse();
  if (window.matchMedia) {
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (rm.addEventListener) rm.addEventListener('change', syncEarnPulse);
  }

  // Check if already onboarded
  const onboarded = localStorage.getItem('balance_onboarded');
  // fix 2 - a mid-onboarding reload used to be binary on 'balance_onboarded'
  // and always wipe selectedApps. Restore a checkpoint if one exists;
  // otherwise (a genuinely fresh profile) start empty exactly as before.
  const onboardingProgress = onboarded ? null : loadOnboardingProgress();
  if (!onboarded) {
    if (onboardingProgress) {
      state.selectedApps = onboardingProgress.selectedApps || [];
      state.dailyHours = onboardingProgress.dailyHours ?? state.dailyHours;
      state.dailyAllowanceMinutes = onboardingProgress.dailyAllowanceMinutes ?? state.dailyAllowanceMinutes;
      state.earnRateMultiplier = onboardingProgress.earnRateMultiplier ?? state.earnRateMultiplier;
      state.expiresAtMidnight = onboardingProgress.expiresAtMidnight ?? state.expiresAtMidnight;
      state.userName = onboardingProgress.userName || '';
      state.paywallYears = onboardingProgress.paywallYears ?? null;
      state.account = onboardingProgress.account || state.account; // item 5
      state.healthConnected = onboardingProgress.healthConnected ?? state.healthConnected; // WF-12
      state.workoutGoalMin = clampWorkoutGoal(onboardingProgress.workoutGoalMin ?? state.workoutGoalMin); // WONB
      screenTimeAnswered = !!onboardingProgress.screenTimeAnswered; // WONB
    } else {
      state.selectedApps = [];
    }
  }

  // item 5 - true once a (simulated) account exists, so a fresh onboarding
  // start can skip straight past account creation + nickname.
  function hasAccount() {
    return !!(state.account && state.account.provider && state.userName);
  }

  // ── SPLASH ──
  const splashScreen = document.getElementById('splash-screen');
  splashScreen.classList.add('active');

  // Animate splash ring
  setTimeout(() => {
    const arc = document.getElementById('splash-ring-arc');
    if (arc) arc.classList.add('ring-draw-anim');
  }, 200);

  // Auto-advance splash
  setTimeout(() => {
    if (onboarded && localStorage.getItem(SIGNED_OUT_KEY) === 'true') {
      // WF-02 - signed out, plan kept: straight to sign-in, nothing else.
      showScreen('onboarding-screen');
      showObStep('ob-step-account');
    } else if (onboarded) {
      showScreen('app-shell');
      paintAppShell(); // fix 3 - rebuild from persisted state, not stale DOM
    } else if (onboardingProgress && onboardingProgress.step === 'paywall') {
      // WF-12 - a reload on the paywall comes back to the paywall; Health was
      // already answered and is not asked again.
      resumeOnboardingUI('ob-step-d');
      currentObStep = 'paywall';
      screenTimeAnswered = true;
      updatePaywallPersonalLine();
      showScreen('paywall-screen');
    } else if (onboardingProgress && onboardingProgress.step) {
      // fix 2 - resume mid-onboarding exactly where the user left off. Steps
      // after the Screen Time prompt count it as answered, so it never pops
      // again; the Health prompt is only ever shown from the movement goal
      // button, never on resume.
      showScreen('onboarding-screen');
      resumeOnboardingUI(onboardingProgress.step);
      if (OB_STEP_ORDER.indexOf(onboardingProgress.step) >= OB_STEP_ORDER.indexOf('ob-step-b')) screenTimeAnswered = true;
      showObStep(onboardingProgress.step);
    } else {
      // WONB - no Welcome screen: sign in is the first screen after the
      // splash. Someone who already has an account skips straight to the
      // app picker, as before.
      showScreen('onboarding-screen');
      resumeOnboardingUI(hasAccount() ? 'ob-step-a' : 'ob-step-account');
      if (hasAccount()) showObStep('ob-step-a');
      else saveOnboardingProgress();
    }
  }, 1800);

  // WF-03 - a page left open rolls over at midnight on its own.
  setInterval(ensureCurrentDay, 60000);

  // WF-28 - back chevrons in the onboarding headers.
  document.querySelectorAll('.ob-back-btn').forEach(btn => btn.addEventListener('click', goBackObStep));

  // ── ONBOARDING ──

  // ── STEP ACCOUNT: simulated SSO sign-in (item 5) ──
  let ssoSheetTimer = null;

  function generateMockAccountId() {
    return 'demo_' + Math.random().toString(36).slice(2, 10);
  }

  function showMockSSOSheet(provider) {
    const popup = document.getElementById('sso-mock-popup');
    setTextContent('sso-mock-text', `Signing in with ${provider}…`);
    if (popup) popup.style.display = 'flex';
    clearTimeout(ssoSheetTimer);
    ssoSheetTimer = setTimeout(() => {
      if (popup) popup.style.display = 'none';
      completeAccountSignIn(provider);
    }, 1300);
  }

  function completeAccountSignIn(provider) {
    state.account = {
      provider,
      accountId: (state.account && state.account.accountId) || generateMockAccountId(),
    };
    // WF-02 - signing back in after Sign out: the plan and history were kept
    // on this device, so skip onboarding and its new-user resets entirely.
    if (localStorage.getItem(SIGNED_OUT_KEY) === 'true'
        && localStorage.getItem('balance_onboarded')
        && localStorage.getItem('balance_state')) {
      localStorage.removeItem(SIGNED_OUT_KEY);
      saveState();
      showScreen('app-shell');
      paintAppShell();
      return;
    }
    saveOnboardingProgress();
    saveState();
    showObStep('ob-step-nickname');
  }

  document.querySelectorAll('.sso-btn').forEach(btn => {
    btn.addEventListener('click', () => showMockSSOSheet(btn.dataset.provider));
  });

  // ── LEGAL SHEET: Terms / Privacy (item 5) ──
  const LEGAL_CONTENT = {
    terms: {
      title: 'Terms of Service',
      html: `
        <p>Using Balance requires an account. Your Balance membership, including your daily allowance, earned time, and any paid subscription, is tied to the account you create here - it does not carry over if you create a different account.</p>
        <p>You can sign out of your account at any time from Settings. Signing out does not delete your data - your progress is waiting for you next time you sign back in.</p>
        <p>You can also permanently delete your account from Settings. Deleting your account removes your saved plan, streaks, and history from this device and cannot be undone.</p>
        <p>Be respectful of the Friends feature - it is meant to encourage, not to monitor or pressure another person.</p>
        <p>This is a demo build of Balance. Account sign-in in this demo is simulated and does not create a real account with Apple or Google.</p>
      `,
    },
    privacy: {
      title: 'Privacy Policy',
      html: `
        <p>When you create a Balance account, we store basic account details (like your sign-in provider and the nickname you choose) and your in-app activity, such as the plan settings you choose.</p>
        <p>We may use your account and in-app activity data to operate Balance, personalize your experience, and improve the product over time. This data may also be used for advertising. Workout data from Apple Health is read-only, used only to calculate earned minutes, and is never shared, sold, or used for advertising.</p>
        <p>Your Screen Time data works differently. Screen Time usage is read and processed entirely on your device. It is never uploaded to our servers, never sold, and never used for advertising - it stays on your iPhone and is only used to power the features you see inside the app, like your daily allowance and usage charts.</p>
        <p>Balance never sends your usage to anyone, including an accountability partner. A partner only sees the unlock code you choose to share with them.</p>
        <p>You can sign out or permanently delete your account at any time in Settings.</p>
        <p>This is a demo build. No real Screen Time or Health data is collected in this demo - the numbers you see are simulated.</p>
      `,
    },
  };

  function openLegalSheet(kind) {
    const doc = LEGAL_CONTENT[kind];
    if (!doc) return;
    setTextContent('legal-sheet-title', doc.title);
    const body = document.getElementById('legal-scroll-body');
    if (body) { body.innerHTML = doc.html; body.scrollTop = 0; }
    openSheet('legal-sheet', 'legal-overlay', kind === 'terms' ? 'terms-link' : 'privacy-link');
  }

  function closeLegalSheet() {
    closeSheet('legal-sheet', 'legal-overlay');
  }
  registerSheet('legal-sheet', closeLegalSheet); // W6 (WV-22) - close button, Escape, drag

  document.getElementById('terms-link').addEventListener('click', () => openLegalSheet('terms'));
  document.getElementById('privacy-link').addEventListener('click', () => openLegalSheet('privacy'));
  document.getElementById('legal-overlay').addEventListener('click', closeLegalSheet);
  document.getElementById('legal-close-btn').addEventListener('click', closeLegalSheet);

  // ── STEP NICKNAME (item 5) ──
  const nicknameInput = document.getElementById('nickname-input');
  const nicknameError = document.getElementById('nickname-error');

  if (nicknameInput) {
    nicknameInput.addEventListener('input', () => {
      nicknameInput.classList.remove('error');
      if (nicknameError) nicknameError.style.display = 'none';
    });
    // WF-17 - Return behaves like Continue, same as the promo field.
    nicknameInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const next = document.getElementById('ob-nickname-next');
      if (next) next.click();
    });
  }

  document.getElementById('ob-nickname-next').addEventListener('click', () => {
    const nickname = validateNickname(nicknameInput ? nicknameInput.value : '');
    if (!nickname) {
      if (nicknameInput) {
        nicknameInput.classList.remove('error');
        void nicknameInput.offsetWidth; // reflow so the shake replays
        nicknameInput.classList.add('error');
      }
      if (nicknameError) nicknameError.style.display = 'block';
      return;
    }
    state.userName = nickname;
    saveOnboardingProgress();
    saveState();
    showObStep('ob-step-a');
  });

  // Step A: app selection
  document.querySelectorAll('.app-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const app = tile.dataset.app;
      tile.classList.toggle('selected');
      // Springy animation
      tile.style.transform = 'scale(1.12)';
      setTimeout(() => { tile.style.transform = ''; }, 150);

      if (tile.classList.contains('selected')) {
        if (!state.selectedApps.includes(app)) state.selectedApps.push(app);
      } else {
        state.selectedApps = state.selectedApps.filter(a => a !== app);
      }
      updateAppPickerNext(); // WC-28
      saveOnboardingProgress(); // fix 2 - checkpoint the pick itself, not just "Continue"
    });
  });
  updateAppPickerNext();

  // WC-28 - no silent default: Continue is disabled until an app is picked.
  // WONB - like the iPhone app, the Screen Time prompt comes right after the
  // apps are picked. Answered once: coming back here later goes straight on.
  let stDenyCount = 0;
  let stOpener = null; // WHERO item 8g - focus goes back here when the prompt closes

  document.getElementById('ob-a-next').addEventListener('click', () => {
    if (state.selectedApps.length === 0) return;
    saveState();
    if (screenTimeAnswered) {
      showObStep('ob-step-b');
      return;
    }
    stDenyCount = 0;
    const stLink = document.getElementById('st-continue-btn');
    if (stLink) stLink.style.display = 'none';
    const stPopup = document.getElementById('screen-time-popup');
    if (stPopup) stPopup.style.display = 'flex';
    // WHERO item 8g - focus moves into the prompt (Tab and Shift+Tab then stay
    // inside it, see topOpenDialog) and returns to this button when it closes.
    stOpener = document.getElementById('ob-a-next');
    const stFirst = document.getElementById('st-deny-btn');
    if (stFirst) stFirst.focus({ preventScroll: true });
  });

  // Step B: slider
  const slider = document.getElementById('time-slider');
  const sliderVal = document.getElementById('slider-value');

  function updateSliderLabel(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    sliderVal.textContent = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  }

  function updateSliderDisplay(val) {
    const mins = parseInt(val);
    updateSliderLabel(mins);
    state.dailyHours = mins / 60;
  }

  slider.addEventListener('input', () => { updateSliderDisplay(slider.value); saveOnboardingProgress(); });
  // W5 - the saved guess sets the slider on load, never the other way round,
  // so a reload cannot reset the user's guess to the slider's default.
  const savedGuessMins = Math.round(Number(state.dailyHours) * 60);
  if (Number.isFinite(savedGuessMins) && savedGuessMins > 0) {
    slider.value = String(savedGuessMins);
  } else {
    state.dailyHours = parseInt(slider.value) / 60;
  }
  updateSliderLabel(parseInt(slider.value));

  // WONB - the Screen Time prompt is behind us by now: straight to the reveal.
  document.getElementById('ob-b-next').addEventListener('click', () => {
    showObStep('ob-step-c');
    initOnboardingStepC();
  });

  // Screen Time popup. The demo cannot read past usage, so either answer goes
  // on to the hours guess; the reveal after it is built only from that guess.
  function closeScreenTimePopup() {
    const stPopup = document.getElementById('screen-time-popup');
    const wasOpen = !!(stPopup && stPopup.style.display === 'flex');
    if (stPopup) stPopup.style.display = 'none';
    const opener = stOpener;
    stOpener = null;
    if (wasOpen && opener && opener.isConnected) opener.focus({ preventScroll: true });
  }

  function advancePastScreenTime() {
    closeScreenTimePopup();
    screenTimeAnswered = true; // set first, so the step change saves it
    showObStep('ob-step-b');
  }

  document.getElementById('st-allow-btn').addEventListener('click', advancePastScreenTime);

  // Declining explains why, in place, and asks again. After the second
  // Don't Allow a quiet "Continue without it" link appears, so a permission
  // never stands between the user and the rest of setup.
  const ST_DESC_DEFAULT = "Balance uses Screen Time to measure time in the apps you pick and to shield them once your allowance runs out. This stays on your iPhone - it's never uploaded anywhere.";
  const ST_DESC_REQUIRED = "Measuring and limiting your app time is the product - without Screen Time there's nothing for Balance to do. Your data never leaves this iPhone.";
  let stDescRevertTimer = null;

  document.getElementById('st-deny-btn').addEventListener('click', () => {
    stDenyCount++;
    const desc = document.getElementById('st-popup-desc');
    if (desc) {
      desc.textContent = ST_DESC_REQUIRED;
      desc.style.color = '#F59E0B';
      clearTimeout(stDescRevertTimer);
      stDescRevertTimer = setTimeout(() => {
        desc.textContent = ST_DESC_DEFAULT;
        desc.style.color = '';
      }, 4000);
    }
    if (stDenyCount >= 2) {
      const stLink = document.getElementById('st-continue-btn');
      if (stLink) stLink.style.display = 'block';
    }
  });

  document.getElementById('st-continue-btn').addEventListener('click', advancePastScreenTime);

  // Step C: shock screen - continue
  document.getElementById('ob-c-next').addEventListener('click', () => {
    showObStep('ob-step-d');
  });

  // Step D: let's do this - on to the movement goal (WONB)
  document.getElementById('ob-d-next').addEventListener('click', () => {
    renderWorkoutGoal(); // the earn line follows the rate just chosen
    showObStep('ob-step-e');
  });

  // Step E (WONB): daily movement goal. Minus / plus move in 5-min steps and
  // stop at 10 and 120; a chip jumps to its value. "Set my goal" saves it and
  // opens the Health look-alike, like the iPhone app.
  let healthDenyCount = 0;

  document.getElementById('goal-dec').addEventListener('click', () => {
    if (state.workoutGoalMin > WORKOUT_GOAL_MIN) setWorkoutGoal(state.workoutGoalMin - WORKOUT_GOAL_STEP);
  });
  document.getElementById('goal-inc').addEventListener('click', () => {
    if (state.workoutGoalMin < WORKOUT_GOAL_MAX) setWorkoutGoal(state.workoutGoalMin + WORKOUT_GOAL_STEP);
  });
  document.querySelectorAll('.goal-chip').forEach(chip => {
    chip.addEventListener('click', () => setWorkoutGoal(Number(chip.dataset.goal)));
  });
  renderWorkoutGoal();

  document.getElementById('ob-e-next').addEventListener('click', () => {
    setWorkoutGoal(state.workoutGoalMin);
    saveState();
    if (state.healthConnected === true || state.healthConnected === false) {
      // Already answered on this device: never asked twice.
      advanceToPaywall();
      return;
    }
    healthDenyCount = 0;
    const healthLink = document.getElementById('health-continue-btn');
    if (healthLink) healthLink.style.display = 'none';
    const healthPopup = document.getElementById('health-popup');
    if (healthPopup) healthPopup.style.display = 'flex';
  });

  // Plan step D handlers
  const planSlider = document.getElementById('plan-allowance-slider');
  if (planSlider) {
    planSlider.addEventListener('input', () => {
      state.dailyAllowanceMinutes = parseInt(planSlider.value);
      setTextContent('plan-allowance-display', `${state.dailyAllowanceMinutes} min`);
      saveOnboardingProgress(); // fix 2
    });
  }

  // Onboarding's earn-rate control - scoped to its own container so it never
  // touches the Settings sheet's copy of the same control (fix 6).
  document.querySelectorAll('#earn-rate-ctrl .earn-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#earn-rate-ctrl .earn-rate-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.earnRateMultiplier = parseFloat(btn.dataset.rate);
      updateEarnRateNote();
      renderWorkoutGoal(); // WONB - the goal's earn line follows the rate
      saveOnboardingProgress(); // fix 2
    });
  });

  const expiresToggle = document.getElementById('expires-toggle');
  if (expiresToggle) {
    expiresToggle.addEventListener('change', () => {
      state.expiresAtMidnight = expiresToggle.checked;
      saveOnboardingProgress(); // fix 2
    });
  }

  // B4 - personalized line on the paywall, from the same guess-based helpers
  // as the shock step, so the two screens always agree.
  function updatePaywallPersonalLine() {
    const el = document.getElementById('paywall-personal-line');
    if (!el) return;
    const label = guessLabel(roundedGuessMinutes());
    const years = guessYears().toFixed(1);
    el.textContent = `If ${label} a day is about right, that's ${years} years of your remaining waking life.`;
  }

  // Health popup. Allow connects Health and moves on to the paywall. Nothing
  // claims a sync happened, because none did.
  function closeHealthPopup() {
    const healthPopup = document.getElementById('health-popup');
    if (healthPopup) healthPopup.style.display = 'none';
  }

  function advanceToPaywall() {
    updatePaywallPersonalLine();
    currentObStep = 'paywall';
    saveOnboardingProgress(); // WF-12 - a reload here resumes on the paywall with Health already answered
    setTimeout(() => showScreen('paywall-screen'), 600);
  }

  document.getElementById('health-allow-btn').addEventListener('click', () => {
    closeHealthPopup();
    state.healthConnected = true;
    advanceToPaywall();
  });

  // Declining explains what is lost, in place, and asks again. After the
  // second Don't Allow a quiet "Continue without it" link appears; the
  // paywall is never gated behind a permission.
  const HEALTH_DESC_DEFAULT = 'Balance reads your workouts so every active minute becomes scroll time.';
  const HEALTH_DESC_REQUIRED = "Without Health access, workouts from your Watch and other apps can't turn into scroll time - earning would only work with Balance's own timer.";
  let healthDescRevertTimer = null;

  document.getElementById('health-deny-btn').addEventListener('click', () => {
    healthDenyCount++;
    const desc = document.getElementById('health-popup-desc');
    if (desc) {
      desc.textContent = HEALTH_DESC_REQUIRED;
      desc.style.color = '#F59E0B';
      clearTimeout(healthDescRevertTimer);
      healthDescRevertTimer = setTimeout(() => {
        desc.textContent = HEALTH_DESC_DEFAULT;
        desc.style.color = '';
      }, 4000);
    }
    if (healthDenyCount >= 2) {
      const healthLink = document.getElementById('health-continue-btn');
      if (healthLink) healthLink.style.display = 'block';
    }
  });

  document.getElementById('health-continue-btn').addEventListener('click', () => {
    closeHealthPopup();
    state.healthConnected = false;
    advanceToPaywall();
  });

  // ── PAYWALL ──

  // Transparent trial billing - date computed at render time, phrasing follows
  // the selected plan card, re-rendered on every selection change.
  function updateTrialBillingLine() {
    const el = document.getElementById('trial-billing-line');
    if (!el) return;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const dateStr = `${months[d.getMonth()]} ${d.getDate()}`;
    const yearlySelected = !!document.querySelector('#plan-yearly.selected');
    const price = yearlySelected ? '$39.99/yr' : '$7.99/mo';
    el.textContent = `7 days free (until ${dateStr}), then ${price} unless you cancel at least a day before the trial ends. Manage or cancel anytime in Settings.`;
  }

  document.querySelectorAll('.price-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.price-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      updateTrialBillingLine();
    });
  });
  updateTrialBillingLine();

  document.getElementById('start-trial-btn').addEventListener('click', () => {
    showToast('This is a demo - no charge 😄');
    setTimeout(() => proceedToApp(), 1200);
  });

  document.getElementById('promo-toggle').addEventListener('click', () => {
    const wrap = document.getElementById('promo-input-wrap');
    wrap.style.display = wrap.style.display === 'none' ? 'flex' : 'none';
  });

  document.getElementById('promo-apply').addEventListener('click', handlePromoCode);

  document.getElementById('promo-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePromoCode();
  });
  document.getElementById('promo-input').addEventListener('input', clearPromoError); // WF-18

  document.getElementById('restore-link').addEventListener('click', () => {
    showToast('No purchases found.');
  });

  // item 4 - keyboard-aware CTA, scoped to exactly the two screens with a
  // text input ahead of the primary button: the nickname step (item 5 moved
  // this off the plan step) and the promo-code input on the paywall. Every
  // other screen's CTA placement is untouched.
  setupKeyboardAwareCTA(
    document.getElementById('nickname-input'),
    document.getElementById('ob-step-nickname'),
    document.getElementById('ob-nickname-next')
  );
  setupKeyboardAwareCTA(
    document.getElementById('promo-input'),
    document.querySelector('.paywall-content'),
    document.getElementById('start-trial-btn')
  );

  // ── APP SHELL ──

  // Tab bar
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Gear / settings
  document.getElementById('gear-btn').addEventListener('click', openSettings);

  // Earn more time button: go to the Coach tab
  document.getElementById('earn-more-btn').addEventListener('click', () => switchTab('coach'));

  // Widget link in Today tab
  document.getElementById('widget-link-today').addEventListener('click', showLockScreen);

  // ── BREATHING PAUSE (B1) / APP SESSION (item 2c) ──
  document.getElementById('breathing-open-btn').addEventListener('click', () => {
    startAppSession(breathingAppName || state.selectedApps[0] || 'TikTok');
  });
  document.getElementById('breathing-cancel-btn').addEventListener('click', () => {
    hideBreathingPause();
    showToast("Nice. That's the whole idea. 💪");
  });

  // ── INTERCEPT SCREEN ──
  document.querySelectorAll('.intercept-row').forEach(row => {
    row.addEventListener('click', () => {
      const mins = parseInt(row.dataset.mins, 10);
      const baseMins = parseInt(row.dataset.baseMins, 10);
      const exercise = row.dataset.exercise;
      startInterceptExercise(mins, exercise, baseMins);
    });
  });

  // A2 - ✕ and "I'll wait until tomorrow" both close without earning.
  document.getElementById('intercept-close-btn').addEventListener('click', closeInterceptNoEarn);
  document.getElementById('wait-tomorrow-btn').addEventListener('click', closeInterceptNoEarn);

  // B3 - partner approve path: first ask declines, "Ask again" approves.
  document.getElementById('ask-partner-btn').addEventListener('click', askSarah);
  document.getElementById('ask-again-btn').addEventListener('click', askSarah);

  // ── COACH TAB ── (coach.js wires its own taps)

  // WHERO - the Today hero pauses on other tabs and under covers, and a toast
  // on screen moves to the top when "+ Earn more" scrolls under it.
  watchHeroScale();
  const todayScrollEl = document.querySelector('#tab-today .tab-scroll');
  if (todayScrollEl) todayScrollEl.addEventListener('scroll', liftToastsOffEarnMore, { passive: true });

  // item 3c - "Other" workout-type library sheet.
  document.getElementById('other-overlay').addEventListener('click', closeOtherLibrary);
  document.querySelectorAll('.other-workout-row').forEach(row => {
    row.addEventListener('click', () => {
      closeOtherLibrary();
      coachStartFree(row.dataset.workout);
    });
  });

  // ── FRIENDS TAB (W3) ──
  // Invite: the system share sheet when there is one, otherwise a clipboard
  // copy. If the sheet fails for any reason other than the user closing it
  // (AbortError), the copy runs instead. The toast only fires after the copy
  // succeeded, and no promo code is ever printed or shared.
  const copyInvite = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(INVITE_TEXT)
        .then(() => showToast('Invite copied. Paste it to a friend.'))
        .catch(() => showToast("Couldn't copy the invite. Try again."));
    } else {
      showToast("Couldn't copy the invite. Try again.");
    }
  };
  document.getElementById('share-code-btn').addEventListener('click', () => {
    if (navigator.share) {
      navigator.share({ text: INVITE_TEXT }).catch((err) => {
        if (err && err.name === 'AbortError') return; // user closed the sheet - nothing to report
        copyInvite();
      });
      return;
    }
    copyInvite();
  });

  // ── SETTINGS SHEET ──
  document.getElementById('settings-overlay').addEventListener('click', closeSettings);
  // W6 (WV-22, WF-11) - close button, Escape and drag-to-dismiss on every sheet
  registerSheet('settings-sheet', closeSettings);
  registerSheet('other-sheet', closeOtherLibrary);
  registerSheet('apps-sheet', closeAppsSheet);
  // W5 - apps sheet opened from the "Add apps" tile on Today
  document.getElementById('apps-overlay').addEventListener('click', closeAppsSheet);
  document.getElementById('apps-sheet-done').addEventListener('click', closeAppsSheet);
  // W5 - the off-state shield pill (no app picked) opens the same picker.
  const shieldPill = document.getElementById('shield-status-pill');
  if (shieldPill) {
    shieldPill.addEventListener('click', () => { if (!isTrackingApps()) openAppsSheet(); });
    shieldPill.addEventListener('keydown', (e) => {
      if (isTrackingApps()) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAppsSheet(); }
    });
  }

  // item 5 - Account section: nickname edit, sign out, delete account.
  const settingsNicknameInput = document.getElementById('settings-nickname-input');
  if (settingsNicknameInput) {
    settingsNicknameInput.addEventListener('change', () => {
      const nickname = validateNickname(settingsNicknameInput.value);
      if (!nickname) {
        settingsNicknameInput.value = state.userName || '';
        showToast('Enter a nickname, 2 to 20 characters.');
        return;
      }
      state.userName = nickname;
      updateGreeting();
      saveState();
      showToast('Nickname updated');
    });
  }

  document.getElementById('settings-signout-btn').addEventListener('click', () => {
    showConfirm(
      'Sign out?',
      "Your plan and history stay on this device.",
      signOutAccount,
      'Sign Out'
    );
  });

  document.getElementById('settings-delete-account-btn').addEventListener('click', () => {
    showConfirm(
      'Delete account?',
      "This permanently deletes your saved plan, streaks, and history from this device. This can't be undone.",
      deleteAccount,
      'Delete'
    );
  });

  document.getElementById('confirm-cancel-btn').addEventListener('click', hideConfirm);
  document.getElementById('confirm-ok-btn').addEventListener('click', () => {
    const cb = confirmCallback;
    hideConfirm();
    if (cb) cb();
  });

  // A1 - steppers write straight to state; openSettings() re-syncs the display.
  document.getElementById('allow-dec').addEventListener('click', () => {
    if (state.dailyAllowanceMinutes > ALLOWANCE_MIN) applyAllowanceChange(clampAllowance(state.dailyAllowanceMinutes - ALLOWANCE_STEP));
  });
  document.getElementById('allow-inc').addEventListener('click', () => {
    if (state.dailyAllowanceMinutes < ALLOWANCE_MAX) applyAllowanceChange(clampAllowance(state.dailyAllowanceMinutes + ALLOWANCE_STEP));
  });
  // WONB - daily movement goal in Settings: same steps and range as setup.
  document.getElementById('goal-set-dec').addEventListener('click', () => {
    if (state.workoutGoalMin > WORKOUT_GOAL_MIN) setWorkoutGoal(state.workoutGoalMin - WORKOUT_GOAL_STEP);
  });
  document.getElementById('goal-set-inc').addEventListener('click', () => {
    if (state.workoutGoalMin < WORKOUT_GOAL_MAX) setWorkoutGoal(state.workoutGoalMin + WORKOUT_GOAL_STEP);
  });
  // WF-23 - expiry toggle in Settings, same state as the onboarding toggle.
  const settingsExpiresToggle = document.getElementById('settings-expires-toggle');
  if (settingsExpiresToggle) {
    settingsExpiresToggle.addEventListener('change', () => {
      state.expiresAtMidnight = settingsExpiresToggle.checked;
      updateRingCaption();
      saveState();
    });
  }
  // fix 6 - single earn-rate control: same segmented buttons as onboarding,
  // reused inside Settings. Writes state and persists; the live workout
  // timer (item 3b) picks up the new multiplier on its next tick.
  document.querySelectorAll('#settings-earn-rate-ctrl .earn-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#settings-earn-rate-ctrl .earn-rate-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.earnRateMultiplier = parseFloat(btn.dataset.rate);
      updateEarnRateNote();
      renderWorkoutGoal(); // WONB
      saveState();
    });
  });

  document.getElementById('settings-widget-btn').addEventListener('click', () => {
    closeSettings();
    showLockScreen();
  });

  document.getElementById('settings-share-btn').addEventListener('click', () => {
    closeSettings();
    showShareScreen();
  });

  // W6 (WV-22) - Replay wipes everything on this device, so it asks first,
  // through the same confirm dialog as Delete account.
  document.getElementById('replay-demo-btn').addEventListener('click', () => {
    showConfirm('Replay the demo?', 'This clears everything on this device.', replayDemo, 'Replay');
  });

  // ── LOCK SCREEN ──
  document.getElementById('lockscreen-screen').addEventListener('click', hideLockScreen);

  // ── SHARE SCREEN (B5, item 3) ──
  document.getElementById('share-save-btn').addEventListener('click', saveShareImage);

  // item 3 - real clipboard copy of the generated PNG. Feature-detected: if
  // the platform can't actually write an image to the clipboard, the button
  // stays hidden rather than showing something that would just fail.
  const shareCopyBtn = document.getElementById('share-copy-btn');
  if (shareCopyBtn) {
    const clipboardImageSupported = !!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write);
    if (clipboardImageSupported) {
      shareCopyBtn.style.display = 'block';
      shareCopyBtn.addEventListener('click', copyShareImage);
    }
  }

  document.getElementById('share-close-btn').addEventListener('click', hideShareScreen);

});

// item 2b/2c - since nothing decays on a real-time interval anymore, repaint
// the Today hero (and resolve any pending app-session whose time has genuinely
// elapsed) whenever the page regains focus, e.g. a real background/
// foreground cycle on a phone.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (ensureCurrentDay()) return; // WF-03 - the rollover repainted everything already
  maybeAutoResolvePendingSession();
  updateRingDisplay();
  if (state.currentTab === 'today') refreshTodayNumbers();
});

// ===== FRIENDS TAB - PARTNER (W3) =====
// Sarah is a labeled sample partner. She never sends anything on her own:
// the only thing she does is answer an unlock request the user starts from
// the Time's up screen. Her card reads the persisted counter, so it is right
// after a reload and clears with the daily reset.
const INVITE_TEXT = "I'm using Balance to earn my scroll time with real workouts. Get on it so we can hold each other to it - it's in beta on TestFlight, ask me for an invite.";

function renderSarahStatus() {
  const el = document.getElementById('partner-status');
  if (!el) return;
  el.textContent = state.unlockMinutesToday > 0
    ? `Sarah unlocked ${state.unlockMinutesToday} min for you today`
    : 'Replies when you ask for an unlock';
}

// ===== INTERCEPT EXERCISE FLOW =====
function startInterceptExercise(mins, exercise, baseMins) {
  const gen = interceptGen; // WF-07 - closing the intercept cancels the credit below
  const options = document.getElementById('intercept-options');
  const tracking = document.getElementById('tracking-state');
  const success = document.getElementById('intercept-success');
  const optionsLabel = document.querySelector('.intercept-options-label');

  if (options) options.style.display = 'none';
  if (optionsLabel) optionsLabel.style.display = 'none';
  if (tracking) tracking.style.display = 'block';
  setInterceptSlot('none');

  setTimeout(() => {
    if (gen !== interceptGen) return;
    if (tracking) tracking.style.display = 'none';
    if (success) {
      success.style.display = 'block';
      setTextContent('success-mins', `+${mins} minutes earned!`);

      // Animate ring refill
      animateSuccessRing();
    }

    // Add minutes
    addEarnedMinutes(mins);
    const label = EXERCISE_LABELS[exercise] || 'Workout';
    state.lastWorkout = { name: label, mins, at: Date.now(), done: true }; // B6, WC-18

    // sweep (fix 13) - intercept exercises count toward Earned Today, same
    // as Quick-log workouts, so they can't disagree.
    state.worktimeLoggedToday.push({ label, mins: baseMins, earned: mins });
    updateHeroScale(); // WHERO - the movement minutes changed after addEarnedMinutes repainted
    renderEarnedList();

    saveState();
    launchConfetti();

    setTimeout(() => {
      if (gen !== interceptGen) return;
      hideIntercept();
      const expiryText = state.expiresAtMidnight ? 'resets at midnight' : 'rolls over tomorrow';
      showToast(`Nice work! +${mins} min added, ${expiryText}.`);
      // Restore options for next time
      if (options) options.style.display = 'flex';
      if (optionsLabel) optionsLabel.style.display = 'block';
      if (success) success.style.display = 'none';
      setInterceptSlot('ask');
    }, 2000);
  }, 2000);
}

function animateSuccessRing() {
  const arc = document.getElementById('success-ring-arc');
  if (!arc) return;
  const pct = state.remainingSeconds / state.totalSeconds;
  const circumference = 201;
  const offset = circumference - (pct * circumference);
  arc.style.transition = 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)';
  arc.setAttribute('stroke-dashoffset', offset.toFixed(2));
}

// ===== LOCK SCREEN =====
function showLockScreen() {
  showOverlay('lockscreen-screen');
  updateLockScreenWidgets();
  startLiveClock();
  startLaElapsed();
}

function hideLockScreen() {
  hideOverlay('lockscreen-screen');
  stopLiveClock();
  stopLaElapsed();
}

// ===== SHARE SCREEN (B5) =====

// W5 (WF-13, WV-06, WV-07, WC-17) - the card is built from today's real
// state only: minutes earned today, workouts logged today, the streak. No app
// name (the demo never knows a per-app split) and no sample week. The ring on
// screen and the exported PNG share one fraction: minutes earned today as a
// share of today's whole budget.
function getShareStats() {
  const minutes = Math.max(0, Math.round(state.earnedMinutes));
  const workouts = state.worktimeLoggedToday.length;
  const total = dayTotalMinutes();
  const pct = total > 0 ? Math.min(1, Math.max(0, minutes / total)) : 0;
  const arcPct = Math.max(0.02, pct); // a hairline arc even on an empty day, same on both surfaces
  return { minutes, workouts, streak: state.streakDays, pct, arcPct };
}

// WFIX item 2 - under 90 minutes in whole minutes ("61 min", never "1.0
// hours"); from 90 on in hours with at most one decimal and no trailing ".0"
// ("1.5 hours", "2 hours", "2.5 hours").
function shareDurationLabel(mins) {
  if (mins < 90) return `${mins} min`;
  const hours = Math.round(mins / 6) / 10;
  const label = Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
  return `${label} hours`;
}

function shareWorkoutsLabel(n) {
  return `${n} ${n === 1 ? 'workout' : 'workouts'}`;
}

// Plain-text headline shared by the PNG and the share sheet. With no workout
// yet today the card falls back to the streak line (WV-07). WFIX item 2 - a
// streak of 0 never prints "0-day": the card uses a neutral line with no
// number in it (with or without a workout today), and the streak row is left
// off the card and the image.
const SHARE_NEUTRAL_HEADLINE = "I'm trading scroll time for movement";
function shareHeadlineText() {
  const { minutes, workouts, streak } = getShareStats();
  if (streak <= 0) return SHARE_NEUTRAL_HEADLINE;
  if (workouts > 0) return `Today I earned ${shareDurationLabel(minutes)} of scroll time with ${shareWorkoutsLabel(workouts)}`;
  return `I'm on a ${streak}-day streak of scrolling less`;
}

function updateShareCard() {
  const { minutes, workouts, streak, arcPct } = getShareStats();
  const headline = document.getElementById('share-headline');
  if (headline) {
    if (streak <= 0) {
      headline.textContent = SHARE_NEUTRAL_HEADLINE;
    } else if (workouts > 0) {
      headline.innerHTML = `Today I earned <span class="share-highlight">${shareDurationLabel(minutes)}</span> of scroll time with ${shareWorkoutsLabel(workouts)}`;
    } else {
      headline.innerHTML = `I'm on a <b>${streak}-day streak</b><br>of scrolling less`;
    }
  }
  const shareStreak = document.getElementById('share-streak');
  if (shareStreak) {
    shareStreak.innerHTML = streak > 0 ? `${iconHTML('i-flame', 'icon-20')}${streak}-day streak` : '';
    shareStreak.style.display = streak > 0 ? '' : 'none';
  }
  const arc = document.getElementById('share-ring-arc');
  if (arc) arc.setAttribute('stroke-dashoffset', (264 * (1 - arcPct)).toFixed(1));
}

function showShareScreen() {
  updateShareCard();
  showOverlay('share-screen');
}

function hideShareScreen() {
  hideOverlay('share-screen');
}

// ---- Canvas rendering helpers for the real "Save image" export (b) ----
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapCenteredText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach(word => {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line.trim());
      line = word + ' ';
    } else {
      line = test;
    }
  });
  lines.push(line.trim());
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

function renderShareCanvas() {
  const { streak, arcPct } = getShareStats();
  // WHERO item 8i - with no streak line (streak 0) the image is 180px shorter,
  // the way the on-screen card closes up: the ring and the headline keep their
  // places and the footer comes up, so no empty band is left above it.
  const W = 600, H = streak > 0 ? 750 : 570;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background gradient card (approximates .share-card)
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0f0c29');
  bg.addColorStop(0.5, '#302b63');
  bg.addColorStop(1, '#24243e');
  ctx.fillStyle = bg;
  roundRectPath(ctx, 0, 0, W, H, 40);
  ctx.fill();

  // Ring arc (approximates .share-ring)
  const cx = W / 2, cy = 190, r = 90;
  ctx.lineWidth = 16;
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.addColorStop(0, '#6366F1');
  ringGrad.addColorStop(0.5, '#A855F7');
  ringGrad.addColorStop(1, '#2DD4BF');
  ctx.strokeStyle = ringGrad;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + arcPct * Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';

  // Headline - the same text as the on-screen card, built by shareHeadlineText()
  ctx.fillStyle = '#fff';
  ctx.font = '700 30px -apple-system, BlinkMacSystemFont, sans-serif';
  wrapCenteredText(ctx, shareHeadlineText(), cx, 360, 480, 40);

  // Streak (no emoji glyphs on the exported image; the SAMPLE / roadmap
  // caption lives outside the card and is never drawn here)
  ctx.font = '700 28px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#F59E0B';
  if (streak > 0) ctx.fillText(`${streak}-day streak`, cx, 560); // WFIX item 2 - never "0-day streak"

  // Footer
  ctx.font = '400 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('balance · move to scroll', cx, H - 50);

  return canvas;
}

// (b)+(d) Save image - real PNG export, with native share when available.
// WC-19 - "Saved!" only after the download click actually ran (or "Shared!"
// after the share sheet resolved). Every failure path says so instead, and
// points to Copy image only when that button is actually on screen.
function shareFailureMessage() {
  const copyBtn = document.getElementById('share-copy-btn');
  const copyVisible = !!(copyBtn && copyBtn.style.display !== 'none' && copyBtn.offsetParent !== null);
  return "Couldn't save image" + (copyVisible ? ' - try Copy image' : '');
}

function saveShareImage() {
  try {
    const canvas = renderShareCanvas();
    canvas.toBlob((blob) => {
      if (!blob) { showToast(shareFailureMessage()); return; }

      if (navigator.share && typeof navigator.canShare === 'function') {
        try {
          const file = new File([blob], 'balance-today.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({
              files: [file],
              title: 'Balance',
              text: `${shareHeadlineText()} - Balance`,
            }).then(() => showToast('Shared!')).catch((err) => {
              if (err && err.name === 'AbortError') return; // user closed the sheet - nothing to report
              showToast(shareFailureMessage());
            });
            return;
          }
        } catch (e) { /* fall through to download */ }
      }

      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'balance-today.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast('Saved!');
      } catch (e) {
        showToast(shareFailureMessage());
      }
    }, 'image/png');
  } catch (e) {
    showToast(shareFailureMessage());
  }
}

// item 3 - real clipboard copy of the same generated PNG. Only wired up
// when window.ClipboardItem / navigator.clipboard.write actually exist
// (see the feature-detect at the button's init above).
function copyShareImage() {
  try {
    const canvas = renderShareCanvas();
    canvas.toBlob((blob) => {
      if (!blob) { showToast('Copy failed - try Save image instead'); return; }
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(() => showToast('Copied - paste it anywhere'))
        .catch(() => showToast('Copy failed - try Save image instead'));
    }, 'image/png');
  } catch (e) {
    showToast('Copy failed - try Save image instead');
  }
}
