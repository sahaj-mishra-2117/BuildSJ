const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const accountBtn = document.getElementById('account-btn');
const accountEmail = document.getElementById('account-email');
const accountAvatar = document.getElementById('account-avatar');

function updateButtons(session) {
  if (loginBtn) loginBtn.hidden = !!session;
  if (signupBtn) signupBtn.hidden = !!session;
  if (logoutBtn) logoutBtn.hidden = !session;
  if (accountBtn) accountBtn.hidden = !session;

  const email = session?.user?.email;
  if (accountEmail) {
    accountEmail.textContent = email || 'Signed in';
  }
  if (accountAvatar) {
    accountAvatar.textContent = email ? email.trim().charAt(0).toUpperCase() : 'B';
  }
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

const popup = document.getElementById("popup");
popup?.addEventListener("click", (event) => {
  if (event.target === popup) closePopup();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && popup?.style.display === "flex") {
    closePopup();
  }
});