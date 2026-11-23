// Shows "Log In" when signed out and "Log Out" when signed in.
// Add to any public page that has the buttons (e.g. home.html).
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

function updateButtons(session) {
  if (loginBtn) loginBtn.hidden = !!session;
  if (logoutBtn) logoutBtn.hidden = !session;
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