// Login and signup logic. Used only on login.html.
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const messageEl = document.getElementById('message');

// If the user is already logged in, skip the login page
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'index.html';
});

// Sign up
document.getElementById('signup-btn').addEventListener('click', async () => {
  messageEl.textContent = '';
  const { error } = await supabaseClient.auth.signUp({
    email: emailEl.value,
    password: passwordEl.value,
    options: {
      emailRedirectTo: window.location.origin + '/index.html',
    },
  });
  messageEl.textContent = error
    ? error.message
    : 'Check your email to confirm your account.';
});

// Log in
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.textContent = '';
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailEl.value,
    password: passwordEl.value,
  });
  if (error) {
    messageEl.textContent = error.message;
  } else {
    window.location.href = 'index.html';
  }
});