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

function showAuthMessage(message, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#b00020" : "#111";
}
function showLoggedIn() {
  if (authArea) authArea.style.display = "none";
  if (profileArea) profileArea.style.display = "block";
}
function showLoggedOut() {
  if (authArea) authArea.style.display = "block";
  if (profileArea) profileArea.style.display = "none";
}
async function loadProfile() {
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError || !user) { showLoggedOut(); return; }
  const { data: profile, error } = await db.from("profiles")
    .select("display_name, team_name, total_points")
    .eq("id", user.id).single();
  if (error) { console.error(error); showAuthMessage("Could not load your profile.", true); return; }
  if (profileName) profileName.textContent = profile.display_name || "Ballroom Player";
  if (profileTeam) profileTeam.textContent = profile.team_name || "Unnamed Team";
  if (profilePoints) profilePoints.textContent = profile.total_points ?? 0;
  showLoggedIn();
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
let couples = [];

function coupleLabel(couple) {
  const celebrity = couple.celebrity_name ?? couple.celebrity ?? couple.star_name ?? couple.star ?? '';
  const pro = couple.pro_name ?? couple.pro ?? couple.dancer_name ?? couple.dancer ?? '';
  if (celebrity && pro) return `${celebrity} + ${pro}`;
  return couple.couple_name ?? couple.name ?? couple.display_name ?? `Couple ${couple.id ?? ''}`.trim();
}

function couplePhoto(couple) {
  return couple.photo_url ?? couple.image_url ?? couple.photo ?? couple.image ?? '';
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
  const { data, error } = await db.from('couples').select('*');
  if (error) {
    console.error('Could not load couples:', error);
    if (teamNote) teamNote.textContent = 'Could not load the couples from Supabase.';
    return;
  }

  couples = (data || [])
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
  restoreTeamSelections();
  restoreSavedPicks();
}

const teamForm = document.querySelector('#team-form');
const teamNote = document.querySelector('#team-note');
const savedTeamName = document.querySelector('#saved-team-name');
const savedPlayerName = document.querySelector('#saved-player-name');
const savedCouples = document.querySelector('#saved-couples');
const clearTeamButton = document.querySelector('#clear-team');

function normalizeSavedCouple(item) {
  if (item && typeof item === 'object') return item;
  const match = couples.find((couple) => coupleLabel(couple) === item);
  return match ? { id: String(match.id), label: coupleLabel(match), photo_url: couplePhoto(match) } : { id: '', label: String(item || ''), photo_url: '' };
}

function renderTeam(team) {
  if (!savedTeamName || !savedPlayerName || !savedCouples) return;
  if (!team) {
    savedTeamName.textContent = 'NO TEAM YET ♡';
    savedPlayerName.textContent = 'Create your lineup to get started.';
    savedCouples.innerHTML = '<li>—</li><li>—</li><li>—</li><li>—</li>';
    return;
  }

  savedTeamName.textContent = (team.teamName || 'Unnamed Team').toUpperCase();
  savedPlayerName.textContent = `Managed by ${team.playerName || 'Ballroom Player'}`;
  savedCouples.innerHTML = '';

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

function loadSavedTeam() {
  try {
    const raw = localStorage.getItem('veraBallroomTeam');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function restoreTeamSelections() {
  const existingTeam = loadSavedTeam();
  renderTeam(existingTeam);
  if (!existingTeam || !teamForm) return;

  document.querySelector('#player-name').value = existingTeam.playerName || '';
  document.querySelector('#team-name').value = existingTeam.teamName || '';

  (existingTeam.couples || []).forEach((saved, i) => {
    const select = document.querySelector(`#couple-${i + 1}`);
    if (!select) return;
    const item = normalizeSavedCouple(saved);
    if (item.id) select.value = String(item.id);
    renderCouplePreview(i + 1);
  });
}

[1,2,3,4].forEach((n) => {
  const select = document.querySelector(`#couple-${n}`);
  if (select) select.addEventListener('change', () => renderCouplePreview(n));
});

if (teamForm) {
  teamForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!teamForm.checkValidity()) {
      teamForm.reportValidity();
      return;
    }

    const selectedIds = [1,2,3,4].map((n) => document.querySelector(`#couple-${n}`).value);
    if (new Set(selectedIds).size !== selectedIds.length) {
      teamNote.textContent = '♡ Choose four different couples for your lineup.';
      return;
    }

    const selectedCouples = selectedIds.map((id) => {
      const couple = findCouple(id);
      return {
        id: String(couple.id),
        label: coupleLabel(couple),
        photo_url: couplePhoto(couple)
      };
    });

    const team = {
      playerName: document.querySelector('#player-name').value.trim(),
      teamName: document.querySelector('#team-name').value.trim(),
      couples: selectedCouples
    };

    localStorage.setItem('veraBallroomTeam', JSON.stringify(team));
    renderTeam(team);
    teamNote.textContent = '♡ Your team is saved!';
  });
}

if (clearTeamButton) {
  clearTeamButton.addEventListener('click', () => {
    localStorage.removeItem('veraBallroomTeam');
    if (teamForm) teamForm.reset();
    [1,2,3,4].forEach((n) => renderCouplePreview(n));
    renderTeam(null);
    if (teamNote) teamNote.textContent = 'Your saved team has been cleared.';
  });
}

const picksForm = document.querySelector('#picks-form');
const note = document.querySelector('#form-note');

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
}

if (picksForm && note) {
  picksForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!picksForm.checkValidity()) {
      picksForm.reportValidity();
      return;
    }

    const picks = {
      highest: document.querySelector('#highest-pick').value,
      eliminated: document.querySelector('#eliminated-pick').value,
      perfect: document.querySelector('#perfect-pick').value
    };
    localStorage.setItem('veraWeeklyPicks', JSON.stringify(picks));
    note.textContent = '♡ Your weekly picks are saved!';
  });
}

// Populate all couple dropdowns and photo previews from Supabase.
loadCouples();
