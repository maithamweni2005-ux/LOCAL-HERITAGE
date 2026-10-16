// =============================================
// GLOBAL STATE
// =============================================
let activeUser = null;
let activeArtisan = null;
let activeMode = 'customer';

let cachedSites = [];
let cachedReviews = [];
let currentBookingSite = null;

// Direct Chat State
let activeChatArtisan = null;
let chatMessages = {};

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  await initDashboard();
  initNavigation();
  initModals();
  initMobileMenu();
  initSearch();
  initLogout();
});

// =============================================
// INITIALIZATION
// =============================================
async function initDashboard() {
  try {
    activeUser = await getCurrentUser();
    if (!activeUser) {
      window.location.href = 'index.html';
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    activeMode = urlParams.get('mode') || activeUser.role || 'customer';

    if (activeMode === 'artisan' || activeUser.role === 'artisan') {
      activeArtisan = await getCurrentArtisan();
      activeMode = 'artisan';

      const openAddSiteBtn = document.getElementById('openAddSiteBtn');
      if (openAddSiteBtn) openAddSiteBtn.style.display = 'inline-flex';

      const artisanFields = document.getElementById('artisan-fields');
      if (artisanFields) artisanFields.style.display = 'block';

      const feedHeaderTitle = document.getElementById('feedHeaderTitle');
      const feedHeaderSub = document.getElementById('feedHeaderSub');
      if (feedHeaderTitle) feedHeaderTitle.textContent = 'My Listed Sites';
      if (feedHeaderSub) feedHeaderSub.textContent = 'Manage, update, and monitor your listed destinations';
    }

    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
      userInfoEl.textContent = `${activeUser.first_name} (${activeMode.toUpperCase()})`;
    }

    await Promise.all([loadReviewsCache(), loadSitesFeed()]);
  } catch (err) {
    console.error('Init error:', err);
  }
}

// =============================================
// NAVIGATION & VIEW SWITCHING
// =============================================
function initNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const sectionKey = btn.dataset.section;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

      const target = document.getElementById(sectionKey);
      if (target) target.classList.add('active');

      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');

      if (sectionKey === 'feed') loadSitesFeed();
      if (sectionKey === 'profile') loadProfileData();
    });
  });
}

function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
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
// REVIEWS DATA CACHE LOADER
// =============================================
async function loadReviewsCache() {
  try {
    const { data: reviews, error } = await supabaseClient
      .from('reviews')
      .select('*, users(first_name, last_name)');

    if (error) throw error;
    cachedReviews = reviews || [];
  } catch (err) {
    console.error('Failed to cache reviews:', err);
  }
}

// =============================================
// SITES FEED LOADER
// =============================================
async function loadSitesFeed(filterTerm = '') {
  const container = document.getElementById('sitesFeedContainer');
  if (!container) return;

  try {
    let query = supabaseClient.from('tourist_sites').select('*, artisans(id, business_name, location)');

    if (activeMode === 'artisan' && activeArtisan) {
      query = query.eq('artisan_id', activeArtisan.id);
    }

    const { data: sites, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    cachedSites = sites || [];

    let filtered = cachedSites;
    if (filterTerm) {
      const term = filterTerm.toLowerCase();
      filtered = cachedSites.filter(s =>
        (s.title && s.title.toLowerCase().includes(term)) ||
        (s.location && s.location.toLowerCase().includes(term)) ||
        (s.description && s.description.toLowerCase().includes(term))
      );
    }

    if (!filtered.length) {
      container.innerHTML = `<p class="muted">${activeMode === 'artisan' ? 'No sites posted yet. Click "+ Add Site" above.' : 'No destinations match your search.'}</p>`;
      return;
    }

    container.innerHTML = filtered.map(site => {
      const artisanName = site.artisans?.business_name || 'Artisan Host';
      const artisanId = site.artisan_id;

      const artisanReviews = cachedReviews.filter(r => r.artisan_id === artisanId);
      const count = artisanReviews.length;

      return `
        <article class="site-card">
          <div class="site-card-header">
            <div>
              <h3>${escapeHtml(site.title || site.name)}</h3>
              <div class="site-location">
                <i data-lucide="map-pin"></i>
                <span>${escapeHtml(site.location || 'Kenya')}</span>
              </div>
            </div>
          </div>

          <p class="site-desc">${escapeHtml(site.description || '')}</p>

          <div class="artisan-badge">
            <span class="artisan-name">${escapeHtml(artisanName)}</span>
            <button type="button" class="reviews-trigger" onclick="openReadReviewsModal('${artisanId}', '${escapeHtml(artisanName)}')">
              <i data-lucide="star"></i>
              <span>${count} review${count === 1 ? '' : 's'}</span>
            </button>
          </div>

          <div class="site-card-footer">
            <div class="site-fee">
              Fee: <strong>$${parseFloat(site.entry_fee || 0).toFixed(2)}</strong>
            </div>

            <div class="card-actions">
              ${activeMode === 'customer' ? `
                <button type="button" class="btn btn-outline btn-small" onclick="openWriteReviewModal('${artisanId}', '${escapeHtml(artisanName)}')">
                  <i data-lucide="star"></i>
                  <span>Rate</span>
                </button>
                <button type="button" class="btn btn-primary btn-small" onclick="openBookingModal('${site.id}', '${artisanId}', '${escapeHtml(site.title || site.name)}', '${escapeHtml(artisanName)}',${parseFloat(site.entry_fee || 0)})">
                  <i data-lucide="calendar"></i>
                  <span>Book & Pay</span>
                </button>
              ` : `
                <button type="button" class="btn btn-outline btn-small" onclick="openEditSiteModal('${site.id}')">
                  <i data-lucide="edit-3"></i>
                  <span>Edit</span>
                </button>
                <button type="button" class="btn btn-danger btn-small" onclick="deleteSite('${site.id}')">
                  <i data-lucide="trash-2"></i>
                  <span>Delete</span>
                </button>
              `}
            </div>
          </div>
        </article>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<p class="muted">Error loading destinations: ${err.message}</p>`;
  }
}

// Search Filter
function initSearch() {
  const searchInput = document.getElementById('siteSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      loadSitesFeed(e.target.value.trim());
    });
  }
}

// =============================================
// REVIEWS MODALS
// =============================================
window.openReadReviewsModal = function(artisanId, artisanName) {
  const modal = document.getElementById('readReviewsModal');
  const title = document.getElementById('readReviewsTitle');
  const subtitle = document.getElementById('readReviewsSubtitle');
  const container = document.getElementById('readReviewsList');

  title.textContent = `Reviews for ${artisanName}`;
  const filtered = cachedReviews.filter(r => r.artisan_id === artisanId);
  subtitle.textContent = `${filtered.length} total reviews verified`;

  if (!filtered.length) {
    container.innerHTML = '<p class="muted">No reviews posted for this artisan yet.</p>';
  } else {
    container.innerHTML = filtered.map(r => {
      const reviewerName = r.users ? `${r.users.first_name} ${r.users.last_name}` : 'Traveler';
      const stars = renderStarIcons(r.rating || 5);
      return `
        <div class="review-card-item">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${escapeHtml(reviewerName)}</strong>
            <div class="review-stars">${stars}</div>
          </div>
          <p class="muted">${escapeHtml(r.comment || 'No comment text provided.')}</p>
          <small class="muted-small">${new Date(r.created_at).toLocaleDateString()}</small>
        </div>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
};

window.openWriteReviewModal = function(artisanId, artisanName) {
  document.getElementById('writeReviewForm').reset();
  document.getElementById('review-artisan-id').value = artisanId;
  document.getElementById('writeReviewTarget').textContent = `Artisan: ${artisanName}`;
  document.getElementById('writeReviewModal').classList.remove('hidden');
};

// =============================================
// BOOKING & DIRECT CHAT BRIDGE
// =============================================
window.openBookingModal = function(siteId, artisanId, siteTitle, artisanName, fee) {
  currentBookingSite = { siteId, artisanId, siteTitle, artisanName, fee };

  document.getElementById('bookForm').reset();
  document.getElementById('book-site-id').value = siteId;
  document.getElementById('book-artisan-id').value = artisanId;
  document.getElementById('book-artisan-name').value = artisanName;

  document.getElementById('bookModalTitle').textContent = `Book: ${siteTitle}`;
  document.getElementById('bookModalArtisan').textContent = `Hosted by: ${artisanName}`;

  document.getElementById('bookFeePerPerson').textContent = `$${fee.toFixed(2)}`;
  document.getElementById('bookTotalAmount').textContent = `$${fee.toFixed(2)}`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('book-date').value = tomorrow.toISOString().split('T')[0];

  document.getElementById('bookModal').classList.remove('hidden');
};

function initBookingCalculator() {
  const visitorsInput = document.getElementById('book-visitors');
  if (visitorsInput) {
    visitorsInput.addEventListener('input', () => {
      const visitors = parseInt(visitorsInput.value, 10) || 1;
      const fee = currentBookingSite?.fee || 0;
      const total = fee * visitors;
      document.getElementById('bookTotalAmount').textContent = `$${total.toFixed(2)}`;
    });
  }
}

function triggerDirectChat(artisanId, artisanName) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const chatNavBtn = document.querySelector('[data-section="chat"]');
  if (chatNavBtn) chatNavBtn.classList.add('active');

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('chat').classList.add('active');

  activeChatArtisan = { id: artisanId, name: artisanName };
  renderChatContacts();
  selectChatContact(artisanId, artisanName);

  if (!chatMessages[artisanId]) {
    chatMessages[artisanId] = [];
  }

  chatMessages[artisanId].push({
    sender: 'artisan',
    text: `Hello ${activeUser.first_name}! Your booking has been confirmed. Feel free to ask questions about your visit directions, timing, or crafts.`
  });

  renderChatWindow();
}

function renderChatContacts() {
  const container = document.getElementById('chatContactsList');
  if (!activeChatArtisan) {
    container.innerHTML = '<p class="muted" style="padding:16px;">No chats initiated yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="chat-contact-item active" onclick="selectChatContact('${activeChatArtisan.id}', '${escapeHtml(activeChatArtisan.name)}')">
      <div class="chat-contact-name">${escapeHtml(activeChatArtisan.name)}</div>
      <small class="muted-small">Site Host</small>
    </div>
  `;
}

window.selectChatContact = function(id, name) {
  activeChatArtisan = { id, name };
  document.getElementById('chatRecipientName').textContent = name;
  document.getElementById('chatRecipientRole').textContent = 'Host Artisan (Direct Connection)';
  document.getElementById('chatMessageInput').disabled = false;
  document.getElementById('sendMsgBtn').disabled = false;
  renderChatWindow();
};

function renderChatWindow() {
  const box = document.getElementById('chatMessagesBox');
  if (!activeChatArtisan || !chatMessages[activeChatArtisan.id]) {
    box.innerHTML = `<div class="chat-placeholder"><p>No messages yet.</p></div>`;
    return;
  }

  box.innerHTML = chatMessages[activeChatArtisan.id].map(m => `
    <div class="message-bubble ${m.sender === 'customer' ? 'sent' : 'received'}">
      ${escapeHtml(m.text)}
    </div>
  `).join('');

  box.scrollTop = box.scrollHeight;
}

const chatForm = document.getElementById('chatInputForm');
if (chatForm) {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chatMessageInput');
    const text = input.value.trim();
    if (!text || !activeChatArtisan) return;

    if (!chatMessages[activeChatArtisan.id]) {
      chatMessages[activeChatArtisan.id] = [];
    }

    chatMessages[activeChatArtisan.id].push({ sender: 'customer', text });
    input.value = '';
    renderChatWindow();

    setTimeout(() => {
      chatMessages[activeChatArtisan.id].push({
        sender: 'artisan',
        text: "Thanks for reaching out! I've received your note and look forward to hosting you."
      });
      renderChatWindow();
    }, 1000);
  });
}

// =============================================
// ARTISAN SITE CRUD
// =============================================
window.openEditSiteModal = function(siteId) {
  const site = cachedSites.find(s => s.id === siteId);
  if (!site) return;

  document.getElementById('site-id').value = site.id;
  document.getElementById('site-title').value = site.title || site.name || '';
  document.getElementById('site-description').value = site.description || '';
  document.getElementById('site-location').value = site.location || '';
  document.getElementById('site-fee').value = site.entry_fee || '';

  document.getElementById('siteModalTitle').textContent = 'Edit Site Listing';
  document.getElementById('siteModal').classList.remove('hidden');
};

window.deleteSite = async function(siteId) {
  if (!confirm('Are you sure you want to delete this tourist site?')) return;
  try {
    const { error } = await supabaseClient.from('tourist_sites').delete().eq('id', siteId);
    if (error) throw error;
    await loadSitesFeed();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
};

// =============================================
// ALL MODAL CONTROLS & SUBMISSIONS
// =============================================
function initModals() {
  initBookingCalculator();

  const closeReadReviewsBtn = document.getElementById('closeReadReviewsBtn');
  if (closeReadReviewsBtn) {
    closeReadReviewsBtn.addEventListener('click', () => {
      document.getElementById('readReviewsModal').classList.add('hidden');
    });
  }

  const writeReviewModal = document.getElementById('writeReviewModal');
  const closeWriteReviewBtn = document.getElementById('closeWriteReviewBtn');
  if (closeWriteReviewBtn) {
    closeWriteReviewBtn.addEventListener('click', () => {
      writeReviewModal.classList.add('hidden');
    });
  }

  const writeReviewForm = document.getElementById('writeReviewForm');
  if (writeReviewForm) {
    writeReviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitReviewBtn');
      btn.disabled = true;

      try {
        const artisanId = document.getElementById('review-artisan-id').value;
        const rating = parseInt(document.getElementById('review-rating-select').value, 10);
        const comment = document.getElementById('review-comment-text').value.trim();

        const { error } = await supabaseClient.from('reviews').insert([{
          customer_id: activeUser.id,
          artisan_id: artisanId,
          rating,
          comment
        }]);

        if (error) throw error;

        alert('Thank you! Your review has been recorded.');
        writeReviewModal.classList.add('hidden');
        await loadReviewsCache();
        await loadSitesFeed();
      } catch (err) {
        alert(`Review submission failed: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    });
  }

  const bookModal = document.getElementById('bookModal');
  const closeBookModalBtn = document.getElementById('closeBookModalBtn');
  if (closeBookModalBtn) {
    closeBookModalBtn.addEventListener('click', () => {
      bookModal.classList.add('hidden');
    });
  }

  const bookForm = document.getElementById('bookForm');
  if (bookForm) {
    bookForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const artisanId = document.getElementById('book-artisan-id').value;
      const artisanName = document.getElementById('book-artisan-name').value;

      bookModal.classList.add('hidden');
      alert('Payment confirmed! Opening direct chat with the artisan.');
      triggerDirectChat(artisanId, artisanName);
    });
  }

  const siteModal = document.getElementById('siteModal');
  const openAddSiteBtn = document.getElementById('openAddSiteBtn');
  if (openAddSiteBtn) {
    openAddSiteBtn.addEventListener('click', () => {
      document.getElementById('siteForm').reset();
      document.getElementById('site-id').value = '';
      document.getElementById('siteModalTitle').textContent = 'Add Tourist Site';
      siteModal.classList.remove('hidden');
    });
  }

  const closeSiteModalBtn = document.getElementById('closeSiteModalBtn');
  if (closeSiteModalBtn) {
    closeSiteModalBtn.addEventListener('click', () => {
      siteModal.classList.add('hidden');
    });
  }

  const siteForm = document.getElementById('siteForm');
  if (siteForm) {
    siteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeArtisan) return;

      const saveBtn = document.getElementById('saveSiteBtn');
      saveBtn.disabled = true;

      try {
        const siteId = document.getElementById('site-id').value;
        const payload = {
          artisan_id: activeArtisan.id,
          title: document.getElementById('site-title').value.trim(),
          description: document.getElementById('site-description').value.trim(),
          location: document.getElementById('site-location').value.trim(),
          entry_fee: parseFloat(document.getElementById('site-fee').value) || 0
        };

        if (siteId) {
          const { error } = await supabaseClient.from('tourist_sites').update(payload).eq('id', siteId);
          if (error) throw error;
        } else {
          const { error } = await supabaseClient.from('tourist_sites').insert([payload]);
          if (error) throw error;
        }

        siteModal.classList.add('hidden');
        await loadSitesFeed();
      } catch (err) {
        alert(`Failed to save site: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  const mapModal = document.getElementById('mapModal');
  const openMapBtn = document.getElementById('openMapBtn');
  const closeMapBtn = document.getElementById('closeMapBtn');

  if (openMapBtn) {
    openMapBtn.addEventListener('click', () => {
      mapModal.classList.remove('hidden');
    });
  }
  if (closeMapBtn) {
    closeMapBtn.addEventListener('click', () => {
      mapModal.classList.add('hidden');
    });
  }

  [document.getElementById('readReviewsModal'), writeReviewModal, bookModal, siteModal, mapModal].forEach(m => {
    if (m) {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.add('hidden');
      });
    }
  });
}

// =============================================
// PROFILE HANDLING
// =============================================
function loadProfileData() {
  document.getElementById('profile-first-name').value = activeUser.first_name || '';
  document.getElementById('profile-last-name').value = activeUser.last_name || '';
  document.getElementById('profile-email').value = activeUser.email || '';
  document.getElementById('profile-phone').value = activeUser.phone_number || '';

  if (activeMode === 'artisan' && activeArtisan) {
    document.getElementById('profile-business-name').value = activeArtisan.business_name || '';
    document.getElementById('profile-bio').value = activeArtisan.bio || '';
    document.getElementById('profile-craft-category').value = activeArtisan.craft_category || '';
    document.getElementById('profile-location').value = activeArtisan.location || '';
  }
}

const profileForm = document.getElementById('profileForm');
if (profileForm) {
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveProfileBtn');
    btn.disabled = true;

    try {
      const updatedPhone = document.getElementById('profile-phone').value.trim();
      const { error: userErr } = await supabaseClient
        .from('users')
        .update({ phone_number: updatedPhone })
        .eq('id', activeUser.id);

      if (userErr) throw userErr;
      activeUser.phone_number = updatedPhone;

      if (activeMode === 'artisan' && activeArtisan) {
        const payload = {
          business_name: document.getElementById('profile-business-name').value.trim(),
          bio: document.getElementById('profile-bio').value.trim(),
          craft_category: document.getElementById('profile-craft-category').value.trim(),
          location: document.getElementById('profile-location').value.trim()
        };

        const { error: artisanErr } = await supabaseClient
          .from('artisans')
          .update(payload)
          .eq('id', activeArtisan.id);

        if (artisanErr) throw artisanErr;
        Object.assign(activeArtisan, payload);
      }

      alert('Profile updated successfully!');
    } catch (err) {
      alert(`Profile update error: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });
}

// =============================================
// HELPERS
// =============================================
function initLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
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