// Login and registration logic (email + password and Google).
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const messageEl = document.getElementById('message');
const query = new URLSearchParams(window.location.search);
const returnPage = query.get('returnTo') === 'checklist.html'
  ? 'checklist.html'
  : 'home.html';
const returnUrl = new URL(returnPage, window.location.href).href;

document.querySelectorAll('[data-auth-link]').forEach((link) => {
  const url = new URL(link.href, window.location.href);
  if (returnPage === 'checklist.html') {
    url.searchParams.set('returnTo', returnPage);
  }
  link.href = url.href;
});

// If the user is already logged in, skip the login page
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (session) window.location.href = returnUrl;
});

document.getElementById('email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.textContent = '';

  if (e.currentTarget.dataset.authAction === 'signup') {
    if (!emailEl.value || passwordEl.value.length < 8) {
      messageEl.textContent = 'Enter an email and a password of at least 8 characters.';
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email: emailEl.value,
      password: passwordEl.value,
      options: {
        emailRedirectTo: returnUrl,
      },
    });
    if (error) {
      messageEl.textContent = error.message;
    } else if (data.session) {
      window.location.href = returnUrl;
    } else {
      messageEl.textContent = 'Check your email to confirm your account.';
    }
    return;
  }

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailEl.value,
    password: passwordEl.value,
  });
  if (error) {
    messageEl.textContent = error.message;
  } else {
    window.location.href = returnUrl;
  }
});

// Continue with Google
document.getElementById('google-btn')?.addEventListener('click', async () => {
  messageEl.textContent = '';
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: returnUrl,
    },
  });
  if (error) messageEl.textContent = error.message;
});
