const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const messageEl = document.getElementById('message');

document.getElementById('signup-btn').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signUp({
    email: emailEl.value,
    password: passwordEl.value,
  });
  messageEl.textContent = error
    ? error.message
    : 'Check your email to confirm your account.';
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailEl.value,
    password: passwordEl.value,
  });
  if (error) {
    messageEl.textContent = error.message;
  } else {
    window.location.href = 'dashboard.html';
  }
});