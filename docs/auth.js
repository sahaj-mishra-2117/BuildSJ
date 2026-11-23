const messageEl = document.getElementById('message');

// If the user is already logged in, skip the login page
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'home.html';
});

// Continue with Google
document.getElementById('google-btn').addEventListener('click', async () => {
  messageEl.textContent = '';
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/home.html',
    },
  });
  if (error) messageEl.textContent = error.message;
});