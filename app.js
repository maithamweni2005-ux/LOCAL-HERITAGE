// =============================================
// SUPABASE INITIALIZATION
// =============================================
const SUPABASE_URL = 'https://kxtvbokjihzmkabmpkre.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DG92Z-1xBSfVwoLQ4XDSpw_9gwOxPIs';

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
// DOM CONTENT LOADED (Toggle Views, Login, Register)
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  const goToRegisterBtn = document.getElementById('goToRegisterBtn');
  const goToLoginBtn = document.getElementById('goToLoginBtn');
  const messageEl = document.getElementById('authMessage');

  // Switch between Login and Register sections
  if (goToRegisterBtn) {
    goToRegisterBtn.addEventListener('click', () => {
      loginSection.classList.add('hidden');
      registerSection.classList.remove('hidden');
      if (messageEl) messageEl.innerText = '';
    });
  }

  if (goToLoginBtn) {
    goToLoginBtn.addEventListener('click', () => {
      registerSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
      if (messageEl) messageEl.innerText = '';
    });
  }

  // --- LOGIN HANDLER ---
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
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

        if (userData && userData.role) {
          redirectByRole(userData.role);
        } else {
          redirectByRole('customer');
        }
      } catch (err) {
        showMessage(messageEl, err.message, 'error');
      }
    });
  }

  // --- REGISTER HANDLER ---
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const firstName = document.getElementById('register-first-name').value.trim();
      const lastName = document.getElementById('register-last-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const phone = document.getElementById('register-phone').value.trim();
      const password = document.getElementById('register-password').value;
      const role = document.getElementById('register-role').value;

      try {
        // 1. Create auth user
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email,
          password
        });

        if (authError) throw authError;

        const authUserId = authData.user ? authData.user.id : null;
        if (!authUserId) throw new Error('Sign up failed. Please check your credentials.');

        // 2. Create user record in custom users table
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

        // 3. If artisan, create artisan profile
        if (role === 'artisan') {
          const artisanUserId = (userData && userData[0]?.id) ? userData[0].id : authUserId;

          const { error: artisanError } = await supabaseClient
            .from('artisans')
            .insert([{
              user_id: artisanUserId,
              business_name: `${firstName} ${lastName}'s Business`,
              bio: '',
              craft_category: '',
              location: ''
            }]);

          if (artisanError) throw artisanError;
        }

        showMessage(messageEl, 'Registration successful! Logging you in...', 'success');
        setTimeout(() => {
          redirectByRole(role);
        }, 1500);
      } catch (err) {
        showMessage(messageEl, err.message, 'error');
      }
    });
  }
});

// =============================================
// UTILITY FUNCTIONS
// =============================================
function showMessage(el, message, type) {
  if (el) {
    el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
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

// =============================================
// AUTH STATE & HELPERS
// =============================================
async function checkAuth() {
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
}

if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
  checkAuth();
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (!error) {
    window.location.href = 'index.html';
  }
}

async function getCurrentUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const { data: userData } = await supabaseClient
    .from('users')
    .select('*')
    .eq('email', session.user.email)
    .maybeSingle();

  return userData;
}

async function getCurrentArtisan() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: artisanData } = await supabaseClient
    .from('artisans')
    .select('*')
    .eq('user_id', user.id || user.user_id)
    .maybeSingle();

  return artisanData;
}