const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const accountBtn = document.getElementById('account-btn');

function updateButtons(session) {
  if (loginBtn) loginBtn.hidden = !!session;
  if (logoutBtn) logoutBtn.hidden = !session;
  if (accountBtn) accountBtn.hidden = !session;
}

// Set the buttons on page load
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  updateButtons(session);
});

// Keep them in sync if login state changes
supabaseClient.auth.onAuthStateChange((_event, session) => {
  updateButtons(session);
});

// Log out
logoutBtn?.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'home.html';
});
function openPopup() {
  document.getElementById("popup").style.display = "flex";
}

function closePopup() {
  document.getElementById("popup").style.display = "none";
}