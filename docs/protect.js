// Session check + logout. Add to every page that requires login.
// Do NOT add this to login.html.
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
  } else {
    document.body.style.visibility = 'visible';
  }
}
checkSession();

// Optional logout button (does nothing if the page has no #logout-btn)
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
});