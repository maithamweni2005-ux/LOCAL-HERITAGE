// =============================================
// SUPABASE CLIENT INITIALIZATION
// =============================================
const SUPABASE_URL = 'https://kxtvbokjihzmkabmpkre.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DG92Z-1xBSfVwoLQ4XDSpw_9gwOxPIs';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  const forgotSection = document.getElementById('forgotSection');

  const goToRegisterBtn = document.getElementById('goToRegisterBtn');
  const goToLoginBtn = document.getElementById('goToLoginBtn');
  const goToForgotBtn = document.getElementById('goToForgotBtn');
  const backToLoginFromForgotBtn = document.getElementById('backToLoginFromForgotBtn');

  const messageEl = document.getElementById('authMessage');

  if (goToRegisterBtn) {
    goToRegisterBtn.addEventListener('click', () => {
      if (loginSection) loginSection.classList.add('hidden');
      if (forgotSection) forgotSection.classList.add('hidden');
      if (registerSection) registerSection.classList.remove('hidden');
      if (messageEl) messageEl.innerHTML = '';
    });
  }

  if (goToLoginBtn) {
    goToLoginBtn.addEventListener('click', () => {
      if (registerSection) registerSection.classList.add('hidden');
      if (forgotSection) forgotSection.classList.add('hidden');
      if (loginSection) loginSection.classList.remove('hidden');
      if (messageEl) messageEl.innerHTML = '';
    });
  }

  if (goToForgotBtn) {
    goToForgotBtn.addEventListener('click', () => {
      if (loginSection) loginSection.classList.add('hidden');
      if (registerSection) registerSection.classList.add('hidden');
      if (forgotSection) forgotSection.classList.remove('hidden');
      if (messageEl) messageEl.innerHTML = '';
    });
  }

  if (backToLoginFromForgotBtn) {
    backToLoginFromForgotBtn.addEventListener('click', () => {
      if (forgotSection) forgotSection.classList.add('hidden');
      if (registerSection) registerSection.classList.add('hidden');
      if (loginSection) loginSection.classList.remove('hidden');
      if (messageEl) messageEl.innerHTML = '';
    });
  }

  // --- LOGIN ---
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginBtn = document.getElementById('loginBtn');
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';

        const { error } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;

        const { data: userData, error: userError } = await supabaseClient
          .from('users')
          .select('role')
          .eq('email', email)
          .maybeSingle();

        if (userError) throw userError;

        redirectByRole(userData?.role || 'customer');
      } catch (err) {
        showMessage(messageEl, err.message, 'error');
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
      }
    });
  }

  // --- REGISTER ---
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const registerBtn = document.getElementById('registerBtn');

      const firstName = document.getElementById('register-first-name').value.trim();
      const lastName = document.getElementById('register-last-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const phone = document.getElementById('register-phone').value.trim();
      const password = document.getElementById('register-password').value;
      const role = document.getElementById('register-role').value;

      try {
        registerBtn.disabled = true;
        registerBtn.textContent = 'Creating account...';

        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email,
          password
        });
        if (authError) throw authError;

        const authUserId = authData.user ? authData.user.id : null;
        if (!authUserId) throw new Error('Sign up failed. Please check your credentials.');

        const { data: userData, error: userInsertError } = await supabaseClient
          .from('users')
          .insert([{
            id: authUserId,
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone_number: phone,
            role: role,
            password_hash: 'handled_by_auth'
          }])
          .select();

        if (userInsertError) throw userInsertError;

        if (role === 'artisan') {
          const artisanUserId = (userData && userData[0]?.id) ? userData[0].id : authUserId;
          const { error: artisanError } = await supabaseClient
            .from('artisans')
            .insert([{
              user_id: artisanUserId,
              business_name: `${firstName} ${lastName}'s Workshop`,
              bio: '',
              craft_category: '',
              location: ''
            }]);

          if (artisanError) throw artisanError;
        }

        showMessage(messageEl, 'Registration successful! Opening dashboard...', 'success');
        setTimeout(() => {
          redirectByRole(role);
        }, 1000);
      } catch (err) {
        showMessage(messageEl, err.message, 'error');
      } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Create Account';
      }
    });
  }

  // --- FORGOT PASSWORD ---
  const forgotForm = document.getElementById('forgotForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resetBtn = document.getElementById('resetBtn');
      const email = document.getElementById('forgot-email').value.trim();

      try {
        resetBtn.disabled = true;
        resetBtn.textContent = 'Sending link...';

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/index.html?reset=true`
        });

        if (error) throw error;
        showMessage(messageEl, 'Password reset link sent! Check your email.', 'success');
      } catch (err) {
        showMessage(messageEl, err.message, 'error');
      } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = 'Reset Password';
      }
    });
  }
});

// =============================================
// HELPERS & SESSION MANAGEMENT
// =============================================
function showMessage(el, message, type) {
  if (el) {
    el.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
  }
}

function redirectByRole(role) {
  if (role === 'admin') {
    window.location.href = 'admin.html';
  } else if (role === 'artisan') {
    window.location.href = 'dashboard.html?mode=artisan';
  } else {
    window.location.href = 'dashboard.html?mode=customer';
  }
}

async function checkAuth() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
      const { data: userData } = await supabaseClient
        .from('users')
        .select('role')
        .eq('email', session.user.email)
        .maybeSingle();

      if (userData && userData.role) {
        redirectByRole(userData.role);
      }
    }
  } catch (err) {
    console.warn('Auth check failed:', err.message);
  }
}

const currentPath = window.location.pathname;
if (currentPath.endsWith('index.html') || currentPath === '/' || currentPath === '') {
  checkAuth();
}

async function logout() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (!error) {
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error('Logout error:', err.message);
    window.location.href = 'index.html';
  }
}

async function getCurrentUser() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session || !session.user) return null;

    const { data: userData, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .maybeSingle();

    if (error) throw error;
    return userData;
  } catch (err) {
    console.error('getCurrentUser error:', err.message);
    return null;
  }
}

async function getCurrentArtisan() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data: artisanData, error } = await supabaseClient
      .from('artisans')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return artisanData;
  } catch (err) {
    console.error('getCurrentArtisan error:', err.message);
    return null;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}