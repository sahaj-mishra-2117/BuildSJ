// Login logic (email + password, and Google). Used only on login.html.
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const messageEl = document.getElementById('message');

// If the user is already logged in, skip the login page
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = 'home.html';
});

// Sign up with email
document.getElementById('signup-btn').addEventListener('click', async () => {
  messageEl.textContent = '';
  if (!emailEl.value || passwordEl.value.length < 6) {
    messageEl.textContent = 'Enter an email and a password of at least 6 characters.';
    return;
  }
  const { data, error } = await supabaseClient.auth.signUp({
    email: emailEl.value,
    password: passwordEl.value,
    options: {
      emailRedirectTo: window.location.origin + '/home.html',
    },
  });
  if (error) {
    messageEl.textContent = error.message;
  } else if (data.session) {
    // Email confirmation is off, so the user is logged in immediately
    window.location.href = 'home.html';
  } else {
    messageEl.textContent = 'Check your email to confirm your account.';
  }
});

// Log in with email
document.getElementById('email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.textContent = '';
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailEl.value,
    password: passwordEl.value,
  });
  if (error) {
    messageEl.textContent = error.message;
  } else {
    window.location.href = 'home.html';
  }
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