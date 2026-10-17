// =============================================
// ADMIN GLOBAL STATE
// =============================================
let currentAdmin = null;
let allUsers = [];
let allArtisans = [];
let allSites = [];
let allReviews = [];
let allBookings = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  await initializeAdmin();
  setupAdminNavigation();
  setupMobileDrawer();
  setupAdminLogout();
  setupModals();
});

// =============================================
// INITIALIZATION
// =============================================
async function initializeAdmin() {
  try {
    currentAdmin = await getCurrentUser();

    if (!currentAdmin || currentAdmin.role !== 'admin') {
      window.location.href = 'index.html';
      return;
    }

    const adminNameBadge = document.getElementById('adminNameBadge');
    if (adminNameBadge) {
      adminNameBadge.textContent = `${currentAdmin.first_name} ${currentAdmin.last_name}`;
    }

    await Promise.all([
      loadAllUsers(),
      loadAllArtisans(),
      loadAllSites(),
      loadAllBookings(),
      loadAllReviews(),
      loadAnalytics()
    ]);

    setupSearchAndFilters();
  } catch (err) {
    console.error('Admin init error:', err);
  }
}

// =============================================
// NAVIGATION & VIEW SWITCHING
// =============================================
function setupAdminNavigation() {
  const titles = {
    users: { title: 'User Accounts', sub: 'Manage registered customers, artisans, and credentials' },
    artisans: { title: 'Registered Artisans', sub: 'Oversee verified workshops, locations, and crafts' },
    sites: { title: 'Tourist Destinations', sub: 'Inspect, edit descriptions, or remove cultural sites' },
    bookings: { title: 'Bookings & Visits', sub: 'Monitor visits, attendee counts, and fee payments' },
    reviews: { title: 'Community Feedback', sub: 'Audit star ratings and user feedback' },
    analytics: { title: 'Platform Analytics', sub: 'Activity counts and aggregate performance metrics' }
  };

  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;

      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      const activeSec = document.getElementById(section);
      if (activeSec) activeSec.classList.add('active');

      if (titles[section]) {
        document.getElementById('adminPageTitle').textContent = titles[section].title;
        document.getElementById('adminPageSub').textContent = titles[section].sub;
      }

      const sidebar = document.getElementById('adminSidebar');
      if (sidebar) sidebar.classList.remove('open');

      if (section === 'users') loadAllUsers();
      if (section === 'artisans') loadAllArtisans();
      if (section === 'sites') loadAllSites();
      if (section === 'bookings') loadAllBookings();
      if (section === 'reviews') loadAllReviews();
      if (section === 'analytics') loadAnalytics();
    });
  });
}

function setupMobileDrawer() {
  const btn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('adminSidebar');
  if (btn && sidebar) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// =============================================
// USERS MANAGEMENT
// =============================================
async function loadAllUsers() {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allUsers = data || [];
    renderUsersTable(allUsers);
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-td">No user accounts found.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => {
    const fullName = escapeHtml(`${user.first_name || ''} ${user.last_name || ''}`);
    const email = escapeHtml(user.email || '');
    const userId = user.id || user.user_id;

    return `
      <tr>
        <td>
          <strong>${fullName}</strong>
          <div class="muted-sub">${email}</div>
        </td>
        <td><span class="badge badge-${user.role}">${user.role}</span></td>
        <td>${escapeHtml(user.phone_number || '-')}</td>
        <td>${new Date(user.created_at).toLocaleDateString()}</td>
        <td>
          <div class="btn-action-group">
            <button class="btn-action" title="Send Message" onclick="openAdminMsgModal('${userId}', '${fullName}', '${user.role}')">
              <i data-lucide="mail"></i>
            </button>
            <button class="btn-action" title="Reset Password" onclick="openResetPasswordModal('${email}', '${fullName}')">
              <i data-lucide="key"></i>
            </button>
            ${user.role !== 'admin' ? `
              <button class="btn-action btn-danger" title="Remove User" onclick="deleteUser('${userId}', '${user.role}')">
                <i data-lucide="trash-2"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.deleteUser = async function(userId, role) {
  if (!confirm(`Are you sure you want to remove this ${role}?`)) return;

  try {
    const { error } = await supabaseClient.from('users').delete().eq('id', userId);
    if (error) throw error;

    alert('User successfully removed.');
    await loadAllUsers();
    await loadAllArtisans();
    await loadAnalytics();
  } catch (err) {
    alert(`Failed to remove user: ${err.message}`);
  }
};

// =============================================
// ARTISANS MANAGEMENT
// =============================================
async function loadAllArtisans() {
  try {
    const { data, error } = await supabaseClient
      .from('artisans')
      .select('*, users(first_name, last_name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allArtisans = data || [];
    renderArtisansTable(allArtisans);
  } catch (err) {
    console.error('Error loading artisans:', err);
  }
}

function renderArtisansTable(artisans) {
  const tbody = document.getElementById('artisansTableBody');
  if (!tbody) return;

  if (!artisans || artisans.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="loading-td">No registered artisans found.</td></tr>';
    return;
  }

  tbody.innerHTML = artisans.map(artisan => {
    const ownerName = artisan.users ? `${artisan.users.first_name} ${artisan.users.last_name}` : 'N/A';
    const artisanUserId = artisan.user_id;

    return `
      <tr>
        <td><strong>${escapeHtml(artisan.business_name)}</strong></td>
        <td>${escapeHtml(ownerName)}</td>
        <td>${escapeHtml(artisan.craft_category || '-')}</td>
        <td>${escapeHtml(artisan.location || 'Kenya')}</td>
        <td>
          <div class="btn-action-group">
            <button class="btn-action" title="Send Message" onclick="openAdminMsgModal('${artisanUserId}', '${escapeHtml(artisan.business_name)}', 'artisan')">
              <i data-lucide="mail"></i>
            </button>
            <button class="btn-action btn-danger" title="Remove Artisan" onclick="deleteArtisan('${artisan.id}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.deleteArtisan = async function(artisanId) {
  if (!confirm('Are you sure you want to remove this artisan?')) return;
  try {
    const { error } = await supabaseClient.from('artisans').delete().eq('id', artisanId);
    if (error) throw error;

    alert('Artisan profile deleted.');
    await loadAllArtisans();
    await loadAllSites();
    await loadAnalytics();
  } catch (err) {
    alert(`Failed to delete artisan: ${err.message}`);
  }
};

// =============================================
// SITES MANAGEMENT
// =============================================
async function loadAllSites() {
  try {
    const { data, error } = await supabaseClient
      .from('tourist_sites')
      .select('*, artisans(business_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allSites = data || [];
    renderSitesTable(allSites);
  } catch (err) {
    console.error('Error loading sites:', err);
  }
}

function renderSitesTable(sites) {
  const tbody = document.getElementById('sitesTableBody');
  if (!tbody) return;

  if (!sites || sites.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-td">No tourist sites found.</td></tr>';
    return;
  }

  tbody.innerHTML = sites.map(site => {
    const siteTitle = escapeHtml(site.title || site.name);
    const artisanName = site.artisans?.business_name || 'Artisan Host';

    return `
      <tr>
        <td><strong>${siteTitle}</strong></td>
        <td>${escapeHtml(artisanName)}</td>
        <td>${escapeHtml(site.location || 'Kenya')}</td>
        <td>KES ${parseFloat(site.entry_fee || 0).toLocaleString()}</td>
        <td>${new Date(site.created_at).toLocaleDateString()}</td>
        <td>
          <div class="btn-action-group">
            <button class="btn-action" title="Edit Site" onclick="openAdminEditSiteModal('${site.id}')">
              <i data-lucide="edit-3"></i>
            </button>
            <button class="btn-action btn-danger" title="Delete Site" onclick="adminDeleteSite('${site.id}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.openAdminEditSiteModal = function(siteId) {
  const site = allSites.find(s => s.id === siteId);
  if (!site) return;

  document.getElementById('edit-site-id').value = site.id;
  document.getElementById('edit-site-title').value = site.title || site.name || '';
  document.getElementById('edit-site-desc').value = site.description || '';
  document.getElementById('edit-site-location').value = site.location || '';
  document.getElementById('edit-site-fee').value = site.entry_fee || 0;

  document.getElementById('adminEditSiteModal').classList.remove('hidden');
};

window.adminDeleteSite = async function(siteId) {
  if (!confirm('Are you sure you want to delete this tourist destination?')) return;
  try {
    const { error } = await supabaseClient.from('tourist_sites').delete().eq('id', siteId);
    if (error) throw error;

    alert('Site deleted successfully.');
    await loadAllSites();
    await loadAnalytics();
  } catch (err) {
    alert(`Failed to delete site: ${err.message}`);
  }
};

// =============================================
// BOOKINGS MANAGEMENT (FIXED DELETION)
// =============================================
async function loadAllBookings() {
  try {
    const { data, error } = await supabaseClient
      .from('bookings')
      .select('*, tourist_sites(title), users(first_name, last_name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allBookings = data || [];
    renderBookingsTable(allBookings);
  } catch (err) {
    console.error('Bookings load note:', err);
  }
}

function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  if (!bookings || bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-td">No bookings recorded yet.</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const custName = b.users ? `${b.users.first_name} ${b.users.last_name}` : 'Customer';
    const siteName = b.tourist_sites?.title || 'Heritage Site';

    return `
      <tr>
        <td><strong>${escapeHtml(custName)}</strong></td>
        <td>${escapeHtml(siteName)}</td>
        <td>${b.visit_date || 'Upcoming'}</td>
        <td>${b.visitors || 1} Person(s)</td>
        <td>KES ${parseFloat(b.total_amount || 0).toLocaleString()}</td>
        <td><span class="badge badge-${b.status || 'confirmed'}">${b.status || 'Confirmed'}</span></td>
        <td>
          <div class="btn-action-group">
            <button class="btn-action" title="Mark Completed" onclick="updateBookingStatus('${b.id}', 'completed')">
              <i data-lucide="check"></i>
            </button>
            <button class="btn-action btn-danger" title="Delete Booking" onclick="adminDeleteBooking('${b.id}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.updateBookingStatus = async function(bookingId, newStatus) {
  try {
    const { error } = await supabaseClient
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) throw error;
    await loadAllBookings();
    alert(`Booking marked as ${newStatus}.`);
  } catch (err) {
    alert(`Could not update booking status: ${err.message}`);
  }
};

window.adminDeleteBooking = async function(bookingId) {
  if (!confirm('Are you sure you want to delete this booking record?')) return;

  try {
    const { error } = await supabaseClient
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (error) throw error;

    alert('Booking removed successfully.');
    await loadAllBookings();
    await loadAnalytics();
  } catch (err) {
    alert(`Failed to delete booking: ${err.message}`);
  }
};

// =============================================
// REVIEWS MANAGEMENT
// =============================================
async function loadAllReviews() {
  try {
    const { data, error } = await supabaseClient
      .from('reviews')
      .select('*, users(first_name, last_name), artisans(business_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allReviews = data || [];
    renderReviewsTable(allReviews);
  } catch (err) {
    console.error('Error loading reviews:', err);
  }
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;

  if (!reviews || reviews.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-td">No reviews found.</td></tr>';
    return;
  }

  tbody.innerHTML = reviews.map(r => {
    const reviewer = r.users ? `${r.users.first_name} ${r.users.last_name}` : 'Customer';
    const artisan = r.artisans?.business_name || 'Artisan';
    const stars = renderStarIcons(r.rating || 5);

    return `
      <tr>
        <td><strong>${escapeHtml(reviewer)}</strong></td>
        <td>${escapeHtml(artisan)}</td>
        <td><div style="display:inline-flex; gap:2px; color:#f59e0b;">${stars}</div></td>
        <td>${escapeHtml((r.comment || '-').substring(0, 50))}</td>
        <td>${new Date(r.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn-action btn-danger" onclick="adminDeleteReview('${r.id || r.review_id}')">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

window.adminDeleteReview = async function(reviewId) {
  if (!confirm('Are you sure you want to remove this feedback?')) return;
  try {
    const { error } = await supabaseClient.from('reviews').delete().eq('id', reviewId);
    if (error) throw error;

    await loadAllReviews();
    await loadAnalytics();
  } catch (err) {
    alert(`Error deleting review: ${err.message}`);
  }
};

// =============================================
// ANALYTICS
// =============================================
async function loadAnalytics() {
  try {
    const [{ count: userCount }, { count: artisanCount }, { count: siteCount }, { count: reviewCount }, { count: bookingCount }] = await Promise.all([
      supabaseClient.from('users').select('*', { count: 'exact', head: true }),
      supabaseClient.from('artisans').select('*', { count: 'exact', head: true }),
      supabaseClient.from('tourist_sites').select('*', { count: 'exact', head: true }),
      supabaseClient.from('reviews').select('*', { count: 'exact', head: true }),
      supabaseClient.from('bookings').select('*', { count: 'exact', head: true })
    ]);

    const { data: reviewsData } = await supabaseClient.from('reviews').select('rating');
    const avgRating = reviewsData && reviewsData.length > 0
      ? (reviewsData.reduce((acc, curr) => acc + curr.rating, 0) / reviewsData.length).toFixed(1)
      : '0.0';

    const { data: bookingsData } = await supabaseClient.from('bookings').select('total_amount');
    const totalRev = bookingsData
      ? bookingsData.reduce((acc, curr) => acc + (parseFloat(curr.total_amount) || 0), 0).toFixed(2)
      : '0.00';

    document.getElementById('totalUsers').textContent = userCount || 0;
    document.getElementById('totalArtisans').textContent = artisanCount || 0;
    document.getElementById('totalSites').textContent = siteCount || 0;
    document.getElementById('totalBookings').textContent = bookingCount || 0;
    document.getElementById('avgRating').textContent = avgRating;
    document.getElementById('totalRevenue').textContent = `KES ${parseFloat(totalRev).toLocaleString()}`;

    const roleCount = {};
    allUsers.forEach(u => {
      roleCount[u.role] = (roleCount[u.role] || 0) + 1;
    });

    const roleHtml = Object.entries(roleCount)
      .map(([role, count]) => `<p><span>${role.toUpperCase()}</span><strong>${count}</strong></p>`)
      .join('');
    document.getElementById('usersByRole').innerHTML = roleHtml || '<p class="muted-sub">No data available</p>';

    const counts = {};
    allReviews.forEach(r => {
      const name = r.artisans?.business_name || 'Artisan';
      counts[name] = (counts[name] || 0) + 1;
    });

    const topHtml = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => `<p><span>${name}</span><strong>${count} review(s)</strong></p>`)
      .join('');
    document.getElementById('topArtisans').innerHTML = topHtml || '<p class="muted-sub">No reviews recorded</p>';

  } catch (err) {
    console.error('Analytics load error:', err);
  }
}

// =============================================
// SEARCH LISTENERS
// =============================================
function setupSearchAndFilters() {
  document.getElementById('userSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u =>
      (u.first_name && u.first_name.toLowerCase().includes(q)) ||
      (u.last_name && u.last_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
    renderUsersTable(filtered);
  });

  document.getElementById('roleFilter')?.addEventListener('change', (e) => {
    const role = e.target.value;
    const filtered = role ? allUsers.filter(u => u.role === role) : allUsers;
    renderUsersTable(filtered);
  });

  document.getElementById('artisanSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allArtisans.filter(a =>
      (a.business_name && a.business_name.toLowerCase().includes(q)) ||
      (a.craft_category && a.craft_category.toLowerCase().includes(q)) ||
      (a.location && a.location.toLowerCase().includes(q))
    );
    renderArtisansTable(filtered);
  });

  document.getElementById('siteSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allSites.filter(s =>
      ((s.title || s.name) && (s.title || s.name).toLowerCase().includes(q)) ||
      (s.location && s.location.toLowerCase().includes(q))
    );
    renderSitesTable(filtered);
  });

  document.getElementById('bookingSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allBookings.filter(b => {
      const cust = b.users ? `${b.users.first_name} ${b.users.last_name}` : '';
      const site = b.tourist_sites?.title || '';
      return cust.toLowerCase().includes(q) || site.toLowerCase().includes(q);
    });
    renderBookingsTable(filtered);
  });

  document.getElementById('reviewSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allReviews.filter(r =>
      (r.comment && r.comment.toLowerCase().includes(q)) ||
      (r.users?.first_name && r.users.first_name.toLowerCase().includes(q))
    );
    renderReviewsTable(filtered);
  });
}

// =============================================
// MODALS (DIRECT MESSAGING & BROADCAST ANNOUNCEMENTS)
// =============================================
function setupModals() {
  const resetModal = document.getElementById('resetPasswordModal');
  document.getElementById('closeResetModalBtn')?.addEventListener('click', () => resetModal.classList.add('hidden'));

  document.getElementById('resetPasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('sendResetBtn');
    btn.disabled = true;

    const email = document.getElementById('reset-user-email').value;
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
      if (error) throw error;

      alert(`Password reset instructions sent to ${email}.`);
      resetModal.classList.add('hidden');
    } catch (err) {
      alert(`Reset error: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  // Direct Message & Broadcast Modal
  const msgModal = document.getElementById('adminMsgModal');
  document.getElementById('closeAdminMsgBtn')?.addEventListener('click', () => msgModal.classList.add('hidden'));

  // Broadcast button in topbar
  document.getElementById('openBroadcastBtn')?.addEventListener('click', () => {
    document.getElementById('msg-is-broadcast').value = 'true';
    document.getElementById('msg-recipient-id').value = '';
    document.getElementById('adminMsgModalTitle').textContent = 'Broadcast Announcement';
    document.getElementById('msgRecipientTarget').textContent = 'Recipient: All Registered Users & Artisans';
    document.getElementById('sendAdminMsgBtnText').textContent = 'Broadcast Announcement';
    document.getElementById('adminMsgForm').reset();
    msgModal.classList.remove('hidden');
  });

  // Send Direct Message or Broadcast to Supabase 'messages'
  document.getElementById('adminMsgForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('sendAdminMsgBtn');
    btn.disabled = true;

    const isBroadcast = document.getElementById('msg-is-broadcast').value === 'true';
    const recipientId = document.getElementById('msg-recipient-id').value;
    const messageBody = document.getElementById('msg-body').value.trim();

    try {
      if (isBroadcast) {
        // Broadcast: Insert a message for all users except the admin
        const targetUsers = allUsers.filter(u => u.id !== currentAdmin.id);

        if (!targetUsers.length) {
          alert('No recipients available for broadcast.');
          return;
        }

        const messagesPayload = targetUsers.map(u => ({
          sender_id: currentAdmin.id,
          recipient_id: u.id,
          message_text: `[ANNOUNCEMENT]: ${messageBody}`
        }));

        const { error } = await supabaseClient.from('messages').insert(messagesPayload);
        if (error) throw error;

        alert(`Announcement broadcast to ${targetUsers.length} users successfully!`);
      } else {
        // Single Direct Message
        const { error } = await supabaseClient.from('messages').insert([{
          sender_id: currentAdmin.id,
          recipient_id: recipientId,
          message_text: messageBody
        }]);

        if (error) throw error;
        alert('Direct message sent successfully!');
      }

      document.getElementById('adminMsgForm').reset();
      msgModal.classList.add('hidden');
    } catch (err) {
      alert(`Could not deliver message: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  // Site Edit Modal
  const editSiteModal = document.getElementById('adminEditSiteModal');
  document.getElementById('closeEditSiteModalBtn')?.addEventListener('click', () => editSiteModal.classList.add('hidden'));

  document.getElementById('adminEditSiteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const siteId = document.getElementById('edit-site-id').value;
    const btn = document.getElementById('saveSiteBtn');
    btn.disabled = true;

    try {
      const payload = {
        title: document.getElementById('edit-site-title').value.trim(),
        description: document.getElementById('edit-site-desc').value.trim(),
        location: document.getElementById('edit-site-location').value.trim(),
        entry_fee: parseFloat(document.getElementById('edit-site-fee').value) || 0
      };

      const { error } = await supabaseClient
        .from('tourist_sites')
        .update(payload)
        .eq('id', siteId);

      if (error) throw error;

      alert('Tourist site updated successfully.');
      editSiteModal.classList.add('hidden');
      await loadAllSites();
    } catch (err) {
      alert(`Update error: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  [resetModal, msgModal, editSiteModal].forEach(m => {
    m?.addEventListener('click', (e) => {
      if (e.target === m) m.classList.add('hidden');
    });
  });
}

window.openResetPasswordModal = function(email, fullName) {
  document.getElementById('reset-user-email').value = email;
  document.getElementById('resetUserTarget').textContent = `Target User: ${fullName} (${email})`;
  document.getElementById('resetPasswordModal').classList.remove('hidden');
};

window.openAdminMsgModal = function(id, name, role) {
  document.getElementById('msg-is-broadcast').value = 'false';
  document.getElementById('msg-recipient-id').value = id;
  document.getElementById('adminMsgModalTitle').textContent = 'Send Direct Message';
  document.getElementById('msgRecipientTarget').textContent = `Recipient: ${name} [${role.toUpperCase()}]`;
  document.getElementById('sendAdminMsgBtnText').textContent = 'Send Direct Message';
  document.getElementById('adminMsgForm').reset();
  document.getElementById('adminMsgModal').classList.remove('hidden');
};

// =============================================
// HELPERS
// =============================================
function setupAdminLogout() {
  document.getElementById('adminLogoutBtn')?.addEventListener('click', logout);
}

function renderStarIcons(rating) {
  let stars = '';
  for (let i = 0; i < 5; i++) {
    const isFilled = i < rating;
    stars += `<i data-lucide="star" style="${isFilled ? 'fill: #f59e0b; color: #f59e0b;' : 'color: #cbd5e1;'}"></i>`;
  }
  return stars;
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
