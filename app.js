/* ============================================================
   BALANCE APP — app.js
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
  isPlaying: false,
  currentTab: 'today',
  dailyHours: 3.5,
  actualDailyHours: null,
  earnRateMultiplier: 1,
  expiresAtMidnight: true,
  healthConnected: null,
  promoUsed: false,
  userName: '',
  lastWorkout: null,                 // { name, mins, at } — for honest Live Activity (B6)
  paywallYears: null,                // computed during onboarding step C, shown on paywall (B4)
  worktimeLoggedToday: [],
  stepsToday: 0,                     // real steps, driven by logged workouts (fix 9)
  stepBonusTomorrow: false,          // set true when stepsToday crosses 8,000 (fix 9)
};

const APP_ICONS = {
  Instagram: { bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', emoji: '📸' },
  TikTok:    { bg: '#010101', emoji: '🎵' },
  X:         { bg: '#000', emoji: '✖' },
  YouTube:   { bg: '#FF0000', emoji: '▶' },
  Snapchat:  { bg: '#FFFC00', emoji: '👻', textColor: '#000' },
  Reddit:    { bg: '#FF4500', emoji: '👾' },
};

const EXERCISE_LABELS = { walk: 'Walk', workout: 'Workout', stretch: 'Stretch' };
const ONE_HOUR_MS = 60 * 60 * 1000;

// Toasts queued from a daily-reset (streak-shield save, steps bonus), shown
// once the app shell is ready.
let pendingToastMessages = [];

// Earn-tab quick-log selection (module scope so the settings-sheet earn-rate
// control can also refresh the preview — A1, A6, fix 6).
let selectedWorkout = null;
let selectedDuration = 20;

function updateDpEarnPreview() {
  setTextContent('dp-earn-preview', Math.round(selectedDuration * state.earnRateMultiplier));
}

// ===== COUNTDOWN TIMER =====
let countdownInterval = null;
let widgetInterval = null;
let laElapsedInterval = null;
let interceptWasPlaying = false; // A3 — remember play state so hideIntercept doesn't force-resume

function startCountdown() {
  if (countdownInterval) return;
  countdownInterval = setInterval(() => {
    if (!state.isPlaying) return;
    if (state.remainingSeconds > 0) {
      state.remainingSeconds--;
      updateRingDisplay();
    } else {
      // Time's up — show intercept
      pauseCountdown();
      renderAppTiles(); // fix 5 — lock badges appear the instant time actually hits 0
      showIntercept(state.selectedApps[0] || 'TikTok');
    }
  }, 1000);
}

function pauseCountdown() {
  state.isPlaying = false;
  updatePlayPause();
}

function resumeCountdown() {
  state.isPlaying = true;
  updatePlayPause();
}

function updatePlayPause() {
  const btn = document.getElementById('play-pause-btn');
  if (btn) btn.textContent = state.isPlaying ? '⏸ Stop simulation' : '▶ Demo: simulate scrolling';
}

// ===== RING DISPLAY =====
function updateRingDisplay() {
  const remaining = state.remainingSeconds;
  const total = state.totalSeconds;
  const pct = total > 0 ? remaining / total : 0;

  // Countdown text - format based on isPlaying
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  let timeStr, labelStr;
  if (state.isPlaying) {
    timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    labelStr = 'remaining';
  } else {
    timeStr = `${mins} min`;
    labelStr = 'left today';
  }
  setTextContent('ring-countdown', timeStr);
  setTextContent('ring-label-sm', labelStr);

  // Hero arc
  const arc = document.getElementById('hero-ring-arc');
  if (arc) {
    const circumference = 628; // 2*pi*100
    const offset = circumference - (pct * circumference);
    arc.setAttribute('stroke-dashoffset', offset.toFixed(2));

    // Color based on pct
    if (pct > 0.5) {
      arc.setAttribute('stroke', 'url(#hero-grad-mint)');
    } else if (pct > 0.2) {
      arc.setAttribute('stroke', 'url(#hero-grad-amber)');
    } else {
      arc.setAttribute('stroke', 'url(#hero-grad-red)');
    }
  }

  // Earn mini ring
  updateEarnMiniRing(pct);

  // Lock screen ring
  updateLockScreenWidgets();
}

function updateEarnMiniRing(pct) {
  const arc = document.getElementById('earn-mini-arc');
  if (!arc) return;
  const circumference = 150;
  const offset = circumference - (pct * circumference);
  arc.setAttribute('stroke-dashoffset', offset.toFixed(2));
}

function getMinutesStr(seconds) {
  return Math.ceil(seconds / 60);
}

// ===== LOCK SCREEN WIDGETS =====
function updateLockScreenWidgets() {
  const mins = Math.ceil(state.remainingSeconds / 60);
  const total = Math.ceil(state.totalSeconds / 60);
  const pct = total > 0 ? mins / total : 0;

  // Label
  setTextContent('ls-ring-label', `${mins}m`);
  setTextContent('ls-wr-mid', `${mins} min left · 🔥${state.streakDays}`);

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

// Live Activity — honest version (B6, fix 10): only shows if a workout was
// logged < 60 min ago, and the progress denominator is the ACTUAL logged
// workout's duration (not a fixed 30-min guess), so it always hits 100% when
// the workout is really done.
function updateLiveActivityCard() {
  const card = document.getElementById('ls-live-activity');
  if (!card) return;
  if (!state.lastWorkout || (Date.now() - state.lastWorkout.at) >= ONE_HOUR_MS) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';
  const elapsedSec = Math.max(0, Math.floor((Date.now() - state.lastWorkout.at) / 1000));
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  const durationSec = Math.max(1, state.lastWorkout.mins * 60);
  const done = elapsedSec >= durationSec;
  setTextContent('la-title', done ? `${state.lastWorkout.name} done ✓` : `${state.lastWorkout.name} in progress`);
  setTextContent('la-mins-earned', state.lastWorkout.mins);
  setTextContent('la-elapsed', `${m}:${s.toString().padStart(2, '0')}`);
  const fill = document.getElementById('la-progress-fill');
  if (fill) {
    const pct = Math.min((elapsedSec / durationSec) * 100, 100);
    fill.style.width = `${pct.toFixed(1)}%`;
  }
  const badge = document.querySelector('.la-badge');
  if (badge) badge.classList.toggle('la-badge-done', done);
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

function showScreen(id) {
  const prev = document.getElementById(currentScreen);
  const next = document.getElementById(id);
  if (!next) return;

  if (prev && prev !== next) {
    prev.classList.remove('active');
    prev.classList.add('slide-out');
    setTimeout(() => prev.classList.remove('slide-out'), 400);
  }

  next.classList.add('active');
  currentScreen = id;
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
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const pane = document.getElementById(`tab-${tabName}`);
  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (pane) pane.classList.add('active');
  if (btn) btn.classList.add('active');

  state.currentTab = tabName;

  if (tabName === 'earn') {
    requestAnimationFrame(() => renderEarnAnalytics(currentEarnRange));
  } else if (tabName === 'today') {
    refreshTodayNumbers();
  } else if (tabName === 'friends') {
    updateStreakDuel(); // fix 2 — recompute whenever Friends tab is shown
    renderSarahStatus();
  }
}

// ===== ONBOARDING =====
let currentObStep = 'ob-step-a';

function showObStep(id) {
  const prev = document.getElementById(currentObStep);
  const next = document.getElementById(id);
  if (prev) {
    prev.classList.remove('active');
    prev.style.transform = 'translateX(-30px)';
    prev.style.opacity = '0';
    setTimeout(() => {
      prev.style.transform = '';
      prev.style.opacity = '';
    }, 350);
  }
  if (next) {
    next.style.transform = 'translateX(30px)';
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
}

function initOnboardingStepC() {
  const computingState = document.getElementById('computing-state');
  const shockState = document.getElementById('shock-state');
  if (computingState) computingState.style.display = 'flex';
  if (shockState) shockState.style.display = 'none';

  // Compute years
  const hours = state.actualDailyHours !== null ? state.actualDailyHours : state.dailyHours;
  const yearsRemaining = 50;
  const wakingHoursPerDay = 16;
  const years = (hours / wakingHoursPerDay) * yearsRemaining;
  const yearsStr = years.toFixed(1);
  state.paywallYears = years; // B4 — reused on the paywall's personalized line

  const leadText = document.getElementById('shock-lead-text');
  const yearsEl = document.getElementById('shock-years');
  const mintEl = document.getElementById('shock-mint');

  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const timeLabel = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  if (leadText) leadText.textContent = state.actualDailyHours !== null
    ? `At ${timeLabel} a day (your real average), you will spend`
    : `At ${timeLabel} a day, you will spend`;
  if (yearsEl) yearsEl.textContent = `${yearsStr} years`;

  // Show computing for 1.5s
  setTimeout(() => {
    if (computingState) computingState.style.display = 'none';
    if (shockState) shockState.style.display = 'flex';
    // After 1s, show mint line
    setTimeout(() => {
      if (mintEl) mintEl.classList.add('visible');
    }, 1000);
  }, 1500);
}

// ===== PAYWALL =====
const PROMO_CODES = ['FRIENDS', 'BETA', 'BLAKE'];

function handlePromoCode() {
  const input = document.getElementById('promo-input');
  const errorEl = document.getElementById('promo-error');
  if (!input) return;

  const code = input.value.trim().toUpperCase();
  if (PROMO_CODES.includes(code)) {
    // Valid code
    launchConfetti();
    showToast('Beta access unlocked — free forever 🎉');
    setTimeout(() => proceedToApp(), 1500);
    if (errorEl) errorEl.style.display = 'none';
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
  // at Day 1 with 0 minutes earned — the seed demo values are for the
  // pre-onboarding splash/demo state only.
  state.streakDays = 1;
  state.streakShields = 0;
  state.earnedMinutes = 0;
  state.worktimeLoggedToday = [];
  localStorage.setItem('balance_onboarded', '1');
  showScreen('app-shell');
  state.remainingSeconds = state.dailyAllowanceMinutes * 60;
  state.totalSeconds = (state.dailyAllowanceMinutes + state.earnedMinutes) * 60;
  renderEarnedList();
  renderAppTiles();
  buildWeekChart();
  updateLeaderboard();
  updateBonusCard();
  updateRingDisplay();
  updatePlayPause();
  updateHealthBadge();
  startCountdown();
  updateDateLabel();
  updateGreeting();
  updateAllStreakDisplays();
  updateStreakDuel();
  updateShieldChip();
  updateRingCaption();
  setTextContent('earn-today-display', state.earnedMinutes);
  renderEarnAnalytics('month');
  saveState();
}

// ===== NUMBERS ENGINE (A8) =====
// Single source of truth: minutes used today derives from the ring's own numbers.
function getUsedMinutesToday() {
  return Math.max(0, Math.round((state.totalSeconds - state.remainingSeconds) / 60));
}

// Split "used minutes" across selected apps with fixed weights so the tiles
// can never silently disagree with the ring: first app 55%, second 30%,
// remaining apps split the rest evenly; round, then true up the first tile.
function computeAppMinutes(apps, usedMinutes) {
  const n = apps.length;
  if (n === 0) return [];
  let weights;
  if (n === 1) weights = [1];
  else if (n === 2) weights = [0.55, 0.45];
  else weights = [0.55, 0.30, ...Array(n - 2).fill(0.15 / (n - 2))];

  const mins = weights.map(w => Math.round(w * usedMinutes));
  const sum = mins.reduce((a, b) => a + b, 0);
  mins[0] += (usedMinutes - sum);
  return mins;
}

// ===== APP TILES =====
function renderAppTiles() {
  const container = document.getElementById('app-tiles-row');
  if (!container) return;
  container.innerHTML = '';

  const apps = state.selectedApps.length > 0 ? state.selectedApps : ['TikTok', 'Instagram', 'YouTube'];
  const usedMinutes = getUsedMinutesToday();
  const appMins = computeAppMinutes(apps, usedMinutes);

  apps.forEach((appName, i) => {
    const info = APP_ICONS[appName] || { bg: '#333', emoji: '📱' };
    const used = appMins[i] || 0;
    const isLocked = state.remainingSeconds === 0; // fix 5 — truthful: only when time is actually up

    const tile = document.createElement('button');
    tile.className = 'app-used-tile';
    tile.setAttribute('data-app', appName);
    tile.innerHTML = `
      <div class="app-used-icon" style="background:${info.bg};color:${info.textColor||'#fff'}">${info.emoji}</div>
      <span class="app-used-name">${appName}</span>
      <span class="app-used-mins">${used}m</span>
      ${isLocked ? '<span class="lock-badge">🔒</span>' : ''}
    `;
    // B1 — breathing pause before opening an app with time remaining; straight
    // to the intercept only once time is actually gone.
    tile.addEventListener('click', () => {
      if (state.remainingSeconds <= 0) {
        showIntercept(appName);
      } else {
        showBreathingPause(appName);
      }
    });
    container.appendChild(tile);
  });
}

// ===== WEEKLY CHART =====
// The 6 historical days stay hardcoded for the demo; today's bar is always
// the real, live "used minutes" / earned minutes so it can never disagree
// with the ring (A8).
const WEEK_SOCIAL_HISTORICAL = [42, 38, 45, 29, 45, 22, 31];
const WEEK_EARNED_HISTORICAL = [8, 12, 0, 15, 5, 20, 12];
const WEEK_TODAY_IDX = 6;

function getWeekSeries() {
  const social = WEEK_SOCIAL_HISTORICAL.slice();
  const earned = WEEK_EARNED_HISTORICAL.slice();
  social[WEEK_TODAY_IDX] = getUsedMinutesToday();
  earned[WEEK_TODAY_IDX] = state.earnedMinutes;
  return { social, earned };
}

// fix 7 — two slim side-by-side bars per day (social=mint, earned=amber),
// a dashed reference line at the user's daily allowance, and a tiny mint ✓
// on days that stayed under it. Today uses live numbers; the other 6 days
// are labeled sample history so the fake part is honest about being fake.
function buildWeekChart() {
  const chart = document.getElementById('week-chart');
  if (!chart) return;
  chart.innerHTML = '';

  const days = ['M','T','W','T','F','S','S'];
  const { social, earned } = getWeekSeries();
  const todayIdx = WEEK_TODAY_IDX;
  const allowance = state.dailyAllowanceMinutes;
  const scaleMax = Math.max(Math.max(...social), allowance) * 1.15;
  const goalPct = Math.min(100, (allowance / scaleMax) * 100);

  const barsRow = document.createElement('div');
  barsRow.className = 'week-bars-row';
  const labelsRow = document.createElement('div');
  labelsRow.className = 'week-labels-row';

  days.forEach((day, i) => {
    const socialPct = Math.min(100, (social[i] / scaleMax) * 100);
    const earnedPct = Math.min(100, (earned[i] / scaleMax) * 100);
    const isToday = i === todayIdx;
    const underAllowance = social[i] <= allowance;

    const wrap = document.createElement('div');
    wrap.className = 'chart-bar-wrap';
    wrap.innerHTML = `
      <div class="chart-bar-bg">
        <div class="chart-bar-col">
          ${isToday ? `<span class="chart-bar-value">${social[i]}</span>` : ''}
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
      <span class="chart-day-check"${underAllowance ? '' : ' style="visibility:hidden"'}>✓</span>
    `;
    labelsRow.appendChild(labelCol);
  });

  const goalLine = document.createElement('div');
  goalLine.className = 'chart-goal-line';
  goalLine.style.bottom = `${goalPct}%`;
  goalLine.innerHTML = `<span class="chart-goal-label">${allowance} min goal</span>`;
  barsRow.appendChild(goalLine);

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
    }, 100);
  });
}

function formatHM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ===== LEADERBOARD (A8) =====
// "You" row is computed from the same week series as the chart, so the
// leaderboard and the "behind/ahead" line can never disagree with reality.
function updateLeaderboard() {
  const card = document.getElementById('leaderboard-card');
  if (!card) return;

  const { social } = getWeekSeries();
  const youMins = social.reduce((a, b) => a + b, 0);

  const others = [
    { name: 'Lauren', mins: 134, avatar: 'linear-gradient(135deg,#A855F7,#6366F1)', initial: 'L' },
    { name: 'Jake', mins: 352, avatar: 'linear-gradient(135deg,#F59E0B,#F87171)', initial: 'J' },
    { name: 'Marcus', mins: 381, avatar: 'linear-gradient(135deg,#6366F1,#A855F7)', initial: 'M' },
  ];
  const rows = [...others, { name: 'You', mins: youMins, avatar: 'linear-gradient(135deg,#2DD4BF,#34D399)', initial: 'B', isYou: true }];
  rows.sort((a, b) => a.mins - b.mins);

  const rowsHtml = rows.map((r, i) => {
    const rankHtml = i === 0
      ? `<span class="lb-rank trophy">🏆</span>`
      : `<span class="lb-rank${r.isYou ? ' you-rank' : ''}">${i + 1}</span>`;
    return `
      <div class="lb-row${r.isYou ? ' you-row' : ''}">
        ${rankHtml}
        <div class="lb-avatar" style="background:${r.avatar}">${r.initial}</div>
        <span class="lb-name">${r.name}</span>
        <span class="lb-mins">${formatHM(r.mins)}</span>
      </div>`;
  }).join('');

  const youIndex = rows.findIndex(r => r.isYou);
  let behindText = '';
  if (youIndex === rows.length - 1) {
    const prev = rows[youIndex - 1];
    if (prev) behindText = `${formatHM(rows[youIndex].mins - prev.mins)} behind ${prev.name}`;
  } else {
    const next = rows[youIndex + 1];
    if (next) behindText = `${formatHM(next.mins - rows[youIndex].mins)} ahead of ${next.name}`;
  }

  card.innerHTML = rowsHtml + `<div class="lb-behind" id="lb-behind">${behindText}</div>`;
}

// ===== BONUS CARD (fix 9) =====
// state.stepsToday is real — it's incremented every time a workout is logged
// (Quick log or an intercept exercise). Bar width is derived from the same
// number shown in the label, in one place, so they can never disagree.
const STEPS_GOAL = 8000;
const STEP_RATE_OVERRIDES = { Walk: 100, Run: 170, Cycle: 60 }; // steps/min; everything else is 40/min

function stepsForWorkout(name, mins) {
  const rate = STEP_RATE_OVERRIDES[name] || 40;
  return Math.round(rate * mins);
}

function bonusCardDefaultHTML() {
  return `
      <div class="bonus-row">
        <span class="bonus-icon">🚶</span>
        <div class="bonus-text">
          <div class="bonus-title-row">
            <div class="bonus-title">Hit 8,000 steps today</div>
          </div>
          <div class="bonus-sub">+10 min tomorrow</div>
        </div>
        <span class="bonus-reward">+10m</span>
      </div>
      <div class="bonus-progress-wrap">
        <div class="bonus-progress-bar" id="bonus-progress-bar" style="width:0%"></div>
      </div>
      <div class="bonus-prog-label" id="bonus-prog-label">0 / 8,000 steps</div>`;
}

function bonusCardAchievedHTML() {
  return `
      <div class="bonus-row bonus-achieved-row">
        <span class="bonus-icon">🎉</span>
        <div class="bonus-text">
          <div class="bonus-title">Goal hit! +10 min added to tomorrow 🎉</div>
        </div>
      </div>`;
}

function updateBonusCard() {
  const card = document.querySelector('.bonus-card');
  if (!card) return;
  const achieved = state.stepsToday >= STEPS_GOAL;

  if (achieved) {
    if (!card.classList.contains('achieved')) {
      card.classList.add('achieved');
      card.innerHTML = bonusCardAchievedHTML();
    }
    return;
  }

  if (card.classList.contains('achieved')) {
    card.classList.remove('achieved');
    card.innerHTML = bonusCardDefaultHTML();
  }

  const pct = Math.min(100, (state.stepsToday / STEPS_GOAL) * 100);
  const bar = document.getElementById('bonus-progress-bar');
  if (bar) bar.style.width = `${pct.toFixed(1)}%`;
  setTextContent('bonus-prog-label', `${state.stepsToday.toLocaleString()} / ${STEPS_GOAL.toLocaleString()} steps`);
}

// ===== EARNED TODAY LIST (fix 3) =====
// Single source of truth: state.worktimeLoggedToday. Rebuilt from state (not
// appended DOM-only) so a page reload always reflects reality, and an empty
// day shows an honest empty state instead of a phantom seeded entry.
function renderEarnedList() {
  const list = document.getElementById('earned-list');
  if (!list) return;
  list.innerHTML = '';

  if (state.worktimeLoggedToday.length === 0) {
    list.innerHTML = `<div class="earned-empty" id="earned-empty">Nothing yet today — log a workout to earn time.</div>`;
    return;
  }

  state.worktimeLoggedToday.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'earned-item';
    item.innerHTML = `
      <span class="earned-icon">💪</span>
      <span class="earned-label">${entry.label}</span>
      <span class="earned-mins">+${entry.earned} min</span>
    `;
    list.appendChild(item);
  });
}

// Cheap, event-driven refresh of everything derived from "used minutes today" (A8).
function refreshTodayNumbers() {
  renderAppTiles();
  buildWeekChart();
  updateLeaderboard();
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

function showIntercept(appName) {
  interceptWasPlaying = state.isPlaying; // A3 — don't force-resume on close
  pauseCountdown();
  interceptAskCount = 0; // B3 — fresh ask count each time the intercept opens

  const info = APP_ICONS[appName] || { emoji: '📱' };
  setTextContent('intercept-app-icon', info.emoji);
  setTextContent('intercept-allowance', state.dailyAllowanceMinutes);
  setTextContent('intercept-title', state.userName ? `Time's up, ${state.userName}.` : `Time's up.`);
  updateInterceptRewards(); // A6 — reward rows reflect the current earn-rate multiplier

  // Reset states
  const options = document.getElementById('intercept-options');
  const optionsLabel = document.querySelector('.intercept-options-label');
  const tracking = document.getElementById('tracking-state');
  const success = document.getElementById('intercept-success');
  const bottom = document.getElementById('intercept-bottom');
  const partnerResp = document.getElementById('partner-response');
  const waiting = document.getElementById('pr-waiting');
  const declined = document.getElementById('pr-declined');
  const approved = document.getElementById('pr-approved');

  if (options) options.style.display = 'flex';
  if (optionsLabel) optionsLabel.style.display = 'block';
  if (tracking) tracking.style.display = 'none';
  if (success) success.style.display = 'none';
  if (bottom) bottom.style.display = 'flex';
  if (partnerResp) partnerResp.style.display = 'none';
  if (waiting) waiting.style.display = 'block';
  if (declined) declined.style.display = 'none';
  if (approved) approved.style.display = 'none';

  showOverlay('intercept-screen');
}

function hideIntercept() {
  hideOverlay('intercept-screen');
  if (interceptWasPlaying) resumeCountdown();
  else updatePlayPause();
}

// A2 — ✕ / "I'll wait until tomorrow" both close without earning, and reset
// the partner-response state so the next open starts clean.
function closeInterceptNoEarn() {
  hideIntercept();
  const bottom = document.getElementById('intercept-bottom');
  const partnerResp = document.getElementById('partner-response');
  if (bottom) bottom.style.display = 'flex';
  if (partnerResp) partnerResp.style.display = 'none';
  interceptAskCount = 0;
}

// B3 — partner approve path: first ask is declined with an "Ask again"
// option; the second ask is approved and awards a flat +10 (not multiplied).
let interceptAskCount = 0;

function askSarah() {
  interceptAskCount++;
  const bottom = document.getElementById('intercept-bottom');
  const resp = document.getElementById('partner-response');
  const waiting = document.getElementById('pr-waiting');
  const declined = document.getElementById('pr-declined');
  const approved = document.getElementById('pr-approved');

  if (bottom) bottom.style.display = 'none';
  if (resp) resp.style.display = 'block';
  if (waiting) waiting.style.display = 'block';
  if (declined) declined.style.display = 'none';
  if (approved) approved.style.display = 'none';

  setTimeout(() => {
    if (waiting) waiting.style.display = 'none';
    if (interceptAskCount === 1) {
      if (declined) declined.style.display = 'block';
    } else {
      if (approved) approved.style.display = 'block';
      addEarnedMinutes(10);
      sarahUnlockedToday = true; // fix 12 — reflected on her Friends-tab status line
      renderSarahStatus();
      launchConfetti();
      setTimeout(() => {
        hideIntercept();
        interceptAskCount = 0;
      }, 1500);
    }
  }, 3000);
}

// B1 — breathing pause overlay shown before opening an app with time left.
let breathingTimer = null;

function showBreathingPause(appName) {
  const info = APP_ICONS[appName] || { emoji: '📱' };
  setTextContent('breathing-app-icon', info.emoji);
  setTextContent('breathing-app-name', appName);
  setTextContent('breathing-open-appname', appName);
  const openBtn = document.getElementById('breathing-open-btn');
  if (openBtn) openBtn.disabled = true;
  showOverlay('breathing-screen');
  if (breathingTimer) clearTimeout(breathingTimer);
  breathingTimer = setTimeout(() => {
    if (openBtn) openBtn.disabled = false;
  }, 4000);
}

function hideBreathingPause() {
  hideOverlay('breathing-screen');
  if (breathingTimer) { clearTimeout(breathingTimer); breathingTimer = null; }
}

// ===== EARN MINUTES (shared logic) =====
function addEarnedMinutes(mins) {
  state.earnedMinutes += mins;
  state.remainingSeconds += mins * 60;
  state.totalSeconds += mins * 60;
  setTextContent('earned-display', state.earnedMinutes);
  setTextContent('earn-today-display', state.earnedMinutes);
  updateRingDisplay();
  refreshTodayNumbers(); // A8 — chart/leaderboard/tiles stay consistent
  saveState(); // A7
}

// ===== CONFETTI =====
function launchConfetti() {
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
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ===== UTIL =====
function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ===== DISPLAY HELPERS (A5, A9, A13, B2) =====

// A5 — ring caption honors the expires-at-midnight toggle.
function updateRingCaption() {
  const caption = document.querySelector('.ring-caption');
  if (!caption) return;
  const expiryText = state.expiresAtMidnight ? 'resets at midnight' : 'rolls over tomorrow';
  caption.innerHTML = `${state.dailyAllowanceMinutes} min allowance + <span id="earned-display">${state.earnedMinutes}</span> min earned · ${expiryText}`;
}

// A9 — time-aware greeting, name only shown if the user gave one.
function getGreeting() {
  const h = new Date().getHours();
  const period = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return state.userName ? `${period}, ${state.userName} 👋` : `${period} 👋`;
}

function updateGreeting() {
  setTextContent('greeting-text', getGreeting());
}

// A13 — "Day 1" reads better than "1 days".
function formatStreakText(n) {
  return n === 1 ? 'Day 1' : `${n} days`;
}

function updateAllStreakDisplays() {
  setTextContent('streak-display', formatStreakText(state.streakDays));
  const duelCount = document.querySelector('.duel-side.you .duel-count');
  if (duelCount) duelCount.textContent = state.streakDays;
}

// B2 — streak-shield chip next to the streak pill.
function updateShieldChip() {
  const chip = document.getElementById('shield-chip');
  if (!chip) return;
  if (state.streakShields > 0) {
    chip.style.display = 'inline-block';
    chip.textContent = `🛡️ ×${state.streakShields}`;
  } else {
    chip.style.display = 'none';
  }
}

// ===== SETTINGS SHEET =====
let settingsOpen = false;

function openSettings() {
  document.getElementById('settings-overlay').style.display = 'block';
  const sheet = document.getElementById('settings-sheet');
  sheet.classList.add('open');
  sheet.style.transform = 'translateY(0)';
  settingsOpen = true;
  // A1 — initialize from state, not stale local vars
  setTextContent('allow-val', `${state.dailyAllowanceMinutes} min`);
  // fix 6 — sync the earn-rate segmented control's selected button from state
  document.querySelectorAll('#settings-earn-rate-ctrl .earn-rate-btn').forEach(b => {
    b.classList.toggle('selected', parseFloat(b.dataset.rate) === state.earnRateMultiplier);
  });
}

// A1 — Daily-allowance stepper: writes state, recomputes total, clamps
// remaining, and keeps every display of it (ring, caption, intercept) in sync.
function applyAllowanceChange(newAllowance) {
  const usedSeconds = state.totalSeconds - state.remainingSeconds;
  state.dailyAllowanceMinutes = newAllowance;
  state.totalSeconds = (state.dailyAllowanceMinutes + state.earnedMinutes) * 60;
  state.remainingSeconds = Math.max(0, Math.min(state.totalSeconds, state.totalSeconds - usedSeconds));
  setTextContent('allow-val', `${state.dailyAllowanceMinutes} min`);
  setTextContent('intercept-allowance', state.dailyAllowanceMinutes);
  updateRingDisplay();
  updateRingCaption();
  refreshTodayNumbers();
  saveState();
}

function closeSettings() {
  document.getElementById('settings-overlay').style.display = 'none';
  const sheet = document.getElementById('settings-sheet');
  sheet.style.transform = 'translateY(100%)';
  sheet.classList.remove('open');
  settingsOpen = false;
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

// Single storage key (A11) — everything lives in balance_state.
function saveState() {
  localStorage.setItem('balance_state', JSON.stringify({
    earnedMinutes: state.earnedMinutes,
    streakDays: state.streakDays,
    streakShields: state.streakShields,
    dailyAllowanceMinutes: state.dailyAllowanceMinutes,
    selectedApps: state.selectedApps,
    healthConnected: state.healthConnected,
    earnRateMultiplier: state.earnRateMultiplier,
    expiresAtMidnight: state.expiresAtMidnight,
    remainingSeconds: state.remainingSeconds,
    userName: state.userName,
    lastWorkout: state.lastWorkout,
    worktimeLoggedToday: state.worktimeLoggedToday,
    stepsToday: state.stepsToday,
    stepBonusTomorrow: state.stepBonusTomorrow,
    savedDate: todayStr(),
  }));
}

// A13 — honest streak growth/decay on a new day, with streak-shield rescue (B2).
function applyDailyReset(prevDateStr, curDateStr) {
  const daysElapsed = daysBetween(prevDateStr, curDateStr);

  const carriedEarned = state.expiresAtMidnight ? 0 : state.earnedMinutes;
  state.earnedMinutes = carriedEarned;
  state.remainingSeconds = (state.dailyAllowanceMinutes + carriedEarned) * 60;
  state.totalSeconds = state.remainingSeconds;
  state.lastWorkout = null;
  state.worktimeLoggedToday = [];

  if (daysElapsed === 1) {
    state.streakDays += 1;
  } else if (daysElapsed > 1) {
    if (state.streakShields > 0) {
      state.streakShields -= 1;
      state.streakDays += 1;
      pendingToastMessages.push(`🛡️ Streak Shield used — ${state.streakDays}-day streak saved!`);
    } else {
      state.streakDays = 1;
    }
  }

  // fix 9 — steps reset every day; yesterday's 8,000-step bonus (if earned)
  // applies to today's totals exactly once.
  state.stepsToday = 0;
  if (state.stepBonusTomorrow) {
    const bonus = 10;
    state.earnedMinutes += bonus;
    state.remainingSeconds += bonus * 60;
    state.totalSeconds += bonus * 60;
    state.stepBonusTomorrow = false;
    pendingToastMessages.push("Bonus applied: +10 min from yesterday's steps 🚶");
  }

  saveState(); // persist the reset with today's savedDate right away
}

function loadState() {
  const raw = localStorage.getItem('balance_state');
  let saved = null;
  if (raw) {
    try { saved = JSON.parse(raw); } catch (e) { saved = null; }
  }

  if (!saved) {
    // One-time legacy fallback (A11) — read the old key once, then never again.
    const legacyApps = localStorage.getItem('balance_selected_apps');
    if (legacyApps) {
      try { state.selectedApps = JSON.parse(legacyApps); } catch (e) { /* ignore */ }
    }
    return;
  }

  Object.assign(state, saved);
  const today = todayStr();

  if (!saved.savedDate || saved.savedDate === today) {
    state.totalSeconds = (state.dailyAllowanceMinutes + state.earnedMinutes) * 60;
  } else {
    applyDailyReset(saved.savedDate, today);
  }
}

function replayDemo() {
  localStorage.clear();
  location.reload();
}

// ===== EARN ANALYTICS DATA =====
// 56 days of historical data (deterministic, no random)
// Screen time: starts ~240 min/day, trends down to ~105 min/day
// Workout: starts ~3 min/day, trends up to ~45 min/day
const SCREEN_TIME_SERIES = [
  238, 252, 231, 245, 260, 248, 255, // week 1 (high baseline)
  242, 228, 244, 230, 235, 218, 229, // week 2
  226, 215, 232, 218, 210, 224, 216, // week 3
  205, 195, 212, 198, 207, 188, 202, // week 4 (start of big drop)
  180, 192, 175, 185, 170, 195, 178, // week 5
  162, 175, 158, 168, 155, 178, 160, // week 6
  148, 162, 140, 152, 145, 168, 150, // week 7
  128, 142, 115, 135, 122, 145, 118, // week 8 (most recent)
];

const WORKOUT_SERIES = [
   3,  0,  5,  0,  8,  0,  4, // week 1
   6,  0, 10,  5,  0, 12,  8, // week 2
   8, 15,  0, 12, 10,  0, 18, // week 3
  12,  0, 20, 15,  5, 22, 10, // week 4
  18, 25,  0, 20, 28,  0, 22, // week 5
  25, 30, 10, 28, 32,  0, 30, // week 6
  30, 35, 15, 38, 30, 20, 42, // week 7
  35, 45,  0, 40, 48, 30, 45, // week 8
];

let currentEarnRange = 'month';

function getEarnRangeSlice(range) {
  if (range === 'week') {
    return {
      screen: SCREEN_TIME_SERIES.slice(-7),
      workout: WORKOUT_SERIES.slice(-7),
    };
  } else if (range === 'month') {
    return {
      screen: SCREEN_TIME_SERIES.slice(-30),
      workout: WORKOUT_SERIES.slice(-30),
    };
  } else {
    // All time — downsample to 8 weekly averages
    const screenWeekly = [];
    const workoutWeekly = [];
    for (let w = 0; w < 8; w++) {
      const slice = SCREEN_TIME_SERIES.slice(w * 7, w * 7 + 7);
      const wSlice = WORKOUT_SERIES.slice(w * 7, w * 7 + 7);
      screenWeekly.push(Math.round(slice.reduce((a, b) => a + b, 0) / slice.length));
      workoutWeekly.push(Math.round(wSlice.reduce((a, b) => a + b, 0) / wSlice.length));
    }
    return { screen: screenWeekly, workout: workoutWeekly };
  }
}

function countUpTo(el, target, suffix, duration) {
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(step);
}

function buildAnalyticsSVG(svgId, data, color, isScreenTime, range) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  svg.innerHTML = '';

  const W = 320, H = 120;
  const padL = 30, padR = 4, padT = 16, padB = 20; // fix 8 — room for left-side axis labels

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range_ = max - min || 1;
  const mid = (min + max) / 2;

  function xPos(i) {
    return padL + (i / (data.length - 1)) * (W - padL - padR);
  }
  function yPos(val) {
    return padT + (1 - (val - min) / range_) * (H - padT - padB);
  }

  const gridNS = 'http://www.w3.org/2000/svg';

  // fix 8 — 3 left-side gridline labels (bottom/mid/top, in minutes) with
  // matching horizontal gridlines, replacing the old two tiny right-side hints.
  [min, mid, max].forEach(val => {
    const y = yPos(val);
    const gridLine = document.createElementNS(gridNS, 'line');
    gridLine.setAttribute('x1', padL); gridLine.setAttribute('x2', W - padR);
    gridLine.setAttribute('y1', y.toFixed(1)); gridLine.setAttribute('y2', y.toFixed(1));
    gridLine.setAttribute('stroke', 'rgba(255,255,255,0.07)');
    gridLine.setAttribute('stroke-width', '1');
    svg.appendChild(gridLine);

    const label = document.createElementNS(gridNS, 'text');
    label.setAttribute('x', padL - 6);
    label.setAttribute('y', (y + 3).toFixed(1));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '9');
    label.setAttribute('fill', 'rgba(240,244,255,0.4)');
    label.textContent = `${Math.round(val)}m`;
    svg.appendChild(label);
  });

  // Build path points
  const points = data.map((val, i) => `${xPos(i).toFixed(1)},${yPos(val).toFixed(1)}`);

  // Area fill path (closed)
  const areaPoints = [
    `${padL},${H - padB}`,
    ...data.map((val, i) => `${xPos(i).toFixed(1)},${yPos(val).toFixed(1)}`),
    `${xPos(data.length - 1).toFixed(1)},${H - padB}`,
  ];

  // Area gradient
  const defs = document.createElementNS(gridNS, 'defs');
  const gradId = `grad-${svgId}`;
  const linearGrad = document.createElementNS(gridNS, 'linearGradient');
  linearGrad.setAttribute('id', gradId);
  linearGrad.setAttribute('x1', '0'); linearGrad.setAttribute('y1', '0');
  linearGrad.setAttribute('x2', '0'); linearGrad.setAttribute('y2', '1');
  const stop1 = document.createElementNS(gridNS, 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', color);
  stop1.setAttribute('stop-opacity', '0.25');
  const stop2 = document.createElementNS(gridNS, 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', color);
  stop2.setAttribute('stop-opacity', '0.0');
  linearGrad.appendChild(stop1);
  linearGrad.appendChild(stop2);
  defs.appendChild(linearGrad);
  svg.appendChild(defs);

  // Area
  const area = document.createElementNS(gridNS, 'polygon');
  area.setAttribute('points', areaPoints.join(' '));
  area.setAttribute('fill', `url(#${gradId})`);
  svg.appendChild(area);

  // Line path
  const totalLen = data.reduce((acc, val, i) => {
    if (i === 0) return 0;
    const dx = xPos(i) - xPos(i - 1);
    const dy = yPos(val) - yPos(data[i - 1]);
    return acc + Math.sqrt(dx * dx + dy * dy);
  }, 0);

  const polyline = document.createElementNS(gridNS, 'polyline');
  polyline.setAttribute('points', points.join(' '));
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', color);
  polyline.setAttribute('stroke-width', '2.5');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');
  // Animate stroke-dashoffset
  polyline.setAttribute('stroke-dasharray', totalLen.toFixed(1));
  polyline.setAttribute('stroke-dashoffset', totalLen.toFixed(1));
  polyline.style.transition = 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)';
  svg.appendChild(polyline);

  // fix 8 — week range gets a dot on every data point (not just the last one);
  // month/all-time keep a single "latest point" dot to avoid clutter.
  const dotIndices = range === 'week' ? data.map((_, i) => i) : [data.length - 1];
  dotIndices.forEach(i => {
    const isLast = i === data.length - 1;
    const dot = document.createElementNS(gridNS, 'circle');
    dot.setAttribute('cx', xPos(i).toFixed(1));
    dot.setAttribute('cy', yPos(data[i]).toFixed(1));
    dot.setAttribute('r', isLast ? '5' : '3.5');
    dot.setAttribute('fill', isLast ? '#34D399' : color);
    dot.setAttribute('stroke', '#0B0F1A');
    dot.setAttribute('stroke-width', '2');
    dot.style.opacity = '0';
    dot.style.transition = 'opacity 0.3s ease 0.7s';
    svg.appendChild(dot);
  });

  // Animate on next frame
  requestAnimationFrame(() => {
    polyline.setAttribute('stroke-dashoffset', '0');
    svg.querySelectorAll('circle').forEach(dot => { dot.style.opacity = '1'; });
  });
}

function buildAxisLabels(containerId, data, range) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';

  if (range === 'week') {
    const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    dayLabels.forEach(d => {
      const span = document.createElement('span');
      span.textContent = d;
      el.appendChild(span);
    });
  } else if (range === 'month') {
    const labels = ['30d ago', '23d', '16d', '9d', '3d', 'Today'];
    labels.forEach(d => {
      const span = document.createElement('span');
      span.textContent = d;
      el.appendChild(span);
    });
  } else {
    const labels = ['Wk 1','Wk 2','Wk 3','Wk 4','Wk 5','Wk 6','Wk 7','Wk 8'];
    labels.forEach(d => {
      const span = document.createElement('span');
      span.textContent = d;
      el.appendChild(span);
    });
  }
}

function renderEarnAnalytics(range) {
  currentEarnRange = range;
  const { screen, workout } = getEarnRangeSlice(range);

  // Compute stats (all-time references for headline stats)
  const allScreen = SCREEN_TIME_SERIES;
  const allWorkout = WORKOUT_SERIES;

  // Headline: screen time % drop from week 1 average to week 8 average (all-time)
  const w1Screen = allScreen.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
  const w8Screen = allScreen.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const screenPctDrop = Math.round(((w1Screen - w8Screen) / w1Screen) * 100);

  // Headline: workout mult from week 1 avg to week 8 avg
  const w1Workout = Math.max(1, allWorkout.slice(0, 7).reduce((a, b) => a + b, 0) / 7);
  const w8Workout = allWorkout.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const workoutMult = Math.round(w8Workout / w1Workout);

  // Supporting: total earned this period (workout minutes summed)
  const totalEarned = workout.reduce((a, b) => a + b, 0);

  // Update stat values with count-up animation
  const screenPctEl = document.getElementById('stat-screen-pct');
  const workoutMultEl = document.getElementById('stat-workout-mult');
  const earnedTotalEl = document.getElementById('stat-earned-total');
  const streakEl = document.getElementById('stat-streak');
  const earnedLabelEl = document.getElementById('stat-earned-label');

  if (screenPctEl) {
    screenPctEl.textContent = '—';
    countUpTo(screenPctEl, screenPctDrop, '%', 700);
    screenPctEl.style.color = 'var(--mint)';
    setTimeout(() => {
      if (screenPctEl) screenPctEl.textContent = `↓ ${screenPctDrop}%`;
    }, 720);
  }

  if (workoutMultEl) {
    workoutMultEl.textContent = '—';
    countUpTo(workoutMultEl, workoutMult, '×', 700);
    workoutMultEl.style.color = 'var(--mint)';
    setTimeout(() => {
      if (workoutMultEl) workoutMultEl.textContent = `↑ ${workoutMult}×`;
    }, 720);
  }

  if (earnedTotalEl) {
    earnedTotalEl.textContent = '—';
    countUpTo(earnedTotalEl, totalEarned, 'm', 600);
  }

  if (earnedLabelEl) {
    earnedLabelEl.textContent = range === 'week' ? 'Minutes earned this week' :
      range === 'month' ? 'Minutes earned this month' : 'Minutes earned total';
  }

  if (streakEl) {
    streakEl.textContent = '—';
    countUpTo(streakEl, state.streakDays, '', 500);
    setTimeout(() => {
      if (streakEl) streakEl.textContent = formatStreakText(state.streakDays);
    }, 520);
  }

  // fix 8 — subtitle reflects what the chart is actually showing
  const subtitleText = range === 'all' ? 'weekly average' : 'minutes per day';
  setTextContent('screen-chart-subtitle', subtitleText);
  setTextContent('workout-chart-subtitle', subtitleText);

  // Build charts
  buildAnalyticsSVG('chart-screen', screen, '#F87171', true, range);
  buildAnalyticsSVG('chart-workout', workout, '#34D399', false, range);

  // Axis labels
  buildAxisLabels('acc-screen-axis', screen, range);
  buildAxisLabels('acc-workout-axis', workout, range);

  // fix 8 — trend badges computed from the VISIBLE range (not all-time)
  applyTrendBadge('trend-screen', computeTrendBadge(screen, range, 'screen'));
  applyTrendBadge('trend-workout', computeTrendBadge(workout, range, 'workout'));

  // Update segmented control indicator
  positionSegIndicator(range);
}

// fix 8 — compares the first third vs last third of the currently displayed
// series so the badge always describes what's actually on screen, not a
// fixed all-time stat. Hidden entirely when the change is under 5%.
function computeTrendBadge(data, range, kind) {
  const n = data.length;
  const thirdLen = Math.max(1, Math.floor(n / 3));
  const firstAvg = data.slice(0, thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
  const lastAvg = data.slice(-thirdLen).reduce((a, b) => a + b, 0) / thirdLen;
  const rangeLabel = range === 'week' ? 'this week' : range === 'month' ? 'this month' : 'all-time';
  const safeFirst = Math.max(1, firstAvg);
  const pctChange = ((lastAvg - firstAvg) / safeFirst) * 100;

  if (Math.abs(pctChange) < 5) return null;

  if (kind === 'screen') {
    const pct = Math.round(Math.abs(pctChange));
    return pctChange < 0
      ? { text: `↓ ${pct}% ${rangeLabel}`, cls: 'mint' }
      : { text: `↑ ${pct}% ${rangeLabel}`, cls: 'coral' };
  }

  // workout minutes — express growth as a multiplier, drop as a percent
  const ratio = lastAvg / safeFirst;
  if (ratio >= 1) {
    return { text: `↑ ${Math.max(1, Math.round(ratio))}× ${rangeLabel}`, cls: 'mint' };
  }
  const pct = Math.round(Math.abs(pctChange));
  return { text: `↓ ${pct}% ${rangeLabel}`, cls: 'coral' };
}

function applyTrendBadge(elId, trend) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!trend) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  el.textContent = trend.text;
  el.className = `acc-trend ${trend.cls}`;
}

function positionSegIndicator(range) {
  const seg = document.getElementById('earn-range-seg');
  const indicator = document.getElementById('seg-indicator');
  if (!seg || !indicator) return;

  const btns = seg.querySelectorAll('.seg-btn');
  btns.forEach(b => b.classList.remove('active'));

  const activeBtn = seg.querySelector(`[data-range="${range}"]`);
  if (!activeBtn) return;
  activeBtn.classList.add('active');

  const segRect = seg.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  indicator.style.left = (btnRect.left - segRect.left) + 'px';
  indicator.style.width = btnRect.width + 'px';
}

// ===== HEALTH BADGE =====
function updateHealthBadge() {
  const badge = document.querySelector('.health-badge');
  if (!badge) return;
  if (state.healthConnected === true) {
    badge.innerHTML = `
      <span class="health-icon">❤️</span>
      <div class="health-text">
        <div class="health-title">Synced with Apple Health</div>
        <div class="health-sub">Workouts auto-detected</div>
      </div>
      <span class="health-check">✓</span>
    `;
  } else {
    // sweep (fix 13) — the old copy said "Connect in Settings" but Settings
    // had no such control; the badge itself is now the control (tap to connect).
    badge.innerHTML = `
      <span class="health-icon">🔗</span>
      <div class="health-text">
        <div class="health-title">Health not connected</div>
        <div class="health-sub">Tap to connect</div>
      </div>
    `;
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {

  loadState();

  // Reset selectedApps to empty so onboarding starts fresh
  if (!localStorage.getItem('balance_onboarded')) {
    state.selectedApps = [];
  }

  document.getElementById('welcome-cta').addEventListener('click', () => {
    showScreen('onboarding-screen');
    showObStep('ob-step-a');
  });

  // Check if already onboarded
  const onboarded = localStorage.getItem('balance_onboarded');

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
    if (onboarded) {
      showScreen('app-shell');
      renderEarnedList(); // fix 3 — rebuild from persisted state, not stale DOM
      renderAppTiles();
      buildWeekChart();
      updateLeaderboard();
      updateBonusCard();
      renderEarnAnalytics('month');
      updateRingDisplay();
      updatePlayPause();
      updateHealthBadge();
      startCountdown();
      updateDateLabel();
      updateGreeting();
      updateAllStreakDisplays();
      updateStreakDuel();
      updateShieldChip();
      updateRingCaption();
      setTextContent('earned-display', state.earnedMinutes);
      setTextContent('earn-today-display', state.earnedMinutes);
      if (pendingToastMessages.length) {
        pendingToastMessages.forEach(msg => showToast(msg));
        pendingToastMessages = [];
      }
    } else {
      showScreen('welcome-screen');
    }
  }, 1800);

  // ── ONBOARDING ──

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
    });
  });

  document.getElementById('ob-a-next').addEventListener('click', () => {
    if (state.selectedApps.length === 0) {
      state.selectedApps = ['Instagram', 'TikTok', 'YouTube'];
    }
    saveState();
    showObStep('ob-step-b');
  });

  // Step B: slider
  const slider = document.getElementById('time-slider');
  const sliderVal = document.getElementById('slider-value');

  function updateSliderDisplay(val) {
    const mins = parseInt(val);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    sliderVal.textContent = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
    state.dailyHours = mins / 60;
  }

  slider.addEventListener('input', () => updateSliderDisplay(slider.value));
  updateSliderDisplay(slider.value);

  document.getElementById('ob-b-next').addEventListener('click', () => {
    const stPopup = document.getElementById('screen-time-popup');
    if (stPopup) stPopup.style.display = 'flex';
  });

  // Screen Time popup
  document.getElementById('st-allow-btn').addEventListener('click', () => {
    const stPopup = document.getElementById('screen-time-popup');
    if (stPopup) stPopup.style.display = 'none';

    // Show loading toast
    showToast('Reading your last 30 days…');

    setTimeout(() => {
      // Compute actual = guess * 1.27, rounded to nearest 5 min
      const guessMins = Math.round(state.dailyHours * 60);
      const actualMins = Math.round((guessMins * 1.27) / 5) * 5;
      state.actualDailyHours = actualMins / 60;

      // Format guess
      const gh = Math.floor(guessMins / 60);
      const gm = guessMins % 60;
      const guessStr = gh > 0 ? (gm > 0 ? `${gh}h ${gm}m` : `${gh}h`) : `${gm}m`;

      // Format actual
      const ah = Math.floor(actualMins / 60);
      const am = actualMins % 60;
      const actualStr = ah > 0 ? (am > 0 ? `${ah}h ${am}m` : `${ah}h`) : `${am}m`;

      setTextContent('reveal-guess-text', guessStr);
      setTextContent('reveal-actual-value', actualStr);

      const pill = document.getElementById('reveal-delta-pill');
      if (pill) {
        if (actualMins > guessMins) {
          pill.textContent = '↑ 27% more than you thought';
          pill.className = 'reveal-delta-pill red';
        } else {
          pill.textContent = '↓ Less than you thought';
          pill.className = 'reveal-delta-pill green';
        }
      }

      showObStep('ob-step-b2');
    }, 1500);
  });

  document.getElementById('st-deny-btn').addEventListener('click', () => {
    const stPopup = document.getElementById('screen-time-popup');
    if (stPopup) stPopup.style.display = 'none';
    showToast('No problem — we\'ll use your estimate');
    showObStep('ob-step-c');
    initOnboardingStepC();
  });

  // ob-step-b2 continue
  document.getElementById('ob-b2-next').addEventListener('click', () => {
    showObStep('ob-step-c');
    initOnboardingStepC();
  });

  // Step C: shock screen — continue
  document.getElementById('ob-c-next').addEventListener('click', () => {
    showObStep('ob-step-d');
  });

  // Step D: let's do this
  document.getElementById('ob-d-next').addEventListener('click', () => {
    const healthPopup = document.getElementById('health-popup');
    if (healthPopup) healthPopup.style.display = 'flex';
  });

  // Plan step D handlers
  const planNameInput = document.getElementById('plan-name-input');
  if (planNameInput) {
    planNameInput.addEventListener('input', () => {
      state.userName = planNameInput.value.trim().slice(0, 20);
    });
  }

  const planSlider = document.getElementById('plan-allowance-slider');
  if (planSlider) {
    planSlider.addEventListener('input', () => {
      state.dailyAllowanceMinutes = parseInt(planSlider.value);
      setTextContent('plan-allowance-display', `${state.dailyAllowanceMinutes} min`);
    });
  }

  // Onboarding's earn-rate control — scoped to its own container so it never
  // touches the Settings sheet's copy of the same control (fix 6).
  document.querySelectorAll('#earn-rate-ctrl .earn-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#earn-rate-ctrl .earn-rate-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.earnRateMultiplier = parseFloat(btn.dataset.rate);
    });
  });

  const expiresToggle = document.getElementById('expires-toggle');
  if (expiresToggle) {
    expiresToggle.addEventListener('change', () => {
      state.expiresAtMidnight = expiresToggle.checked;
    });
  }

  // B4 — personalized line on the paywall, using the same numbers from onboarding.
  function updatePaywallPersonalLine() {
    const el = document.getElementById('paywall-personal-line');
    if (!el || state.paywallYears == null) return;
    const hours = state.actualDailyHours !== null ? state.actualDailyHours : state.dailyHours;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    const timeLabel = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
    el.textContent = `Your ${timeLabel}/day adds up to ${state.paywallYears.toFixed(1)} years of your remaining life.`;
  }

  // Health popup
  document.getElementById('health-allow-btn').addEventListener('click', () => {
    const healthPopup = document.getElementById('health-popup');
    if (healthPopup) healthPopup.style.display = 'none';
    state.healthConnected = true;
    showToast('✓ Synced with Apple Health');
    updatePaywallPersonalLine();
    setTimeout(() => showScreen('paywall-screen'), 1500);
  });

  document.getElementById('health-deny-btn').addEventListener('click', () => {
    const healthPopup = document.getElementById('health-popup');
    if (healthPopup) healthPopup.style.display = 'none';
    state.healthConnected = false;
    showToast('You can connect Health later in Settings');
    updatePaywallPersonalLine();
    showScreen('paywall-screen');
  });

  // ── PAYWALL ──

  // Transparent trial billing — date computed at render time, phrasing follows
  // the selected plan card, re-rendered on every selection change.
  function updateTrialBillingLine() {
    const el = document.getElementById('trial-billing-line');
    if (!el) return;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const dateStr = `${months[d.getMonth()]} ${d.getDate()}`;
    const yearlySelected = !!document.querySelector('#plan-yearly.selected');
    const priceText = yearlySelected ? 'then $39.99/yr' : 'then $7.99/mo';
    el.textContent = `Free until ${dateStr} — ${priceText}. We'll remind you the day before. Cancel anytime in Settings.`;
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
    showToast('This is a demo — no charge 😄');
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

  document.getElementById('restore-link').addEventListener('click', () => {
    showToast('No purchases found.');
  });

  // ── APP SHELL ──

  // Tab bar
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Gear / settings
  document.getElementById('gear-btn').addEventListener('click', openSettings);

  // Play/pause ring
  document.getElementById('play-pause-btn').addEventListener('click', () => {
    state.isPlaying = !state.isPlaying;
    updatePlayPause();
    updateRingDisplay();
  });
  updatePlayPause();

  // Earn more time button → go to Earn tab
  document.getElementById('earn-more-btn').addEventListener('click', () => switchTab('earn'));

  // Widget link in Today tab
  document.getElementById('widget-link-today').addEventListener('click', showLockScreen);

  // ── BREATHING PAUSE (B1) ──
  document.getElementById('breathing-open-btn').addEventListener('click', () => {
    hideBreathingPause();
    state.isPlaying = true;
    updatePlayPause();
    updateRingDisplay();
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

  // A2 — ✕ and "I'll wait until tomorrow" both close without earning.
  document.getElementById('intercept-close-btn').addEventListener('click', closeInterceptNoEarn);
  document.getElementById('wait-tomorrow-btn').addEventListener('click', closeInterceptNoEarn);

  // B3 — partner approve path: first ask declines, "Ask again" approves.
  document.getElementById('ask-partner-btn').addEventListener('click', askSarah);
  document.getElementById('ask-again-btn').addEventListener('click', askSarah);

  // ── EARN TAB ──

  // Earn analytics range control
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;
      renderEarnAnalytics(range);
    });
  });

  // A12 — keep the segmented-control indicator aligned across viewport resizes.
  window.addEventListener('resize', () => {
    if (state.currentTab === 'earn') positionSegIndicator(currentEarnRange);
  });

  document.querySelectorAll('.workout-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      document.querySelectorAll('.workout-tile').forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      selectedWorkout = tile.dataset.workout;

      const picker = document.getElementById('duration-picker');
      if (picker) picker.style.display = 'block';
      setTextContent('dp-workout-name', selectedWorkout);
      updateDpEarnPreview();
    });
  });

  document.querySelectorAll('.dp-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.dp-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedDuration = parseInt(chip.dataset.dur, 10);
      updateDpEarnPreview();
    });
  });

  document.getElementById('log-workout-btn').addEventListener('click', () => {
    if (!selectedWorkout) return;
    logWorkout(selectedWorkout, selectedDuration);
  });

  // sweep (fix 13) — health badge is now itself the "connect" control, since
  // Settings never had one despite the old copy pointing there.
  const healthBadgeEl = document.querySelector('.health-badge');
  if (healthBadgeEl) {
    healthBadgeEl.addEventListener('click', () => {
      if (state.healthConnected) return;
      state.healthConnected = true;
      updateHealthBadge();
      showToast('✓ Synced with Apple Health');
      saveState();
    });
  }

  // ── FRIENDS TAB (fix 1, 2, 12) ──
  document.getElementById('nudge-btn').addEventListener('click', handleNudge);
  document.getElementById('send-time-btn').addEventListener('click', handleSendTime);

  // Partner surprise gift — +5 min flat (NOT multiplied by earn rate).
  // Accepted state is session-only on purpose: it may reappear next session.
  // The card itself only appears after a nudge (fix 1) — see showPartnerGift().
  document.getElementById('gift-accept-btn').addEventListener('click', () => {
    addEarnedMinutes(5);
    launchConfetti();
    showToast('+5 min from Sarah 💚');
    const card = document.getElementById('partner-gift-card');
    if (card) {
      card.classList.add('accepted');
      card.innerHTML = `
        <div class="gift-row">
          <span class="gift-icon">🎁</span>
          <div class="gift-text">
            <div class="gift-title">Accepted ✓</div>
          </div>
        </div>
      `;
    }
  });

  // B5(c) — invite code chip: real clipboard copy, with a graceful fallback.
  document.getElementById('share-code-btn').addEventListener('click', () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('FRIENDS')
        .then(() => showToast('Invite code FRIENDS copied 🎉'))
        .catch(() => showToast('Invite code copied: FRIENDS 🎉'));
    } else {
      showToast('Invite code copied: FRIENDS 🎉');
    }
  });

  // ── SETTINGS SHEET ──
  document.getElementById('settings-overlay').addEventListener('click', closeSettings);

  // A1 — steppers write straight to state; openSettings() re-syncs the display.
  document.getElementById('allow-dec').addEventListener('click', () => {
    if (state.dailyAllowanceMinutes > 15) applyAllowanceChange(state.dailyAllowanceMinutes - 5);
  });
  document.getElementById('allow-inc').addEventListener('click', () => {
    if (state.dailyAllowanceMinutes < 120) applyAllowanceChange(state.dailyAllowanceMinutes + 5);
  });
  // fix 6 — single earn-rate control: same segmented buttons as onboarding,
  // reused inside Settings. Writes state, refreshes the duration-picker
  // preview, and persists.
  document.querySelectorAll('#settings-earn-rate-ctrl .earn-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#settings-earn-rate-ctrl .earn-rate-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.earnRateMultiplier = parseFloat(btn.dataset.rate);
      updateDpEarnPreview();
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

  document.getElementById('replay-demo-btn').addEventListener('click', replayDemo);

  // ── LOCK SCREEN ──
  document.getElementById('lockscreen-screen').addEventListener('click', hideLockScreen);

  // ── SHARE SCREEN (B5) ──
  document.getElementById('share-save-btn').addEventListener('click', saveShareImage);

  document.getElementById('share-close-btn').addEventListener('click', hideShareScreen);

});

// ===== FRIENDS TAB — PARTNER (fix 1, 2, 12) =====
// Session-only (not persisted) by design, same as the gift card itself —
// Sarah's state is a "beat" that can replay next session.
const SARAH_STREAK_DAYS = 9;
let sarahMinutesLeft = 14;
let partnerNudgeState = 'idle'; // idle -> nudged -> moving -> gifted
let sarahUnlockedToday = false;

// fix 1(b), 12 — composes Sarah's one status line from whatever's true right
// now: idle/moving, plus an "unlocked you today" suffix if she approved an
// intercept ask this session.
function renderSarahStatus() {
  const el = document.getElementById('partner-status');
  if (!el) return;
  let text = (partnerNudgeState === 'moving' || partnerNudgeState === 'gifted')
    ? '🚶 Moving now — your nudge worked'
    : `🟢 ${sarahMinutesLeft} min left · 🔥 ${SARAH_STREAK_DAYS} days`;
  if (sarahUnlockedToday) text += ' · 🔓 unlocked you today';
  el.textContent = text;
}

// fix 2 — streak duel is computed from real numbers: your actual streak vs
// Sarah's fixed 9-day streak (matches her status line). Bar widths are
// proportional, so a Day-1 user honestly sees 1 vs 9.
function updateStreakDuel() {
  const you = state.streakDays;
  const total = you + SARAH_STREAK_DAYS;
  const youPct = total > 0 ? (you / total) * 100 : 50;
  const youFill = document.querySelector('.you-fill');
  const sarahFill = document.querySelector('.sarah-fill');
  if (youFill) youFill.style.width = `${youPct.toFixed(1)}%`;
  if (sarahFill) sarahFill.style.width = `${(100 - youPct).toFixed(1)}%`;
  const youCount = document.querySelector('.duel-side.you .duel-count');
  const sarahCount = document.querySelector('.duel-side.sarah .duel-count');
  if (youCount) youCount.textContent = you;
  if (sarahCount) sarahCount.textContent = SARAH_STREAK_DAYS;
}

// fix 1(b) — nudge → toast → (3s) Sarah starts moving → (3s) she gifts you
// +5 back. Once per session; a repeat nudge just acknowledges she's moving.
function handleNudge() {
  if (partnerNudgeState !== 'idle') {
    showToast("Sarah's already moving 🚶");
    return;
  }
  partnerNudgeState = 'nudged';
  showToast('Nudge sent 👋');
  setTimeout(() => {
    partnerNudgeState = 'moving';
    renderSarahStatus();
    setTimeout(() => {
      partnerNudgeState = 'gifted';
      showPartnerGift();
    }, 3000);
  }, 3000);
}

function showPartnerGift() {
  const card = document.getElementById('partner-gift-card');
  if (!card) return;
  setTextContent('gift-title', 'Sarah sent you +5 min');
  setTextContent('gift-sub', 'right back at you 💪');
  card.classList.remove('accepted');
  card.style.display = 'block';
  card.classList.remove('gift-entrance');
  void card.offsetWidth; // reflow so the entrance animation replays cleanly
  card.classList.add('gift-entrance');
}

// fix 1(c) — reciprocal: sending Sarah time costs YOUR real remaining time.
function handleSendTime() {
  if (state.remainingSeconds < 5 * 60) {
    showToast('Not enough time left to gift');
    return;
  }
  state.remainingSeconds = Math.max(0, state.remainingSeconds - 5 * 60);
  sarahMinutesLeft += 5;
  renderSarahStatus();
  updateRingDisplay();
  refreshTodayNumbers();
  showToast('You sent Sarah 5 min 💚');
  saveState();
}

// ===== INTERCEPT EXERCISE FLOW =====
function startInterceptExercise(mins, exercise, baseMins) {
  const options = document.getElementById('intercept-options');
  const tracking = document.getElementById('tracking-state');
  const success = document.getElementById('intercept-success');
  const bottom = document.getElementById('intercept-bottom');
  const optionsLabel = document.querySelector('.intercept-options-label');

  if (options) options.style.display = 'none';
  if (optionsLabel) optionsLabel.style.display = 'none';
  if (tracking) tracking.style.display = 'block';
  if (bottom) bottom.style.display = 'none';

  setTimeout(() => {
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
    state.lastWorkout = { name: label, mins, at: Date.now() }; // B6

    // sweep (fix 13) — intercept exercises now count toward Earned Today and
    // steps too, same as Quick-log workouts, so they can't disagree.
    state.worktimeLoggedToday.push({ label, mins: baseMins, earned: mins });
    renderEarnedList();
    state.stepsToday += stepsForWorkout(label, baseMins);
    updateBonusCard();

    saveState();
    launchConfetti();

    setTimeout(() => {
      hideIntercept();
      const expiryText = state.expiresAtMidnight ? 'resets at midnight' : 'rolls over tomorrow';
      showToast(`Nice work! +${mins} min added, ${expiryText}.`);
      // Restore options for next time
      if (options) options.style.display = 'flex';
      if (optionsLabel) optionsLabel.style.display = 'block';
      if (success) success.style.display = 'none';
      if (bottom) bottom.style.display = 'flex';
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

// ===== LOG WORKOUT (Earn tab) =====
function logWorkout(workoutName, duration) {
  // Fly-up animation
  const picker = document.getElementById('duration-picker');
  if (picker) {
    const rect = picker.getBoundingClientRect();
    const frame = document.getElementById('phone-frame');
    const frameRect = frame.getBoundingClientRect();

    const fly = document.createElement('div');
    fly.className = 'earn-fly-label';
    fly.textContent = `+${Math.round(duration * state.earnRateMultiplier)} min`;
    fly.style.left = `${rect.left - frameRect.left + 80}px`;
    fly.style.top = `${rect.top - frameRect.top - 20}px`;
    frame.appendChild(fly);
    setTimeout(() => fly.remove(), 1000);
  }

  const earnedMins = Math.round(duration * state.earnRateMultiplier);
  addEarnedMinutes(earnedMins);
  state.lastWorkout = { name: workoutName, mins: earnedMins, at: Date.now() }; // B6
  launchConfetti();

  // Log to earned list — rebuilt from state, not appended DOM-only (fix 3)
  state.worktimeLoggedToday.push({ label: workoutName, mins: duration, earned: earnedMins });
  renderEarnedList();

  // Real steps, driven by this workout (fix 9)
  state.stepsToday += stepsForWorkout(workoutName, duration);
  updateBonusCard();

  showToast(`Logged! +${earnedMins} min earned 🎉`);

  // B2 — a 30-min-plus workout banks a Streak Shield (max 2).
  if (duration >= 30 && state.streakShields < 2) {
    state.streakShields++;
    updateShieldChip();
    setTimeout(() => showToast('🛡️ Streak Shield earned!'), 400);
  }

  // Reset picker
  document.querySelectorAll('.workout-tile').forEach(t => t.classList.remove('selected'));
  selectedWorkout = null;
  if (picker) picker.style.display = 'none';

  saveState();
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

// (a) Share card numbers come straight from state — no invented figures (fix 4).
function getShareStats() {
  const { earned } = getWeekSeries();
  const totalEarnedMins = earned.reduce((a, b) => a + b, 0);
  const hours = (totalEarnedMins / 60);
  const firstApp = state.selectedApps[0] || 'TikTok';
  const workouts = state.worktimeLoggedToday.length;
  return { hours, firstApp, workouts, streak: state.streakDays };
}

function updateShareCard() {
  const { hours, firstApp, workouts, streak } = getShareStats();
  const hoursStr = hours.toFixed(1);
  const headline = document.getElementById('share-headline');
  if (headline) {
    headline.innerHTML = workouts === 0
      ? `I'm on a <b>${streak}-day streak</b><br>of scrolling less`
      : `This week I traded<br><span class="share-highlight">${hoursStr} hours of ${firstApp}</span><br>for ${workouts} workouts`;
  }
  setTextContent('share-streak', `🔥 ${streak}-day streak`);
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
  const { hours, firstApp, workouts, streak } = getShareStats();
  const W = 600, H = 750;
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
  const pct = state.totalSeconds > 0 ? (state.remainingSeconds / state.totalSeconds) : 0.75;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.max(0.02, pct) * Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';

  // Headline (fix 4 — same real-or-fallback logic as the on-screen card)
  ctx.fillStyle = '#fff';
  ctx.font = '700 30px -apple-system, BlinkMacSystemFont, sans-serif';
  const headlineText = workouts === 0
    ? `I'm on a ${streak}-day streak of scrolling less`
    : `This week I traded ${hours.toFixed(1)} hours of ${firstApp} for ${workouts} workouts`;
  wrapCenteredText(ctx, headlineText, cx, 360, 480, 40);

  // Streak
  ctx.font = '700 28px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#F59E0B';
  ctx.fillText(`🔥 ${streak}-day streak`, cx, 560);

  // Footer
  ctx.font = '400 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('balance · move to scroll', cx, 700);

  return canvas;
}

// (b)+(d) Save image — real PNG export, with native share when available.
// Wrapped defensively so it can never throw on a desktop browser.
function saveShareImage() {
  try {
    const canvas = renderShareCanvas();
    canvas.toBlob((blob) => {
      if (!blob) { showToast('Saved!'); return; }

      if (navigator.share && typeof navigator.canShare === 'function') {
        try {
          const file = new File([blob], 'balance-week.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            const { streak } = getShareStats();
            navigator.share({
              files: [file],
              title: 'Balance',
              text: `🔥 ${streak}-day streak — traded scroll time for workouts.`,
            }).then(() => showToast('Shared!')).catch(() => { /* user cancelled — no-op */ });
            return;
          }
        } catch (e) { /* fall through to download */ }
      }

      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'balance-week.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch (e) { /* ignore — toast still confirms for the demo */ }
      showToast('Saved!');
    }, 'image/png');
  } catch (e) {
    showToast('Saved!');
  }
}
