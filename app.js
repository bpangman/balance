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
  laElapsed: 12 * 60 + 43,          // Live activity elapsed seconds
  worktimeLoggedToday: [{ label: 'Morning walk', mins: 12 }],
};

const APP_ICONS = {
  Instagram: { bg: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', emoji: '📸' },
  TikTok:    { bg: '#010101', emoji: '🎵' },
  X:         { bg: '#000', emoji: '✖' },
  YouTube:   { bg: '#FF0000', emoji: '▶' },
  Snapchat:  { bg: '#FFFC00', emoji: '👻', textColor: '#000' },
  Reddit:    { bg: '#FF4500', emoji: '👾' },
};

const APP_USED_MINS = {
  TikTok: 24, Instagram: 11, YouTube: 8, X: 2, Snapchat: 5, Reddit: 7,
};

// ===== COUNTDOWN TIMER =====
let countdownInterval = null;
let widgetInterval = null;
let laElapsedInterval = null;

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

// Live Activity elapsed
function startLaElapsed() {
  laElapsedInterval = setInterval(() => {
    state.laElapsed++;
    const m = Math.floor(state.laElapsed / 60);
    const s = state.laElapsed % 60;
    setTextContent('la-elapsed', `${m}:${s.toString().padStart(2,'0')}`);
    // Progress bar grows slowly
    const fill = document.getElementById('la-progress-fill');
    if (fill) {
      const pct = Math.min((state.laElapsed / (30 * 60)) * 100, 100);
      fill.style.width = `${pct.toFixed(1)}%`;
    }
  }, 1000);
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
  saveState();
  localStorage.setItem('balance_onboarded', '1');
  localStorage.setItem('balance_selected_apps', JSON.stringify(state.selectedApps));
  showScreen('app-shell');
  state.remainingSeconds = state.dailyAllowanceMinutes * 60;
  state.totalSeconds = (state.dailyAllowanceMinutes + state.earnedMinutes) * 60;
  renderAppTiles();
  buildWeekChart();
  updateRingDisplay();
  updatePlayPause();
  updateHealthBadge();
  startCountdown();
  updateDateLabel();
  const caption = document.querySelector('.ring-caption');
  if (caption) caption.innerHTML = `${state.dailyAllowanceMinutes} min allowance + <span id="earned-display">${state.earnedMinutes}</span> min earned · expires midnight`;
}

// ===== APP TILES =====
function renderAppTiles() {
  const container = document.getElementById('app-tiles-row');
  if (!container) return;
  container.innerHTML = '';

  const apps = state.selectedApps.length > 0 ? state.selectedApps : ['TikTok', 'Instagram', 'YouTube'];

  apps.forEach((appName, i) => {
    const info = APP_ICONS[appName] || { bg: '#333', emoji: '📱' };
    const used = APP_USED_MINS[appName] || 0;
    const isLocked = i === 0; // First app gets lock badge (TikTok usually)

    const tile = document.createElement('button');
    tile.className = 'app-used-tile';
    tile.setAttribute('data-app', appName);
    tile.innerHTML = `
      <div class="app-used-icon" style="background:${info.bg};color:${info.textColor||'#fff'}">${info.emoji}</div>
      <span class="app-used-name">${appName}</span>
      <span class="app-used-mins">${used}m</span>
      ${isLocked ? '<span class="lock-badge">🔒</span>' : ''}
    `;
    tile.addEventListener('click', () => showIntercept(appName));
    container.appendChild(tile);
  });
}

// ===== WEEKLY CHART =====
function buildWeekChart() {
  const chart = document.getElementById('week-chart');
  if (!chart) return;
  chart.innerHTML = '';

  const days = ['M','T','W','T','F','S','S'];
  const social = [42, 38, 45, 29, 45, 22, 31];
  const earned = [8, 12, 0, 15, 5, 20, 12];
  const todayIdx = 6; // Sunday = today

  days.forEach((day, i) => {
    const maxVal = Math.max(...social);
    const socialPct = (social[i] / (maxVal * 1.2)) * 100;
    const earnedPct = (earned[i] / (maxVal * 1.2)) * 100;
    const isToday = i === todayIdx;

    const wrap = document.createElement('div');
    wrap.className = 'chart-bar-wrap';
    wrap.innerHTML = `
      <div class="chart-bar-bg">
        <div class="chart-bar-fill${isToday ? ' today' : ''}" style="height:0%" data-target="${socialPct}"></div>
        <div class="chart-bar-line" style="bottom:${earnedPct}%"></div>
      </div>
      <span class="chart-day-label">${isToday ? '<b style="color:#fff">'+day+'</b>' : day}</span>
    `;
    chart.appendChild(wrap);
  });

  // Animate bars in after a frame
  requestAnimationFrame(() => {
    setTimeout(() => {
      chart.querySelectorAll('.chart-bar-fill').forEach((bar, i) => {
        setTimeout(() => {
          bar.style.height = bar.dataset.target + '%';
          bar.style.transition = 'height 0.6s cubic-bezier(0.4,0,0.2,1)';
        }, i * 60);
      });
    }, 100);
  });
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
function showIntercept(appName) {
  pauseCountdown();
  const info = APP_ICONS[appName] || { emoji: '📱' };
  setTextContent('intercept-app-icon', info.emoji);
  setTextContent('intercept-allowance', state.dailyAllowanceMinutes);

  // Reset states
  const options = document.getElementById('intercept-options');
  const tracking = document.getElementById('tracking-state');
  const success = document.getElementById('intercept-success');
  const bottom = document.getElementById('intercept-bottom');
  const partnerResp = document.getElementById('partner-response');

  if (options) options.style.display = 'flex';
  if (tracking) tracking.style.display = 'none';
  if (success) success.style.display = 'none';
  if (bottom) bottom.style.display = 'flex';
  if (partnerResp) partnerResp.style.display = 'none';

  showOverlay('intercept-screen');
}

function hideIntercept() {
  hideOverlay('intercept-screen');
  resumeCountdown();
}

// ===== EARN MINUTES (shared logic) =====
function addEarnedMinutes(mins) {
  state.earnedMinutes += mins;
  state.remainingSeconds += mins * 60;
  state.totalSeconds += mins * 60;
  setTextContent('earned-display', state.earnedMinutes);
  setTextContent('earn-today-display', state.earnedMinutes);
  updateRingDisplay();
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

// ===== SETTINGS SHEET =====
let settingsOpen = false;

function openSettings() {
  document.getElementById('settings-overlay').style.display = 'block';
  document.getElementById('settings-sheet').style.transform = 'translateY(0)';
  settingsOpen = true;
}

function closeSettings() {
  document.getElementById('settings-overlay').style.display = 'none';
  document.getElementById('settings-sheet').style.transform = 'translateY(100%)';
  settingsOpen = false;
}

// ===== SAVE/LOAD =====
function saveState() {
  localStorage.setItem('balance_state', JSON.stringify({
    earnedMinutes: state.earnedMinutes,
    streakDays: state.streakDays,
    dailyAllowanceMinutes: state.dailyAllowanceMinutes,
    selectedApps: state.selectedApps,
  }));
}

function loadState() {
  const raw = localStorage.getItem('balance_state');
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    state.totalSeconds = (state.dailyAllowanceMinutes + state.earnedMinutes) * 60;
  } catch (e) { /* ignore */ }
}

function replayDemo() {
  localStorage.clear();
  location.reload();
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
    badge.innerHTML = `
      <span class="health-icon">🔗</span>
      <div class="health-text">
        <div class="health-title">Health not connected</div>
        <div class="health-sub">Connect in Settings</div>
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
      renderAppTiles();
      buildWeekChart();
      updateRingDisplay();
      startCountdown();
      updateDateLabel();
      setTextContent('streak-display', state.streakDays);
      setTextContent('earned-display', state.earnedMinutes);
      setTextContent('earn-today-display', state.earnedMinutes);
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
  const planSlider = document.getElementById('plan-allowance-slider');
  if (planSlider) {
    planSlider.addEventListener('input', () => {
      state.dailyAllowanceMinutes = parseInt(planSlider.value);
      setTextContent('plan-allowance-display', `${state.dailyAllowanceMinutes} min`);
    });
  }

  document.querySelectorAll('.earn-rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.earn-rate-btn').forEach(b => b.classList.remove('selected'));
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

  // Health popup
  document.getElementById('health-allow-btn').addEventListener('click', () => {
    const healthPopup = document.getElementById('health-popup');
    if (healthPopup) healthPopup.style.display = 'none';
    state.healthConnected = true;
    showToast('✓ Synced with Apple Health');
    setTimeout(() => showScreen('paywall-screen'), 1500);
  });

  document.getElementById('health-deny-btn').addEventListener('click', () => {
    const healthPopup = document.getElementById('health-popup');
    if (healthPopup) healthPopup.style.display = 'none';
    state.healthConnected = false;
    showToast('You can connect Health later in Settings');
    showScreen('paywall-screen');
  });

  // ── PAYWALL ──
  document.querySelectorAll('.price-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.price-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });

  document.getElementById('start-trial-btn').addEventListener('click', () => {
    showToast('Demo mode — no charge, obviously 😄');
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
    showToast('No purchases found for this account.');
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

  // ── INTERCEPT SCREEN ──
  document.querySelectorAll('.intercept-row').forEach(row => {
    row.addEventListener('click', () => {
      const mins = parseInt(row.dataset.mins);
      startInterceptExercise(mins);
    });
  });

  document.getElementById('ask-partner-btn').addEventListener('click', () => {
    const bottom = document.getElementById('intercept-bottom');
    const resp = document.getElementById('partner-response');
    const waiting = document.getElementById('pr-waiting');
    const declined = document.getElementById('pr-declined');

    if (bottom) bottom.style.display = 'none';
    if (resp) resp.style.display = 'block';
    if (waiting) waiting.style.display = 'block';
    if (declined) declined.style.display = 'none';

    // After 3s, Sarah declines
    setTimeout(() => {
      if (waiting) waiting.style.display = 'none';
      if (declined) declined.style.display = 'block';
    }, 3000);
  });

  // ── EARN TAB ──
  let selectedWorkout = null;
  let selectedDuration = 20;

  document.querySelectorAll('.workout-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      document.querySelectorAll('.workout-tile').forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      selectedWorkout = tile.dataset.workout;

      const picker = document.getElementById('duration-picker');
      if (picker) picker.style.display = 'block';
      setTextContent('dp-workout-name', selectedWorkout);
      setTextContent('dp-earn-preview', Math.round(selectedDuration * state.earnRateMultiplier));
    });
  });

  document.querySelectorAll('.dp-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.dp-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedDuration = parseInt(chip.dataset.dur);
      setTextContent('dp-earn-preview', Math.round(selectedDuration * state.earnRateMultiplier));
    });
  });

  document.getElementById('log-workout-btn').addEventListener('click', () => {
    if (!selectedWorkout) return;
    logWorkout(selectedWorkout, selectedDuration);
  });

  // ── FRIENDS TAB ──
  document.getElementById('nudge-btn').addEventListener('click', () => {
    showToast('Nudge sent 👋');
  });

  document.getElementById('share-code-btn').addEventListener('click', () => {
    showToast('Share code copied: FRIENDS 🎉');
  });

  // ── SETTINGS SHEET ──
  document.getElementById('settings-overlay').addEventListener('click', closeSettings);

  let allowance = state.dailyAllowanceMinutes;
  let ratio = 1;

  document.getElementById('allow-dec').addEventListener('click', () => {
    if (allowance > 15) { allowance -= 5; setTextContent('allow-val', `${allowance} min`); }
  });
  document.getElementById('allow-inc').addEventListener('click', () => {
    if (allowance < 120) { allowance += 5; setTextContent('allow-val', `${allowance} min`); }
  });
  document.getElementById('ratio-dec').addEventListener('click', () => {
    if (ratio > 1) { ratio--; setTextContent('ratio-val', `1:${ratio}`); }
  });
  document.getElementById('ratio-inc').addEventListener('click', () => {
    if (ratio < 3) { ratio++; setTextContent('ratio-val', `1:${ratio}`); }
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

  // ── SHARE SCREEN ──
  document.getElementById('share-save-btn').addEventListener('click', () => {
    showToast('Saved to Photos (demo)');
  });

  document.getElementById('share-close-btn').addEventListener('click', hideShareScreen);

});

// ===== INTERCEPT EXERCISE FLOW =====
function startInterceptExercise(mins) {
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
    launchConfetti();

    setTimeout(() => {
      hideIntercept();
      showToast(`Nice. ${mins} minutes added — they expire at midnight.`);
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

  addEarnedMinutes(Math.round(duration * state.earnRateMultiplier));
  launchConfetti();

  // Log to earned list
  state.worktimeLoggedToday.push({ label: workoutName, mins: duration });
  const list = document.getElementById('earned-list');
  if (list) {
    const item = document.createElement('div');
    item.className = 'earned-item';
    item.innerHTML = `
      <span class="earned-icon">💪</span>
      <span class="earned-label">${workoutName}</span>
      <span class="earned-mins">+${Math.round(duration * state.earnRateMultiplier)} min</span>
    `;
    list.appendChild(item);
  }

  showToast(`${workoutName} logged! +${Math.round(duration * state.earnRateMultiplier)} min earned 🎉`);

  // Reset picker
  document.querySelectorAll('.workout-tile').forEach(t => t.classList.remove('selected'));
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

// ===== SHARE SCREEN =====
function showShareScreen() {
  showOverlay('share-screen');
}

function hideShareScreen() {
  hideOverlay('share-screen');
}
