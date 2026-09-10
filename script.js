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

// Easy-to-change season settings. We'll move these to an admin setting later.
const CURRENT_WEEK = 1;
const REROLL_OPEN_AFTER_WEEK = 5;
const LOYALTY_BONUS_POINTS = 20;

let currentTeamRow = null;

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
  renderAccountPicksSummary();

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
  if (session?.user) setTimeout(loadProfile, 0);
  else showLoggedOut();
});
loadProfile();

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

  [1,2,3,4].forEach((n) => renderCouplePreview(n));
  couplesLoaded = true;
  await loadUserTeamFromSupabase();
  restoreSavedPicks();
  renderAccountPicksSummary();
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


function rerollIsOpen() {
  return CURRENT_WEEK > REROLL_OPEN_AFTER_WEEK;
}

function setCoupleSelectsDisabled(disabled) {
  [1,2,3,4].forEach((n) => {
    const select = document.querySelector(`#couple-${n}`);
    if (select) select.disabled = disabled;
  });
}

function updateTeamLockUI(saved = currentTeamRow) {
  const hasLockedTeam = Boolean(saved?.locked_at);
  const rerollAvailable = hasLockedTeam && !saved?.reroll_used && rerollIsOpen();
  const finalLocked = hasLockedTeam && Boolean(saved?.reroll_used);

  if (!teamLockStatus || !teamSubmitBtn) return;

  teamLockStatus.classList.remove('is-locked', 'is-reroll');

  if (!hasLockedTeam) {
    setCoupleSelectsDisabled(false);
    teamSubmitBtn.disabled = false;
    teamSubmitBtn.textContent = 'LOCK IN MY TEAM ♡';
    if (teamLockTitle) teamLockTitle.textContent = 'BUILD YOUR ORIGINAL FOUR';
    if (teamLockCopy) {
      teamLockCopy.textContent =
        `Choose your four couples, then lock them in. Your lineup stays frozen through Week ${REROLL_OPEN_AFTER_WEEK}.`;
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
  if (select) select.addEventListener('change', () => renderCouplePreview(n));
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

const picksForm = document.querySelector('#picks-form');
const note = document.querySelector('#form-note');


function renderAccountPicksSummary(picks = null) {
  const summary = document.getElementById('account-picks-summary');
  if (!summary) return;

  if (!picks) {
    try {
      picks = JSON.parse(localStorage.getItem('veraWeeklyPicks') || 'null');
    } catch (_) {
      picks = null;
    }
  }

  if (!picks) {
    summary.innerHTML = '<p>No weekly picks saved yet.</p>';
    return;
  }

  const highestCouple = findCouple(picks.highest);
  const eliminatedCouple = findCouple(picks.eliminated);

  const highestLabel =
    picks.highest_label ||
    (highestCouple ? coupleLabel(highestCouple) : picks.highest || '—');

  const eliminatedLabel =
    picks.eliminated_label ||
    (eliminatedCouple ? coupleLabel(eliminatedCouple) : picks.eliminated || '—');

  summary.innerHTML = `
    <div class="account-pick-row">
      <span>Highest scoring</span>
      <strong>${highestLabel}</strong>
    </div>
    <div class="account-pick-row">
      <span>Eliminated</span>
      <strong>${eliminatedLabel}</strong>
    </div>
    <div class="account-pick-row">
      <span>Perfect score?</span>
      <strong>${picks.perfect || '—'}</strong>
    </div>
  `;
}

function loadPicks() {
  try {
    return JSON.parse(localStorage.getItem('veraWeeklyPicks') || 'null');
  } catch {
    return null;
  }
}

function restoreSavedPicks() {
  const savedPicks = loadPicks();
  if (!savedPicks) return;
  const highest = document.querySelector('#highest-pick');
  const eliminated = document.querySelector('#eliminated-pick');
  const perfect = document.querySelector('#perfect-pick');
  if (highest) highest.value = savedPicks.highest || '';
  if (eliminated) eliminated.value = savedPicks.eliminated || '';
  if (perfect) perfect.value = savedPicks.perfect || '';
  if (note) note.textContent = '♡ Your saved picks are loaded.';
  renderAccountPicksSummary(savedPicks);
}

if (picksForm && note) {
  picksForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!picksForm.checkValidity()) {
      picksForm.reportValidity();
      return;
    }

    const highestSelect = document.querySelector('#highest-pick');
    const eliminatedSelect = document.querySelector('#eliminated-pick');
    const perfectSelect = document.querySelector('#perfect-pick');

    const picks = {
      highest: highestSelect.value,
      highest_label: highestSelect.options[highestSelect.selectedIndex]?.text || '',
      eliminated: eliminatedSelect.value,
      eliminated_label: eliminatedSelect.options[eliminatedSelect.selectedIndex]?.text || '',
      perfect: perfectSelect.value
    };
    localStorage.setItem('veraWeeklyPicks', JSON.stringify(picks));
    note.textContent = '♡ Your weekly picks are saved!';
    renderAccountPicksSummary(picks);
  });
}

// Populate all couple dropdowns and photo previews from Supabase.
loadCouples();
