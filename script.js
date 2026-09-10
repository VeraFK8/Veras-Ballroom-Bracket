const SUPABASE_URL = "https://kuneksvoyjvncjzwabzk.supabase.co";
const SUPABASE_KEY = "sb_publishable_ea--4OsRunYHH58gpb4KEw_txLdQ99M";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");
const authArea = document.getElementById("auth-area");
const profileArea = document.getElementById("profile-area");
const profileName = document.getElementById("profile-name");
const profileTeam = document.getElementById("profile-team");
const profilePoints = document.getElementById("profile-points");
const logoutBtn = document.getElementById("logout-btn");
const authMessage = document.getElementById("auth-message");
const loginGate = document.getElementById("login-gate");
const appShell = document.getElementById("app-shell");

let currentProfileData = null;
let couplesLoaded = false;

// Season settings load from Supabase. These values are fallbacks only.
let CURRENT_WEEK = 1;
let REROLL_OPEN_AFTER_WEEK = 5;
let LOYALTY_BONUS_POINTS = 20;
let INITIAL_TEAM_DEADLINE = new Date('2026-09-15T19:00:00-05:00');
let SEASON_ACTIVE = true;
let seasonSettingsLoaded = false;

let currentTeamRow = null;
let currentWeeklyPickRow = null;


async function loadSeasonSettings() {
  const { data, error } = await db
    .from('season_settings')
    .select('current_week, team_deadline, reroll_open_after_week, loyalty_bonus_points, season_active')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('Could not load season settings:', error);
    seasonSettingsLoaded = true;
    return;
  }

  if (data) {
    CURRENT_WEEK = Number(data.current_week ?? 1);
    REROLL_OPEN_AFTER_WEEK = Number(data.reroll_open_after_week ?? 5);
    LOYALTY_BONUS_POINTS = Number(data.loyalty_bonus_points ?? 20);
    SEASON_ACTIVE = data.season_active !== false;
    if (data.team_deadline) INITIAL_TEAM_DEADLINE = new Date(data.team_deadline);
  }

  seasonSettingsLoaded = true;

  const weekLabel = document.getElementById('weekly-picks-week-label');
  if (weekLabel) weekLabel.textContent = `♡ WEEK ${CURRENT_WEEK} PICKS ♡`;

  const seasonStatus = document.getElementById('season-account-status');
  if (seasonStatus) {
    seasonStatus.textContent =
      `Season Week ${CURRENT_WEEK} • Reroll after Week ${REROLL_OPEN_AFTER_WEEK} • +${LOYALTY_BONUS_POINTS} loyalty bonus`;
  }

  const bonusValue = document.querySelector('.team-lock-status__bonus strong');
  if (bonusValue) bonusValue.textContent = `+${LOYALTY_BONUS_POINTS}`;

  updateWeeklyPicksUI();
  updateTeamLockUI(currentTeamRow);
}

function showAuthMessage(message, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#b00020" : "#111";
}
function showLoggedIn() {
  if (loginGate) loginGate.hidden = true;
  if (appShell) appShell.hidden = false;
  if (authArea) authArea.style.display = "none";
  if (profileArea) profileArea.style.display = "";
}

function showLoggedOut() {
  if (loginGate) loginGate.hidden = false;
  if (appShell) appShell.hidden = true;
  if (authArea) authArea.style.display = "block";
  if (profileArea) profileArea.style.display = "none";
}
async function loadProfile() {
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError || !user) {
    currentProfileData = null;
    showLoggedOut();
    return;
  }

  const { data: profile, error } = await db.from("profiles")
    .select("display_name, team_name, total_points")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error(error);
    showAuthMessage("Could not load your profile.", true);
    return;
  }

  currentProfileData = profile;

  if (profileName) profileName.textContent = profile.display_name || "Ballroom Player";
  if (profileTeam) profileTeam.textContent = profile.team_name || "Unnamed Team";
  if (profilePoints) profilePoints.textContent = profile.total_points ?? 0;

  const playerInput = document.querySelector('#player-name');
  const teamInput = document.querySelector('#team-name');
  if (playerInput && !playerInput.value) playerInput.value = profile.display_name || '';
  if (teamInput && !teamInput.value) teamInput.value = profile.team_name || '';

  showLoggedIn();
  await refreshAdminAccess();
  await loadWeeklyPicksFromSupabase();

  if (couplesLoaded) {
    await loadUserTeamFromSupabase();
  }
}

if (signupForm) signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const displayName = document.getElementById("signup-display-name").value.trim();
  const teamName = document.getElementById("signup-team-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  if (!displayName || !teamName || !email || !password) return showAuthMessage("Please fill out every field.", true);
  if (password.length < 6) return showAuthMessage("Password must be at least 6 characters.", true);
  showAuthMessage("Creating your account...");
  const { data, error } = await db.auth.signUp({ email, password, options: { data: { display_name: displayName, team_name: teamName } } });
  if (error) return showAuthMessage(error.message, true);
  signupForm.reset();
  if (data.session) { showAuthMessage("Account created! You're signed in."); await loadProfile(); }
  else showAuthMessage("Account created! Check your email to confirm your account, then log in.");
});

if (loginForm) loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  showAuthMessage("Logging you in...");
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return showAuthMessage(error.message || "Email or password is incorrect.", true);
  loginForm.reset();
  showAuthMessage("Welcome back ♡");
  await loadProfile();
});

if (logoutBtn) logoutBtn.addEventListener("click", async () => {
  await db.auth.signOut();
  currentProfileData = null;
  if (teamForm) teamForm.reset();
  [1,2,3,4].forEach((n) => renderCouplePreview(n));
  renderTeam(null);
  showLoggedOut();
  showAuthMessage("You have been logged out.");
});

db.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    setTimeout(async () => {
      if (!seasonSettingsLoaded) await loadSeasonSettings();
      await loadProfile();
      await refreshAdminAccess();
    }, 0);
  } else {
    showLoggedOut();
  }
});

(async () => {
  await loadSeasonSettings();
  await loadProfile();
  await refreshAdminAccess();
})();

const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });
}

// Load the real cast (including photo_url) from Supabase.
// Local fallback keeps the site working even if Supabase Row Level Security
// blocks public reads or the database is temporarily unavailable.
const fallbackCouples = [
  { id: 'local-amber-pasha', celebrity_name: 'Amber', pro_name: 'Pasha', photo_url: 'images/couples/amber-and-pasha.webp' },
  { id: 'local-ciara-brandon', celebrity_name: 'Ciara', pro_name: 'Brandon', photo_url: 'images/couples/ciara-and-brandon.webp' },
  { id: 'local-conner-adele', celebrity_name: 'Conner', pro_name: 'Adele', photo_url: 'images/couples/conner-and-adele.webp' },
  { id: 'local-connor-rylee', celebrity_name: 'Connor', pro_name: 'Rylee', photo_url: 'images/couples/connor-and-rylee.jpg' },
  { id: 'local-ezra-danilla', celebrity_name: 'Ezra', pro_name: 'Danilla', photo_url: 'images/couples/ezra-and-danilla.webp' },
  { id: 'local-giada-alan', celebrity_name: 'Giada', pro_name: 'Alan', photo_url: 'images/couples/giada-and-alan.webp' },
  { id: 'local-harry-jenna', celebrity_name: 'Harry', pro_name: 'Jenna', photo_url: 'images/couples/harry-and-jenna.webp' },
  { id: 'local-jackson-emma', celebrity_name: 'Jackson', pro_name: 'Emma', photo_url: 'images/couples/jackson-and-emma.webp' },
  { id: 'local-jenna-val', celebrity_name: 'Jenna', pro_name: 'Val', photo_url: 'images/couples/jenna-and-val.webp' },
  { id: 'local-julia-ezra', celebrity_name: 'Julia', pro_name: 'Ezra', photo_url: 'images/couples/julia-and-ezra.webp' },
  { id: 'local-maura-mark', celebrity_name: 'Maura', pro_name: 'Mark', photo_url: 'images/couples/maura-and-mark.webp' },
  { id: 'local-quillermo-witney', celebrity_name: 'Quillermo', pro_name: 'Witney', photo_url: 'images/couples/quillermo-and-witney.webp' },
  { id: 'local-sarah-jane-hailey', celebrity_name: 'Sarah Jane', pro_name: 'Hailey', photo_url: 'images/couples/sarah-jane-and-hailey.webp' },
  { id: 'local-tatyana-jan', celebrity_name: 'Tatyana', pro_name: 'Jan', photo_url: 'images/couples/tatyana-and-jan.webp' },
  { id: 'local-taylor-britt', celebrity_name: 'Taylor', pro_name: 'Britt', photo_url: 'images/couples/taylor-and-britt.webp' },
  { id: 'local-tyler-sharna', celebrity_name: 'Tyler', pro_name: 'Sharna', photo_url: 'images/couples/tyler-and-sharna.webp' }
];

let couples = [];

function coupleLabel(couple) {
  const celebrity = couple.celebrity_name ?? couple.celebrity ?? couple.star_name ?? couple.star ?? '';
  const pro = couple.pro_name ?? couple.pro ?? couple.dancer_name ?? couple.dancer ?? '';
  if (celebrity && pro) return `${celebrity} + ${pro}`;
  return couple.couple_name ?? couple.name ?? couple.display_name ?? `Couple ${couple.id ?? ''}`.trim();
}


function dedupeCouples(list) {
  const seen = new Set();

  return (list || []).filter((couple) => {
    const celebrity = String(couple.celebrity_name ?? couple.celebrity ?? '').trim().toLowerCase();
    const pro = String(couple.pro_name ?? couple.pro ?? '').trim().toLowerCase();

    // Primary key: actual pairing names.
    let key = `${celebrity}||${pro}`;

    // Fallback if a row is missing one/both names.
    if (!celebrity && !pro) {
      key = String(couple.id ?? couple.photo_url ?? couple.image_url ?? '').trim().toLowerCase();
    }

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function couplePhoto(couple) {
  let value = couple.photo_url ?? couple.image_url ?? couple.photo ?? couple.image ?? '';
  if (!value) return '';

  value = String(value).trim();

  // If a full <img src="..."> snippet was accidentally pasted into Supabase,
  // extract only the actual URL.
  const srcMatch = value.match(/src\s*=\s*["']([^"']+)["']/i);
  if (srcMatch) value = srcMatch[1];

  // Strip wrapping quotes that sometimes get copied with URLs.
  value = value.replace(/^["']|["']$/g, '').trim();

  return value;
}

function coupleIsActive(couple) {
  if ('active' in couple) return couple.active !== false;
  if ('is_active' in couple) return couple.is_active !== false;
  if ('eliminated' in couple) return couple.eliminated !== true;
  return true;
}

function findCouple(value) {
  return couples.find((couple) => String(couple.id) === String(value)) || null;
}

function fillCoupleSelect(select, placeholder = 'Choose a couple') {
  couples = dedupeCouples(couples);
  if (!select) return;
  const oldValue = select.value;
  select.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);

  couples.forEach((couple) => {
    const option = document.createElement('option');
    option.value = String(couple.id);
    option.textContent = coupleLabel(couple);
    select.appendChild(option);
  });

  if (oldValue && [...select.options].some((o) => o.value === oldValue)) select.value = oldValue;
}

function renderCouplePreview(slotNumber) {
  const select = document.querySelector(`#couple-${slotNumber}`);
  const preview = document.querySelector(`#couple-preview-${slotNumber}`);
  if (!select || !preview) return;

  const couple = findCouple(select.value);
  if (!couple) {
    preview.innerHTML = '';
    return;
  }

  const photo = couplePhoto(couple);
  preview.innerHTML = `
    <div class="couple-preview-card">
      ${photo ? `<img src="${photo}" alt="${coupleLabel(couple)}" loading="lazy">` : ''}
      <strong>${coupleLabel(couple)}</strong>
    </div>`;
}

async function loadCouples() {
  couples = dedupeCouples(couples);
  let data = null;
  let error = null;

  try {
    const result = await db.from('couples').select('*');
    data = result.data;
    error = result.error;
  } catch (err) {
    error = err;
  }

  if (error) {
    console.warn('Supabase couples could not be read; using bundled cast instead:', error);
  }

  const sourceCouples = Array.isArray(data) && data.length ? data : fallbackCouples;

  couples = sourceCouples
    .filter(coupleIsActive)
    .sort((a, b) => {
      const ao = a.sort_order ?? a.display_order ?? a.order_number ?? 999;
      const bo = b.sort_order ?? b.display_order ?? b.order_number ?? 999;
      if (ao !== bo) return ao - bo;
      return coupleLabel(a).localeCompare(coupleLabel(b));
    });

  document.querySelectorAll('.couple-select').forEach((select) => fillCoupleSelect(select, 'Choose a couple'));
  document.querySelectorAll('.pick-couple-select').forEach((select) => fillCoupleSelect(select, 'Select your pick'));
  document.querySelectorAll('.bracket-couple-select').forEach((select) => fillCoupleSelect(select, 'Choose a couple'));

  [1,2,3,4].forEach((n) => renderCouplePreview(n));
  couplesLoaded = true;
  await loadUserTeamFromSupabase();
}

const teamForm = document.querySelector('#team-form');
const teamNote = document.querySelector('#team-note');
const savedTeamName = document.querySelector('#saved-team-name');
const savedPlayerName = document.querySelector('#saved-player-name');
const savedCouples = document.querySelector('#saved-couples');
const clearTeamButton = document.querySelector('#clear-team');
const teamSubmitBtn = document.getElementById('team-submit-btn');
const teamLockStatus = document.getElementById('team-lock-status');
const teamLockTitle = document.getElementById('team-lock-title');
const teamLockCopy = document.getElementById('team-lock-copy');
const accountTeamStrip = document.getElementById('account-team-strip');
const accountPicksSummary = document.getElementById('account-picks-summary');
const weeklyPicksStatus = document.getElementById('weekly-picks-status');
const weeklyPicksStatusTitle = document.getElementById('weekly-picks-status-title');
const weeklyPicksStatusCopy = document.getElementById('weekly-picks-status-copy');
const picksForm = document.getElementById('picks-form');

function normalizeSavedCouple(item) {
  if (item && typeof item === 'object') return item;
  const match = couples.find((couple) => coupleLabel(couple) === item);
  return match ? { id: String(match.id), label: coupleLabel(match), photo_url: couplePhoto(match) } : { id: '', label: String(item || ''), photo_url: '' };
}


function renderAccountTeamStrip(team) {
  if (!accountTeamStrip) return;

  const items = (team?.couples || [])
    .map((saved) => {
      const item = normalizeSavedCouple(saved);
      const couple = item.id ? findCouple(item.id) : null;
      return {
        label: couple ? coupleLabel(couple) : (item.label || 'Couple'),
        photo: couple ? couplePhoto(couple) : (item.photo_url || '')
      };
    })
    .filter((item) => item.label);

  if (!items.length) {
    accountTeamStrip.innerHTML = '<div class="account-team-empty">Save your lineup to see your couples here.</div>';
    return;
  }

  accountTeamStrip.innerHTML = items.slice(0, 4).map((item) => `
    <div class="account-team-tile">
      ${item.photo ? `<img src="${item.photo}" alt="${item.label}" loading="lazy">` : ''}
      <span>${item.label}</span>
    </div>
  `).join('');
}

function renderTeam(team) {
  if (!savedTeamName || !savedPlayerName || !savedCouples) return;
  if (!team) {
    savedTeamName.textContent = 'NO TEAM YET ♡';
    savedPlayerName.textContent = 'Create your lineup to get started.';
    savedCouples.innerHTML = '<li>—</li><li>—</li><li>—</li><li>—</li>';
    renderAccountTeamStrip(null);
    return;
  }

  savedTeamName.textContent = (team.teamName || 'Unnamed Team').toUpperCase();
  savedPlayerName.textContent = `Managed by ${team.playerName || 'Ballroom Player'}`;
  savedCouples.innerHTML = '';
  renderAccountTeamStrip(team);

  (team.couples || []).forEach((saved) => {
    const item = normalizeSavedCouple(saved);
    const couple = item.id ? findCouple(item.id) : null;
    const label = couple ? coupleLabel(couple) : item.label;
    const photo = couple ? couplePhoto(couple) : item.photo_url;
    const li = document.createElement('li');
    li.innerHTML = `
      ${photo ? `<img class="saved-couple-photo" src="${photo}" alt="${label}" loading="lazy">` : ''}
      <span class="saved-couple-info"><strong>${label}</strong></span>`;
    savedCouples.appendChild(li);
  });
}



function getTuesdayDeadlineForWeek(referenceDate = new Date()) {
  // Weekly picks close every Tuesday at 7:00 PM Central.
  // For this season we're using UTC-5 (Central Daylight Time in September).
  const d = new Date(referenceDate);
  const day = d.getUTCDay();
  // Convert reference moment to a simple Central-date approximation using UTC-5.
  const central = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const centralDay = central.getUTCDay();
  const daysUntilTuesday = (2 - centralDay + 7) % 7;

  const deadlineCentral = new Date(Date.UTC(
    central.getUTCFullYear(),
    central.getUTCMonth(),
    central.getUTCDate() + daysUntilTuesday,
    19, 0, 0
  ));

  // Convert 7pm Central (UTC-5 for this season date) back to real UTC timestamp.
  return new Date(deadlineCentral.getTime() + 5 * 60 * 60 * 1000);
}

function weeklyPicksDeadlinePassed() {
  return new Date() >= getTuesdayDeadlineForWeek(new Date());
}

function initialTeamDeadlinePassed() {
  return new Date() >= INITIAL_TEAM_DEADLINE;
}

function formatCentralDeadline(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(date);
}

function updateWeeklyPicksUI() {
  if (!picksForm || !weeklyPicksStatus) return;

  const weekLabel = document.getElementById('weekly-picks-week-label');
  if (weekLabel) weekLabel.textContent = `♡ WEEK ${CURRENT_WEEK} PICKS ♡`;

  if (!SEASON_ACTIVE) {
    weeklyPicksStatus.classList.add('is-locked');
    picksForm.classList.add('picks-locked');
    [...picksForm.querySelectorAll('select')].forEach((el) => el.disabled = true);
    const submit = picksForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    if (weeklyPicksStatusTitle) weeklyPicksStatusTitle.textContent = 'SEASON CLOSED';
    if (weeklyPicksStatusCopy) weeklyPicksStatusCopy.textContent = 'Weekly picks are not currently open.';
    return;
  }

  const locked = weeklyPicksDeadlinePassed();
  const deadline = getTuesdayDeadlineForWeek(new Date());

  weeklyPicksStatus.classList.toggle('is-locked', locked);
  picksForm.classList.toggle('picks-locked', locked);

  const submit = picksForm.querySelector('button[type="submit"]');
  if (submit) submit.disabled = locked;

  [...picksForm.querySelectorAll('select')].forEach((el) => {
    el.disabled = locked;
  });

  if (weeklyPicksStatusTitle) {
    weeklyPicksStatusTitle.textContent = locked ? '🔒 PICKS LOCKED FOR THIS WEEK' : 'PICKS OPEN';
  }
  if (weeklyPicksStatusCopy) {
    weeklyPicksStatusCopy.textContent = locked
      ? `The deadline passed at ${formatCentralDeadline(deadline)}.`
      : `Deadline: ${formatCentralDeadline(deadline)}.`;
  }
}

function rerollIsOpen() {
  return CURRENT_WEEK > REROLL_OPEN_AFTER_WEEK;
}

function setCoupleSelectsDisabled(disabled) {
  [1,2,3,4].forEach((n) => {
    const select = document.querySelector(`#couple-${n}`);
    if (select) {
      select.disabled = disabled;
      select.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
  });

  if (teamForm) {
    teamForm.classList.toggle('team-is-locked', disabled);
  }

  if (clearTeamButton) {
    clearTeamButton.disabled = disabled;
    clearTeamButton.style.opacity = disabled ? '.45' : '';
    clearTeamButton.style.cursor = disabled ? 'not-allowed' : '';
  }
}

function restoreLockedSelections() {
  if (!currentTeamRow?.locked_at) return;
  const ids = [
    currentTeamRow.couple_1_id,
    currentTeamRow.couple_2_id,
    currentTeamRow.couple_3_id,
    currentTeamRow.couple_4_id
  ].map((id) => id == null ? '' : String(id));

  ids.forEach((id, index) => {
    const select = document.querySelector(`#couple-${index + 1}`);
    if (select) select.value = id;
    renderCouplePreview(index + 1);
  });
}

function updateTeamLockUI(saved = currentTeamRow) {
  const hasLockedTeam = Boolean(saved?.locked_at);

  if (!SEASON_ACTIVE && !hasLockedTeam) {
    if (!teamLockStatus || !teamSubmitBtn) return;
    teamLockStatus.classList.add('is-locked');
    setCoupleSelectsDisabled(true);
    teamSubmitBtn.disabled = true;
    teamSubmitBtn.textContent = 'TEAM DRAFT CLOSED 🔒';
    if (teamLockTitle) teamLockTitle.textContent = 'SEASON CLOSED';
    if (teamLockCopy) teamLockCopy.textContent = 'Fantasy team drafting is not currently open.';
    return;
  }
  const rerollAvailable = hasLockedTeam && !saved?.reroll_used && rerollIsOpen();
  const finalLocked = hasLockedTeam && Boolean(saved?.reroll_used);

  if (!teamLockStatus || !teamSubmitBtn) return;

  teamLockStatus.classList.remove('is-locked', 'is-reroll');

  if (!hasLockedTeam) {
    const teamDeadlineClosed = initialTeamDeadlinePassed();

    setCoupleSelectsDisabled(teamDeadlineClosed);
    teamSubmitBtn.disabled = teamDeadlineClosed;
    teamSubmitBtn.textContent = teamDeadlineClosed ? 'TEAM DRAFT CLOSED 🔒' : 'LOCK IN MY TEAM ♡';

    if (teamLockTitle) {
      teamLockTitle.textContent = teamDeadlineClosed
        ? '🔒 INITIAL TEAM DEADLINE PASSED'
        : 'BUILD YOUR ORIGINAL FOUR';
    }

    if (teamLockCopy) {
      teamLockCopy.textContent = teamDeadlineClosed
        ? `The initial fantasy-team deadline was ${formatCentralDeadline(INITIAL_TEAM_DEADLINE)}.`
        : `Choose your four couples, then lock them in by ${formatCentralDeadline(INITIAL_TEAM_DEADLINE)}. Your lineup stays frozen through Week ${REROLL_OPEN_AFTER_WEEK}.`;
    }
    return;
  }

  if (rerollAvailable) {
    teamLockStatus.classList.add('is-reroll');
    setCoupleSelectsDisabled(false);
    teamSubmitBtn.disabled = false;
    teamSubmitBtn.textContent = 'LOCK IN MY REROLL ✦';
    if (teamLockTitle) teamLockTitle.textContent = '✦ MIDSEASON REROLL AVAILABLE ✦';
    if (teamLockCopy) {
      teamLockCopy.textContent =
        `You have one reroll. Change any of your four couples now, then lock your final lineup. Using it gives up the +${LOYALTY_BONUS_POINTS} loyalty bonus.`;
    }
    return;
  }

  teamLockStatus.classList.add('is-locked');
  setCoupleSelectsDisabled(true);
  teamSubmitBtn.disabled = true;

  if (finalLocked) {
    teamSubmitBtn.textContent = 'FINAL TEAM LOCKED 🔒';
    if (teamLockTitle) teamLockTitle.textContent = '🔒 FINAL LINEUP LOCKED';
    if (teamLockCopy) {
      teamLockCopy.textContent = 'Your midseason reroll has been used. This lineup is locked for the rest of the season.';
    }
  } else {
    teamSubmitBtn.textContent = 'TEAM LOCKED 🔒';
    if (teamLockTitle) teamLockTitle.textContent = '🔒 ORIGINAL LINEUP LOCKED';
    if (teamLockCopy) {
      teamLockCopy.textContent =
        `Your original four are locked through Week ${REROLL_OPEN_AFTER_WEEK}. Keep them all season to earn the +${LOYALTY_BONUS_POINTS} loyalty bonus.`;
    }
  }
}

async function loadUserTeamFromSupabase() {
  if (!couplesLoaded) return;

  const { data: { user }, error: userError } = await db.auth.getUser();

  if (userError || !user) {
    currentTeamRow = null;
    renderTeam(null);
    updateTeamLockUI(null);
    return;
  }

  const { data: saved, error } = await db
    .from('user_teams')
    .select('couple_1_id, couple_2_id, couple_3_id, couple_4_id, original_couple_1_id, original_couple_2_id, original_couple_3_id, original_couple_4_id, locked_at, reroll_used, reroll_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Could not load saved team:', error);
    if (teamNote) teamNote.textContent = '♡ Could not load your saved team.';
    return;
  }

  const playerInput = document.querySelector('#player-name');
  const teamInput = document.querySelector('#team-name');

  if (playerInput && currentProfileData) {
    playerInput.value = currentProfileData.display_name || '';
  }
  if (teamInput && currentProfileData) {
    teamInput.value = currentProfileData.team_name || '';
  }

  if (!saved) {
    currentTeamRow = null;
    renderTeam(null);
    [1,2,3,4].forEach((n) => {
      const select = document.querySelector(`#couple-${n}`);
      if (select) select.value = '';
      renderCouplePreview(n);
    });
    if (teamNote) teamNote.textContent = 'Choose four couples, then lock in your team ♡';
    updateTeamLockUI(null);
    return;
  }

  currentTeamRow = saved;

  const ids = [
    saved.couple_1_id,
    saved.couple_2_id,
    saved.couple_3_id,
    saved.couple_4_id
  ].map((id) => id == null ? '' : String(id));

  ids.forEach((id, i) => {
    const select = document.querySelector(`#couple-${i + 1}`);
    if (select) select.value = id;
    renderCouplePreview(i + 1);
  });

  const selectedCouples = ids
    .map((id) => findCouple(id))
    .filter(Boolean)
    .map((couple) => ({
      id: String(couple.id),
      label: coupleLabel(couple),
      photo_url: couplePhoto(couple)
    }));

  renderTeam({
    playerName: currentProfileData?.display_name || 'Ballroom Player',
    teamName: currentProfileData?.team_name || 'Unnamed Team',
    couples: selectedCouples
  });

  updateTeamLockUI(saved);

  if (teamNote) {
    teamNote.textContent = saved.locked_at
      ? '♡ Your locked fantasy team is loaded.'
      : '♡ Your saved team is loaded. Lock it in when you are ready.';
  }
}

[1,2,3,4].forEach((n) => {
  const select = document.querySelector(`#couple-${n}`);
  if (select) {
    select.addEventListener('change', () => {
      const lockedNow = Boolean(currentTeamRow?.locked_at);
      const canRerollNow = lockedNow && !currentTeamRow?.reroll_used && rerollIsOpen();

      if (lockedNow && !canRerollNow) {
        restoreLockedSelections();
        if (teamNote) teamNote.textContent = `♡ Your team is locked through Week ${REROLL_OPEN_AFTER_WEEK}.`;
        return;
      }

      renderCouplePreview(n);
    });
  }
});

if (teamForm) {
  teamForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!teamForm.checkValidity()) {
      teamForm.reportValidity();
      return;
    }

    const { data: { user }, error: userError } = await db.auth.getUser();
    if (userError || !user) {
      if (teamNote) teamNote.textContent = '♡ Please log in before saving your team.';
      document.querySelector('#account')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const selectedIds = [1,2,3,4].map((n) => document.querySelector(`#couple-${n}`).value);

    if (new Set(selectedIds).size !== selectedIds.length) {
      teamNote.textContent = '♡ Choose four different couples for your lineup.';
      return;
    }

    const selectedCouples = selectedIds.map((id) => findCouple(id));
    if (selectedCouples.some((couple) => !couple)) {
      teamNote.textContent = '♡ One of those couples could not be found. Refresh and try again.';
      return;
    }

    // A bundled fallback ID starts with "local-". It cannot be stored in the
    // Supabase foreign-key columns, so require the real Supabase cast here.
    if (selectedIds.some((id) => String(id).startsWith('local-'))) {
      teamNote.textContent = '♡ The live couple list is not connected right now. Refresh and try again.';
      return;
    }

    const alreadyLocked = Boolean(currentTeamRow?.locked_at);
    const canReroll = alreadyLocked && !currentTeamRow?.reroll_used && rerollIsOpen();

    if (!alreadyLocked && initialTeamDeadlinePassed()) {
      teamNote.textContent = `♡ The initial team deadline was ${formatCentralDeadline(INITIAL_TEAM_DEADLINE)}.`;
      updateTeamLockUI(currentTeamRow);
      return;
    }

    if (alreadyLocked && !canReroll) {
      teamNote.textContent = `♡ Your team is locked through Week ${REROLL_OPEN_AFTER_WEEK}.`;
      updateTeamLockUI(currentTeamRow);
      return;
    }

    const now = new Date().toISOString();
    teamNote.textContent = alreadyLocked ? 'Locking in your reroll...' : 'Locking in your original team...';

    let row;

    if (!alreadyLocked) {
      row = {
        user_id: user.id,
        couple_1_id: selectedIds[0],
        couple_2_id: selectedIds[1],
        couple_3_id: selectedIds[2],
        couple_4_id: selectedIds[3],
        original_couple_1_id: selectedIds[0],
        original_couple_2_id: selectedIds[1],
        original_couple_3_id: selectedIds[2],
        original_couple_4_id: selectedIds[3],
        locked_at: now,
        reroll_used: false,
        reroll_at: null,
        updated_at: now
      };
    } else {
      row = {
        user_id: user.id,
        couple_1_id: selectedIds[0],
        couple_2_id: selectedIds[1],
        couple_3_id: selectedIds[2],
        couple_4_id: selectedIds[3],
        reroll_used: true,
        reroll_at: now,
        updated_at: now
      };
    }

    const { data: savedTeam, error } = await db
      .from('user_teams')
      .upsert(row, { onConflict: 'user_id' })
      .select('couple_1_id, couple_2_id, couple_3_id, couple_4_id, original_couple_1_id, original_couple_2_id, original_couple_3_id, original_couple_4_id, locked_at, reroll_used, reroll_at')
      .single();

    if (error) {
      console.error('Could not save team:', error);
      teamNote.textContent = `♡ Could not lock your team: ${error.message}`;
      return;
    }

    currentTeamRow = savedTeam;

    // Re-read the row from Supabase so the lock state comes from the database,
    // not just the browser's local copy.
    const { data: verifiedTeam, error: verifyError } = await db
      .from('user_teams')
      .select('couple_1_id, couple_2_id, couple_3_id, couple_4_id, original_couple_1_id, original_couple_2_id, original_couple_3_id, original_couple_4_id, locked_at, reroll_used, reroll_at')
      .eq('user_id', user.id)
      .single();

    if (verifyError || !verifiedTeam?.locked_at) {
      console.error('Team lock verification failed:', verifyError, verifiedTeam);
      teamNote.textContent = '♡ Your lineup saved, but the lock did not stick. Please refresh and try again.';
      return;
    }

    currentTeamRow = verifiedTeam;

    const playerNameValue = document.querySelector('#player-name').value.trim();
    const teamNameValue = document.querySelector('#team-name').value.trim();

    // Keep profile display/team names in sync with the team builder.
    const { error: profileUpdateError } = await db
      .from('profiles')
      .update({
        display_name: playerNameValue,
        team_name: teamNameValue
      })
      .eq('id', user.id);

    if (profileUpdateError) {
      console.warn('Team saved, but profile names could not be updated:', profileUpdateError);
    } else {
      currentProfileData = {
        ...(currentProfileData || {}),
        display_name: playerNameValue,
        team_name: teamNameValue
      };
      if (profileName) profileName.textContent = playerNameValue || 'Ballroom Player';
      if (profileTeam) profileTeam.textContent = teamNameValue || 'Unnamed Team';
    }

    const team = {
      playerName: playerNameValue,
      teamName: teamNameValue,
      couples: selectedCouples.map((couple) => ({
        id: String(couple.id),
        label: coupleLabel(couple),
        photo_url: couplePhoto(couple)
      }))
    };

    renderTeam(team);
    updateTeamLockUI(currentTeamRow);
    restoreLockedSelections();

    teamNote.textContent = currentTeamRow?.reroll_used
      ? '♡ Your reroll is locked. This is your final lineup!'
      : `♡ Your original four are locked through Week ${REROLL_OPEN_AFTER_WEEK}!`;
  });
}

// Clearing the form does not delete the cloud-saved lineup yet.
// We will add a delete policy/button behavior in the next database step.
if (clearTeamButton) {
  clearTeamButton.textContent = 'Reset form';
  clearTeamButton.addEventListener('click', () => {
    if (teamForm) teamForm.reset();

    if (currentProfileData) {
      const playerInput = document.querySelector('#player-name');
      const teamInput = document.querySelector('#team-name');
      if (playerInput) playerInput.value = currentProfileData.display_name || '';
      if (teamInput) teamInput.value = currentProfileData.team_name || '';
    }

    [1,2,3,4].forEach((n) => renderCouplePreview(n));
    updateTeamLockUI(currentTeamRow);
    if (teamNote) {
      teamNote.textContent = currentTeamRow?.locked_at
        ? 'Your locked team was not changed.'
        : 'Form reset. Your account team was not deleted.';
    }
  });
}

const note = document.querySelector('#form-note');


function renderAccountPicksSummary(picks = null) {
  const summary = document.getElementById('account-picks-summary');
  if (!summary) return;

  if (!picks) {
    summary.innerHTML = '<p>No weekly picks saved yet.</p>';
    return;
  }

  const highestCouple = findCouple(picks.highest_scoring_couple_id || picks.highest);
  const lowestCouple = findCouple(picks.lowest_scoring_couple_id || picks.lowest);
  const eliminatedCouple = findCouple(picks.eliminated_couple_id || picks.eliminated);

  const highestLabel = highestCouple ? coupleLabel(highestCouple) : '—';
  const lowestLabel = lowestCouple ? coupleLabel(lowestCouple) : '—';
  const eliminatedLabel = eliminatedCouple ? coupleLabel(eliminatedCouple) : '—';

  summary.innerHTML = `
    <div class="account-pick-row">
      <span>Week</span>
      <strong>${picks.week_number || CURRENT_WEEK}</strong>
    </div>
    <div class="account-pick-row">
      <span>Highest scoring</span>
      <strong>${highestLabel}</strong>
    </div>
    <div class="account-pick-row">
      <span>Lowest scoring</span>
      <strong>${lowestLabel}</strong>
    </div>
    <div class="account-pick-row">
      <span>Eliminated</span>
      <strong>${eliminatedLabel}</strong>
    </div>
    <div class="account-pick-row">
      <span>Perfect score?</span>
      <strong>${picks.perfect_score === true ? 'Yes' : picks.perfect_score === false ? 'No' : '—'}</strong>
    </div>
  `;
}

async function loadWeeklyPicksFromSupabase() {
  const { data: userData, error: userError } = await db.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    currentWeeklyPickRow = null;
    renderAccountPicksSummary(null);
    updateWeeklyPicksUI();
    return;
  }

  const { data, error } = await db
    .from('weekly_picks')
    .select('id, user_id, week_number, highest_scoring_couple_id, lowest_scoring_couple_id, eliminated_couple_id, perfect_score, locked_at, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('week_number', CURRENT_WEEK)
    .maybeSingle();

  if (error) {
    console.error('Could not load weekly picks:', error);
    renderAccountPicksSummary(null);
    updateWeeklyPicksUI();
    return;
  }

  currentWeeklyPickRow = data || null;
  renderAccountPicksSummary(currentWeeklyPickRow);

  if (currentWeeklyPickRow) {
    const highest = document.querySelector('#highest-pick');
    const lowest = document.querySelector('#lowest-pick');
    const eliminated = document.querySelector('#eliminated-pick');
    const perfect = document.querySelector('#perfect-pick');

    if (highest) highest.value = String(currentWeeklyPickRow.highest_scoring_couple_id || '');
    if (lowest) lowest.value = String(currentWeeklyPickRow.lowest_scoring_couple_id || '');
    if (eliminated) eliminated.value = String(currentWeeklyPickRow.eliminated_couple_id || '');
    if (perfect) perfect.value = currentWeeklyPickRow.perfect_score === true ? 'yes' : currentWeeklyPickRow.perfect_score === false ? 'no' : '';

    const note = document.querySelector('#form-note');
    if (note) note.textContent = '♡ Your saved weekly picks are loaded.';
  }

  updateWeeklyPicksUI();
}



// ---------------- PRESEASON BRACKET ----------------
const bracketForm = document.getElementById('bracket-form');
const bracketStatus = document.getElementById('bracket-status');
const bracketStatusTitle = document.getElementById('bracket-status-title');
const bracketStatusCopy = document.getElementById('bracket-status-copy');
const bracketSubmitBtn = document.getElementById('bracket-submit-btn');
const bracketNote = document.getElementById('bracket-note');
let currentBracketSubmission = null;

const bracketStageCounts = {
  top8: 8,
  top6: 6,
  top4: 4,
  final3: 3,
  runner_up: 1,
  winner: 1
};

function bracketDeadlinePassed() {
  return new Date() >= INITIAL_TEAM_DEADLINE;
}

function bracketSelects(stage) {
  return [...document.querySelectorAll(`.bracket-couple-select[data-stage="${stage}"]`)];
}

function bracketValues(stage) {
  return bracketSelects(stage).map((s) => s.value).filter(Boolean);
}

function refillBracketSelect(select, allowedIds, placeholder) {
  const previous = select.value;
  select.innerHTML = '';

  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);

  const source = Array.isArray(allowedIds)
    ? allowedIds.map((id) => findCouple(id)).filter(Boolean)
    : couples;

  source.forEach((couple) => {
    const option = document.createElement('option');
    option.value = String(couple.id);
    option.textContent = coupleLabel(couple);
    select.appendChild(option);
  });

  if (previous && [...select.options].some((o) => o.value === previous)) {
    select.value = previous;
  } else {
    select.value = '';
  }
}

function removeDuplicateSelectionsWithinStage(stage) {
  const seen = new Set();

  bracketSelects(stage).forEach((select) => {
    const value = select.value;
    if (!value) return;

    if (seen.has(value)) {
      select.value = '';
    } else {
      seen.add(value);
    }
  });
}

function clearInvalidDownstreamSelections(parentStage, childStage) {
  const allowed = new Set(bracketValues(parentStage));

  bracketSelects(childStage).forEach((select) => {
    if (select.value && !allowed.has(select.value)) {
      select.value = '';
    }
  });
}

function disableDuplicateOptionsWithinStage(stage) {
  const selects = bracketSelects(stage);
  const selectedValues = selects.map((s) => s.value).filter(Boolean);

  selects.forEach((select) => {
    [...select.options].forEach((option) => {
      if (!option.value) {
        option.disabled = false;
        return;
      }

      // A couple already chosen in another slot cannot be selected here.
      option.disabled =
        option.value !== select.value &&
        selectedValues.includes(option.value);
    });
  });
}

function refreshBracketOptions(changedStage = null) {
  // First, make sure a couple cannot occupy two spots in the same round.
  ['top8', 'top6', 'top4', 'final3'].forEach(removeDuplicateSelectionsWithinStage);

  // If an earlier round changed, immediately clear any later-round picks
  // that are no longer contained in the parent round.
  if (changedStage === 'top8') {
    clearInvalidDownstreamSelections('top8', 'top6');
    clearInvalidDownstreamSelections('top6', 'top4');
    clearInvalidDownstreamSelections('top4', 'final3');
    clearInvalidDownstreamSelections('final3', 'runner_up');
    clearInvalidDownstreamSelections('final3', 'winner');
  } else if (changedStage === 'top6') {
    clearInvalidDownstreamSelections('top6', 'top4');
    clearInvalidDownstreamSelections('top4', 'final3');
    clearInvalidDownstreamSelections('final3', 'runner_up');
    clearInvalidDownstreamSelections('final3', 'winner');
  } else if (changedStage === 'top4') {
    clearInvalidDownstreamSelections('top4', 'final3');
    clearInvalidDownstreamSelections('final3', 'runner_up');
    clearInvalidDownstreamSelections('final3', 'winner');
  } else if (changedStage === 'final3') {
    clearInvalidDownstreamSelections('final3', 'runner_up');
    clearInvalidDownstreamSelections('final3', 'winner');
  }

  // Rebuild each downstream list from the round above it.
  const top8 = bracketValues('top8');
  bracketSelects('top6').forEach((s) => refillBracketSelect(s, top8, 'Choose from Top 8'));

  // Re-check after rebuilding because a parent change may have cleared values.
  removeDuplicateSelectionsWithinStage('top6');
  const top6 = bracketValues('top6');
  bracketSelects('top4').forEach((s) => refillBracketSelect(s, top6, 'Choose from Top 6'));

  removeDuplicateSelectionsWithinStage('top4');
  const top4 = bracketValues('top4');
  bracketSelects('final3').forEach((s) => refillBracketSelect(s, top4, 'Choose from Top 4'));

  removeDuplicateSelectionsWithinStage('final3');
  const final3 = bracketValues('final3');
  bracketSelects('runner_up').forEach((s) => refillBracketSelect(s, final3, 'Choose runner-up'));
  bracketSelects('winner').forEach((s) => refillBracketSelect(s, final3, 'Choose winner'));

  // Prevent winner and runner-up from being the same couple.
  const runner = bracketValues('runner_up')[0] || '';
  const winner = bracketValues('winner')[0] || '';

  bracketSelects('runner_up').forEach((select) => {
    [...select.options].forEach((option) => {
      option.disabled = Boolean(option.value && option.value === winner && option.value !== select.value);
    });
  });

  bracketSelects('winner').forEach((select) => {
    [...select.options].forEach((option) => {
      option.disabled = Boolean(option.value && option.value === runner && option.value !== select.value);
    });
  });

  // Disable couples already used in another slot of the same round.
  ['top8', 'top6', 'top4', 'final3'].forEach(disableDuplicateOptionsWithinStage);
}

function validateBracketStage(stage) {
  const expected = bracketStageCounts[stage];
  const vals = bracketValues(stage);
  return vals.length === expected && new Set(vals).size === expected;
}

function validateBracketNesting() {
  const containsAll = (parent, child) => {
    const p = new Set(bracketValues(parent));
    return bracketValues(child).every((id) => p.has(id));
  };

  if (!containsAll('top8', 'top6')) return 'Every Top 6 pick must also be in your Top 8.';
  if (!containsAll('top6', 'top4')) return 'Every Top 4 pick must also be in your Top 6.';
  if (!containsAll('top4', 'final3')) return 'Every Final 3 pick must also be in your Top 4.';

  const finalistSet = new Set(bracketValues('final3'));
  const runner = bracketValues('runner_up')[0];
  const winner = bracketValues('winner')[0];

  if (!finalistSet.has(runner) || !finalistSet.has(winner)) {
    return 'Your runner-up and winner must both be in your Final 3.';
  }
  if (runner === winner) return 'Your winner and runner-up must be different couples.';

  return '';
}

function updateBracketUI() {
  if (!bracketForm || !bracketStatus || !bracketSubmitBtn) return;

  const locked = Boolean(currentBracketSubmission?.locked_at);
  const deadlineClosed = bracketDeadlinePassed();

  bracketForm.classList.toggle('is-locked', locked || deadlineClosed);
  [...bracketForm.querySelectorAll('select')].forEach((s) => {
    s.disabled = locked || deadlineClosed;
  });
  bracketSubmitBtn.disabled = locked || deadlineClosed;

  bracketStatus.classList.toggle('is-locked', locked || deadlineClosed);

  if (locked) {
    bracketStatusTitle.textContent = '🔒 BRACKET LOCKED';
    bracketStatusCopy.textContent = 'Your preseason bracket is locked for the season.';
    bracketSubmitBtn.textContent = 'BRACKET LOCKED 🔒';
  } else if (deadlineClosed) {
    bracketStatusTitle.textContent = '🔒 BRACKET DEADLINE PASSED';
    bracketStatusCopy.textContent = `The bracket deadline was ${formatCentralDeadline(INITIAL_TEAM_DEADLINE)}.`;
    bracketSubmitBtn.textContent = 'BRACKET CLOSED 🔒';
  } else {
    bracketStatusTitle.textContent = 'BRACKET OPEN';
    bracketStatusCopy.textContent = `Lock your bracket by ${formatCentralDeadline(INITIAL_TEAM_DEADLINE)}.`;
    bracketSubmitBtn.textContent = 'LOCK IN MY BRACKET ♡';
  }
}

async function loadBracketFromSupabase() {
  if (!bracketForm) return;

  const { data: userData, error: userError } = await db.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    currentBracketSubmission = null;
    updateBracketUI();
    return;
  }

  const { data: submission, error: submissionError } = await db
    .from('bracket_submissions')
    .select('id, user_id, locked_at, created_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (submissionError) {
    console.error('Could not load bracket submission:', submissionError);
    if (bracketNote) bracketNote.textContent = `♡ Could not load your bracket: ${submissionError.message}`;
    return;
  }

  currentBracketSubmission = submission || null;

  const { data: picks, error: picksError } = await db
    .from('bracket_picks')
    .select('stage, pick_order, couple_id')
    .eq('user_id', user.id)
    .order('stage')
    .order('pick_order');

  if (picksError) {
    console.error('Could not load bracket picks:', picksError);
    if (bracketNote) bracketNote.textContent = `♡ Could not load your bracket picks: ${picksError.message}`;
    updateBracketUI();
    return;
  }

  const byStage = {};
  (picks || []).forEach((pick) => {
    if (!byStage[pick.stage]) byStage[pick.stage] = [];
    byStage[pick.stage].push(pick);
  });

  // Load upstream to downstream so filtered dropdowns contain saved choices.
  ['top8', 'top6', 'top4', 'final3', 'runner_up', 'winner'].forEach((stage) => {
    if (stage !== 'top8') refreshBracketOptions();
    (byStage[stage] || []).forEach((pick) => {
      const select = document.querySelector(
        `.bracket-couple-select[data-stage="${stage}"][data-order="${pick.pick_order}"]`
      );
      if (select) select.value = String(pick.couple_id);
    });
  });

  refreshBracketOptions();

  if (picks?.length && bracketNote) {
    bracketNote.textContent = currentBracketSubmission?.locked_at
      ? '♡ Your locked preseason bracket is loaded.'
      : '♡ Your saved bracket is loaded.';
  }

  updateBracketUI();
}

document.querySelectorAll('.bracket-couple-select').forEach((select) => {
  select.addEventListener('change', () => {
    if (currentBracketSubmission?.locked_at || bracketDeadlinePassed()) {
      loadBracketFromSupabase();
      return;
    }

    refreshBracketOptions(select.dataset.stage);

    if (bracketNote) {
      bracketNote.textContent =
        '♡ Later rounds update automatically when you change an earlier-round pick.';
    }
  });
});

if (bracketForm) {
  bracketForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (currentBracketSubmission?.locked_at) {
      if (bracketNote) bracketNote.textContent = '♡ Your bracket is already locked.';
      updateBracketUI();
      return;
    }

    if (bracketDeadlinePassed()) {
      if (bracketNote) bracketNote.textContent = '♡ The preseason bracket deadline has passed.';
      updateBracketUI();
      return;
    }

    const stages = ['top8', 'top6', 'top4', 'final3', 'runner_up', 'winner'];
    for (const stage of stages) {
      if (!validateBracketStage(stage)) {
        if (bracketNote) bracketNote.textContent = `♡ Complete ${stage.replace('_', ' ').toUpperCase()} with different couples in every spot.`;
        return;
      }
    }

    const nestingError = validateBracketNesting();
    if (nestingError) {
      if (bracketNote) bracketNote.textContent = `♡ ${nestingError}`;
      return;
    }

    const { data: userData, error: userError } = await db.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      if (bracketNote) bracketNote.textContent = '♡ Please log in before locking your bracket.';
      return;
    }

    if (bracketNote) bracketNote.textContent = 'Locking in your preseason bracket...';

    const rows = [];
    stages.forEach((stage) => {
      bracketSelects(stage).forEach((select, index) => {
        rows.push({
          user_id: user.id,
          stage,
          pick_order: index + 1,
          couple_id: select.value
        });
      });
    });

    // Because every bracket always has all 23 slots, replace the user's unlocked picks cleanly.
    const { error: deleteError } = await db
      .from('bracket_picks')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Could not replace bracket picks:', deleteError);
      if (bracketNote) bracketNote.textContent = `♡ Could not save bracket: ${deleteError.message}`;
      return;
    }

    const { error: insertError } = await db
      .from('bracket_picks')
      .insert(rows);

    if (insertError) {
      console.error('Could not insert bracket picks:', insertError);
      if (bracketNote) bracketNote.textContent = `♡ Could not save bracket: ${insertError.message}`;
      return;
    }

    const now = new Date().toISOString();
    const { data: submission, error: submissionError } = await db
      .from('bracket_submissions')
      .upsert({
        user_id: user.id,
        locked_at: now,
        updated_at: now
      }, { onConflict: 'user_id' })
      .select('id, user_id, locked_at, created_at, updated_at')
      .single();

    if (submissionError) {
      console.error('Could not lock bracket:', submissionError);
      if (bracketNote) bracketNote.textContent = `♡ Picks saved, but bracket lock failed: ${submissionError.message}`;
      return;
    }

    currentBracketSubmission = submission;
    updateBracketUI();
    if (bracketNote) bracketNote.textContent = '♡ Your preseason bracket is officially locked!';
  });
}




async function refreshAdminAccess() {
  const adminSection = document.getElementById('admin-results');
  const adminNavLink = document.getElementById('admin-nav-link');

  try {
    const { data: userData, error: userError } = await db.auth.getUser();
    const user = userData?.user;

    if (userError || !user) {
      if (adminSection) adminSection.hidden = true;
      if (adminNavLink) adminNavLink.hidden = true;
      return false;
    }

    const { data: adminProfile, error: adminError } = await db
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (adminError) {
      console.error('Could not check admin access:', adminError);
      if (adminSection) adminSection.hidden = true;
      if (adminNavLink) adminNavLink.hidden = true;
      return false;
    }

    const isAdmin = adminProfile?.is_admin === true;

    if (adminSection) adminSection.hidden = !isAdmin;
    if (adminNavLink) adminNavLink.hidden = !isAdmin;

    if (isAdmin) {
      initializeAdminResultsCenter();
    }

    return isAdmin;
  } catch (err) {
    console.error('Admin access check failed:', err);
    if (adminSection) adminSection.hidden = true;
    if (adminNavLink) adminNavLink.hidden = true;
    return false;
  }
}

// ---------------- ADMIN RESULTS CENTER ----------------
let adminResultsInitialized = false;
let adminLoadedRows = [];

function initializeAdminResultsCenter() {
  if (adminResultsInitialized) return;
  adminResultsInitialized = true;

  const weekSelect = document.getElementById('admin-week-select');
  if (!weekSelect) return;

  for (let week = 1; week <= 12; week++) {
    const option = document.createElement('option');
    option.value = String(week);
    option.textContent = `Week ${week}`;
    weekSelect.appendChild(option);
  }
  weekSelect.value = String(CURRENT_WEEK);

  document.getElementById('admin-load-results')?.addEventListener('click', loadAdminWeek);
  document.getElementById('admin-save-draft')?.addEventListener('click', () => saveAdminWeek(false));
  document.getElementById('admin-finalize-week')?.addEventListener('click', () => saveAdminWeek(true));

  const sourceBtn = document.getElementById('admin-store-source');
  sourceBtn?.addEventListener('click', () => {
    const source = document.getElementById('admin-import-source')?.value.trim();
    const note = document.getElementById('admin-import-note');
    if (note) {
      note.textContent = source
        ? '♡ Notes kept on this screen for review. Nothing has been published.'
        : 'Paste a recap or score list first.';
    }
  });

  renderAdminRows();
  loadAdminWeek();
}

function selectedAdminWeek() {
  return Number(document.getElementById('admin-week-select')?.value || CURRENT_WEEK);
}

function makeAdminRow(couple, saved = null) {
  const tr = document.createElement('tr');
  tr.dataset.coupleId = String(couple.id);

  const photo = couplePhoto(couple);
  const checked = (key) => saved?.[key] ? 'checked' : '';
  const score = saved?.judges_score ?? '';
  const rank = saved?.night_rank ?? '';
  const placement = saved?.final_placement ?? '';

  tr.innerHTML = `
    <td>
      <div class="admin-result-couple">
        ${photo ? `<img src="${photo}" alt="">` : ''}
        <strong>${coupleLabel(couple)}</strong>
      </div>
    </td>
    <td><input class="admin-score" type="number" min="0" step="0.5" value="${score}" aria-label="Judges score"></td>
    <td class="admin-rank">${rank || '—'}</td>
    <td><input class="admin-perfect" type="checkbox" ${checked('got_perfect_score')}></td>
    <td><input class="admin-first10" type="checkbox" ${checked('got_first_10_of_season')}></td>
    <td><input class="admin-challenge" type="checkbox" ${checked('challenge_win')}></td>
    <td><input class="admin-safe" type="checkbox" ${checked('was_safe')}></td>
    <td><input class="admin-bottom" type="checkbox" ${checked('was_bottom_group')}></td>
    <td><input class="admin-eliminated" type="checkbox" ${checked('was_eliminated')}></td>
    <td><input class="admin-semis" type="checkbox" ${checked('made_semifinals')}></td>
    <td><input class="admin-finale" type="checkbox" ${checked('made_finale')}></td>
    <td>
      <select class="admin-placement">
        <option value="">—</option>
        <option value="1" ${String(placement)==='1'?'selected':''}>1st</option>
        <option value="2" ${String(placement)==='2'?'selected':''}>2nd</option>
        <option value="3" ${String(placement)==='3'?'selected':''}>3rd</option>
      </select>
    </td>
  `;

  tr.querySelector('.admin-score')?.addEventListener('input', recalculateAdminSummary);
  tr.querySelectorAll('input[type="checkbox"], select').forEach((el) => {
    el.addEventListener('change', recalculateAdminSummary);
  });

  return tr;
}

function renderAdminRows(savedRows = []) {
  const body = document.getElementById('admin-results-body');
  if (!body) return;

  body.innerHTML = '';
  const savedById = new Map(savedRows.map((row) => [String(row.couple_id), row]));

  dedupeCouples(couples).forEach((couple) => {
    body.appendChild(makeAdminRow(couple, savedById.get(String(couple.id))));
  });

  recalculateAdminSummary();
}

function adminRowsFromForm() {
  const week = selectedAdminWeek();
  const rows = [...document.querySelectorAll('#admin-results-body tr')];

  const result = rows.map((tr) => {
    const rawScore = tr.querySelector('.admin-score')?.value;
    return {
      week_number: week,
      couple_id: tr.dataset.coupleId,
      judges_score: rawScore === '' ? null : Number(rawScore),
      night_rank: null,
      got_perfect_score: tr.querySelector('.admin-perfect')?.checked || false,
      got_first_10_of_season: tr.querySelector('.admin-first10')?.checked || false,
      challenge_win: tr.querySelector('.admin-challenge')?.checked || false,
      was_safe: tr.querySelector('.admin-safe')?.checked || false,
      was_bottom_group: tr.querySelector('.admin-bottom')?.checked || false,
      was_eliminated: tr.querySelector('.admin-eliminated')?.checked || false,
      made_semifinals: tr.querySelector('.admin-semis')?.checked || false,
      made_finale: tr.querySelector('.admin-finale')?.checked || false,
      final_placement: tr.querySelector('.admin-placement')?.value
        ? Number(tr.querySelector('.admin-placement').value)
        : null,
      updated_at: new Date().toISOString()
    };
  });

  // Dense ranking by judges score, so tied scores share a rank.
  const scored = result
    .filter((row) => row.judges_score !== null)
    .sort((a, b) => b.judges_score - a.judges_score);

  let lastScore = null;
  let rank = 0;
  scored.forEach((row) => {
    if (row.judges_score !== lastScore) {
      rank += 1;
      lastScore = row.judges_score;
    }
    row.night_rank = rank;
  });

  return result;
}

function coupleNameById(id) {
  const c = findCouple(id);
  return c ? coupleLabel(c) : '—';
}

function recalculateAdminSummary() {
  const rows = adminRowsFromForm();

  rows.forEach((row) => {
    const tr = document.querySelector(`#admin-results-body tr[data-couple-id="${CSS.escape(String(row.couple_id))}"]`);
    const rankCell = tr?.querySelector('.admin-rank');
    if (rankCell) rankCell.textContent = row.night_rank || '—';
  });

  const scored = rows.filter((r) => r.judges_score !== null);
  const maxScore = scored.length ? Math.max(...scored.map((r) => r.judges_score)) : null;
  const minScore = scored.length ? Math.min(...scored.map((r) => r.judges_score)) : null;
  const highest = maxScore === null ? [] : scored.filter((r) => r.judges_score === maxScore);
  const lowest = minScore === null ? [] : scored.filter((r) => r.judges_score === minScore);
  const eliminated = rows.filter((r) => r.was_eliminated);
  const perfect = rows.some((r) => r.got_perfect_score);

  const highestEl = document.getElementById('admin-highest-result');
  const lowestEl = document.getElementById('admin-lowest-result');
  const eliminatedEl = document.getElementById('admin-eliminated-result');
  const perfectEl = document.getElementById('admin-perfect-result');

  if (highestEl) highestEl.textContent = highest.length
    ? highest.map((r) => coupleNameById(r.couple_id)).join(' / ')
    : '—';

  if (lowestEl) lowestEl.textContent = lowest.length
    ? lowest.map((r) => coupleNameById(r.couple_id)).join(' / ')
    : '—';

  if (eliminatedEl) eliminatedEl.textContent = eliminated.length
    ? eliminated.map((r) => coupleNameById(r.couple_id)).join(' / ')
    : '—';

  if (perfectEl) perfectEl.textContent = scored.length ? (perfect ? 'YES' : 'NO') : '—';
}

async function loadAdminWeek() {
  const note = document.getElementById('admin-results-note');
  const status = document.getElementById('admin-week-status');
  const week = selectedAdminWeek();

  if (note) note.textContent = `Loading Week ${week}...`;

  const { data: rows, error: rowsError } = await db
    .from('couple_weekly_results')
    .select('*')
    .eq('week_number', week);

  if (rowsError) {
    if (note) note.textContent = `Could not load couple results: ${rowsError.message}`;
    return;
  }

  adminLoadedRows = rows || [];
  renderAdminRows(adminLoadedRows);

  const { data: summary, error: summaryError } = await db
    .from('weekly_results')
    .select('*')
    .eq('week_number', week)
    .maybeSingle();

  if (!summaryError && status) {
    status.textContent = summary?.results_finalized ? 'FINALIZED ✓' : 'Not finalized';
  }

  if (note) note.textContent = `Week ${week} loaded. Review, save a draft, or finalize when ready.`;
}

function chooseSinglePredictionCouple(rows, kind) {
  const scored = rows.filter((r) => r.judges_score !== null);
  if (!scored.length) return null;

  const target = kind === 'highest'
    ? Math.max(...scored.map((r) => r.judges_score))
    : Math.min(...scored.map((r) => r.judges_score));

  const matches = scored.filter((r) => r.judges_score === target);

  // Current weekly_results schema stores one couple. If a tie occurs,
  // the admin can review before finalizing; the first cast order is used.
  return matches[0]?.couple_id || null;
}

async function saveAdminWeek(finalize) {
  const note = document.getElementById('admin-results-note');
  const status = document.getElementById('admin-week-status');
  const week = selectedAdminWeek();
  const rows = adminRowsFromForm();

  const enteredRows = rows.filter((r) =>
    r.judges_score !== null ||
    r.got_perfect_score ||
    r.got_first_10_of_season ||
    r.challenge_win ||
    r.was_safe ||
    r.was_bottom_group ||
    r.was_eliminated ||
    r.made_semifinals ||
    r.made_finale ||
    r.final_placement !== null
  );

  if (!enteredRows.length) {
    if (note) note.textContent = '♡ Enter at least one result before saving.';
    return;
  }

  if (finalize && enteredRows.filter((r) => r.was_eliminated).length > 1) {
    if (note) note.textContent = '♡ More than one couple is marked eliminated. Review that before finalizing.';
    return;
  }

  if (note) note.textContent = finalize
    ? `Finalizing Week ${week}...`
    : `Saving Week ${week} draft...`;

  const { error: coupleError } = await db
    .from('couple_weekly_results')
    .upsert(enteredRows, { onConflict: 'week_number,couple_id' });

  if (coupleError) {
    if (note) note.textContent = `♡ Could not save couple results: ${coupleError.message}`;
    return;
  }

  const eliminated = enteredRows.find((r) => r.was_eliminated)?.couple_id || null;
  const weeklySummary = {
    week_number: week,
    highest_scoring_couple_id: chooseSinglePredictionCouple(enteredRows, 'highest'),
    lowest_scoring_couple_id: chooseSinglePredictionCouple(enteredRows, 'lowest'),
    eliminated_couple_id: eliminated,
    perfect_score_happened: enteredRows.some((r) => r.got_perfect_score),
    results_finalized: Boolean(finalize),
    updated_at: new Date().toISOString()
  };

  const { error: summaryError } = await db
    .from('weekly_results')
    .upsert(weeklySummary, { onConflict: 'week_number' });

  if (summaryError) {
    if (note) note.textContent = `♡ Couple results saved, but weekly summary failed: ${summaryError.message}`;
    return;
  }

  if (finalize) {
    const { error: scoreError } = await db.rpc('admin_recalculate_all_scores');

    if (scoreError) {
      if (note) note.textContent = `♡ Results finalized, but score calculation failed: ${scoreError.message}`;
      return;
    }

    if (status) status.textContent = 'FINALIZED ✓';
    if (note) note.textContent = `♡ Week ${week} finalized and everybody's scores were recalculated!`;
  } else {
    if (status) status.textContent = 'Draft saved';
    if (note) note.textContent = `♡ Week ${week} draft saved. Nothing has been scored yet.`;
  }
}


// Populate all couple dropdowns and photo previews from Supabase,
 // then load the user's saved account data and bracket.
(async () => {
  if (!seasonSettingsLoaded) await loadSeasonSettings();

  await loadCouples();

  // If the signed-in user is an admin, refresh the Results Center now that
  // couple names/photos are available.
  if (adminResultsInitialized) {
    renderAdminRows(adminLoadedRows);
  }

  // Refill bracket dropdowns explicitly after couples are available.
  document.querySelectorAll('.bracket-couple-select').forEach((select) => {
    fillCoupleSelect(select, 'Choose a couple');
  });

  refreshBracketOptions();
  await loadBracketFromSupabase();
  await loadWeeklyPicksFromSupabase();

  updateBracketUI();
  updateWeeklyPicksUI();
})();

if (picksForm) {
  picksForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const note = document.querySelector('#form-note');

    if (weeklyPicksDeadlinePassed()) {
      if (note) note.textContent = '♡ Weekly picks are locked for this week.';
      updateWeeklyPicksUI();
      return;
    }

    const highestSelect = document.querySelector('#highest-pick');
    const lowestSelect = document.querySelector('#lowest-pick');
    const eliminatedSelect = document.querySelector('#eliminated-pick');
    const perfectSelect = document.querySelector('#perfect-pick');

    const highest = highestSelect?.value || '';
    const lowest = lowestSelect?.value || '';
    const eliminated = eliminatedSelect?.value || '';
    const perfectValue = perfectSelect?.value || '';

    if (!highest || !lowest || !eliminated || !perfectValue) {
      if (note) note.textContent = '♡ Choose all three weekly picks before saving.';
      return;
    }

    const { data: userData, error: userError } = await db.auth.getUser();
    const user = userData?.user;

    if (userError || !user) {
      if (note) note.textContent = '♡ Please log in before saving weekly picks.';
      return;
    }

    if (note) note.textContent = 'Saving your weekly picks...';

    const row = {
      user_id: user.id,
      week_number: CURRENT_WEEK,
      highest_scoring_couple_id: highest,
      lowest_scoring_couple_id: lowest,
      eliminated_couple_id: eliminated,
      perfect_score: perfectValue === 'yes',
      locked_at: null,
      updated_at: new Date().toISOString()
    };

    const { data: saved, error } = await db
      .from('weekly_picks')
      .upsert(row, { onConflict: 'user_id,week_number' })
      .select('id, user_id, week_number, highest_scoring_couple_id, lowest_scoring_couple_id, eliminated_couple_id, perfect_score, locked_at, created_at, updated_at')
      .single();

    if (error) {
      console.error('Could not save weekly picks:', error);
      if (note) note.textContent = `♡ Could not save weekly picks: ${error.message}`;
      return;
    }

    currentWeeklyPickRow = saved;
    renderAccountPicksSummary(saved);
    if (note) note.textContent = `♡ Week ${CURRENT_WEEK} picks saved to your account!`;
  });
}
updateWeeklyPicksUI();
