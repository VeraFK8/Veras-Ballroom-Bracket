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

// Replace these placeholder names with the real cast when you are ready.
const couples = [
  'Celebrity 1 + Pro 1',
  'Celebrity 2 + Pro 2',
  'Celebrity 3 + Pro 3',
  'Celebrity 4 + Pro 4',
  'Celebrity 5 + Pro 5',
  'Celebrity 6 + Pro 6',
  'Celebrity 7 + Pro 7',
  'Celebrity 8 + Pro 8',
  'Celebrity 9 + Pro 9',
  'Celebrity 10 + Pro 10'
];

function fillCoupleSelect(select) {
  if (!select) return;
  couples.forEach((couple) => {
    const option = document.createElement('option');
    option.value = couple;
    option.textContent = couple;
    select.appendChild(option);
  });
}

document.querySelectorAll('.couple-select, .pick-couple-select').forEach(fillCoupleSelect);

const teamForm = document.querySelector('#team-form');
const teamNote = document.querySelector('#team-note');
const savedTeamName = document.querySelector('#saved-team-name');
const savedPlayerName = document.querySelector('#saved-player-name');
const savedCouples = document.querySelector('#saved-couples');
const clearTeamButton = document.querySelector('#clear-team');

function renderTeam(team) {
  if (!savedTeamName || !savedPlayerName || !savedCouples) return;
  if (!team) {
    savedTeamName.textContent = 'NO TEAM YET ♡';
    savedPlayerName.textContent = 'Create your lineup to get started.';
    savedCouples.innerHTML = '<li>—</li><li>—</li><li>—</li><li>—</li>';
    return;
  }
  savedTeamName.textContent = team.teamName.toUpperCase();
  savedPlayerName.textContent = `Managed by ${team.playerName}`;
  savedCouples.innerHTML = '';
  team.couples.forEach((couple) => {
    const li = document.createElement('li');
    li.textContent = couple;
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

const existingTeam = loadSavedTeam();
renderTeam(existingTeam);

if (existingTeam && teamForm) {
  document.querySelector('#player-name').value = existingTeam.playerName || '';
  document.querySelector('#team-name').value = existingTeam.teamName || '';
  existingTeam.couples.forEach((couple, i) => {
    const select = document.querySelector(`#couple-${i + 1}`);
    if (select) select.value = couple;
  });
}

if (teamForm) {
  teamForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!teamForm.checkValidity()) {
      teamForm.reportValidity();
      return;
    }

    const selected = [1,2,3,4].map((n) => document.querySelector(`#couple-${n}`).value);
    if (new Set(selected).size !== selected.length) {
      teamNote.textContent = '♡ Choose four different couples for your lineup.';
      return;
    }

    const team = {
      playerName: document.querySelector('#player-name').value.trim(),
      teamName: document.querySelector('#team-name').value.trim(),
      couples: selected
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

const savedPicks = loadPicks();
if (savedPicks) {
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
