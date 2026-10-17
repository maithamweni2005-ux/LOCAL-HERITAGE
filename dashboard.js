// =============================================
// GLOBAL CONFIG & STATE
// =============================================
const PAYSTACK_PUBLIC_KEY = 'pk_test_f9bc53c6f5640bb20ca81bc3a9f827c82e232459';

let activeUser = null;
let activeArtisan = null;
let activeMode = 'customer';

let cachedSites = [];
let cachedReviews = [];
let currentBookingSite = null;

// Direct Chat State
let activeChatPartner = null; // { id, name, userId }
let messageSubscription = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  await initDashboard();
  initNavigation();
  initModals();
  initMobileMenu();
  initSearch();
  initLogout();
  attachContainerEventDelegation();
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

    await loadReviewsCache();
    await loadSitesFeed();
    await loadChatContacts();
    setupRealtimeMessages();
  } catch (err) {
    console.error('Init error:', err);
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
    console.error('Failed to load reviews cache:', err);
  }
}

// =============================================
// SITES FEED LOADER (WITH IMAGE RENDERING)
// =============================================
async function loadSitesFeed(filterTerm = '') {
  const container = document.getElementById('sitesFeedContainer');
  if (!container) return;

  try {
    let query = supabaseClient
      .from('tourist_sites')
      .select('*, artisans(id, user_id, business_name, location)');

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
      const artisanId = site.artisan_id || site.artisans?.id || '';
      const artisanUserId = site.artisans?.user_id || '';
      const artisanName = site.artisans?.business_name || 'Artisan Host';
      const siteId = site.id;
      const siteTitle = site.title || site.name || 'Heritage Destination';
      const entryFee = parseFloat(site.entry_fee || 0);
      const imageUrl = site.image_url || 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=600&q=80';

      const artisanReviews = cachedReviews.filter(r => r.artisan_id === artisanId);
      const count = artisanReviews.length;

      return `
        <article class="site-card" data-site-id="${siteId}">
          <img src="${imageUrl}" alt="${escapeHtml(siteTitle)}" class="site-card-image" onerror="this.src='https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=600&q=80'" />
          <div class="site-card-header">
            <div>
              <h3>${escapeHtml(siteTitle)}</h3>
              <div class="site-location">
                <i data-lucide="map-pin"></i>
                <span>${escapeHtml(site.location || 'Kenya')}</span>
              </div>
            </div>
          </div>

          <p class="site-desc">${escapeHtml(site.description || '')}</p>

          <div class="artisan-badge">
            <span class="artisan-name">${escapeHtml(artisanName)}</span>
            <button type="button" class="reviews-trigger action-read-reviews" 
              data-artisan-id="${artisanId}" 
              data-artisan-name="${escapeHtml(artisanName)}">
              <i data-lucide="star"></i>
              <span>${count} review${count === 1 ? '' : 's'}</span>
            </button>
          </div>

          <div class="site-card-footer">
            <div class="site-fee">
              Fee: <strong>KES ${entryFee.toLocaleString()}</strong>
            </div>

            <div class="card-actions">
              ${activeMode === 'customer' ? `
                <button type="button" class="btn btn-outline btn-small action-write-review"
                  data-artisan-id="${artisanId}"
                  data-site-id="${siteId}"
                  data-artisan-name="${escapeHtml(artisanName)}">
                  <i data-lucide="star"></i>
                  <span>Rate</span>
                </button>
                <button type="button" class="btn btn-primary btn-small action-book-site"
                  data-site-id="${siteId}"
                  data-artisan-id="${artisanId}"
                  data-artisan-user-id="${artisanUserId}"
                  data-site-title="${escapeHtml(siteTitle)}"
                  data-artisan-name="${escapeHtml(artisanName)}"
                  data-entry-fee="${entryFee}">
                  <i data-lucide="calendar"></i>
                  <span>Book & Pay</span>
                </button>
              ` : `
                <button type="button" class="btn btn-outline btn-small action-edit-site" data-site-id="${siteId}">
                  <i data-lucide="edit-3"></i>
                  <span>Edit</span>
                </button>
                <button type="button" class="btn btn-danger btn-small action-delete-site" data-site-id="${siteId}">
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

// =============================================
// CARD EVENT DELEGATION
// =============================================
function attachContainerEventDelegation() {
  const container = document.getElementById('sitesFeedContainer');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const readBtn = e.target.closest('.action-read-reviews');
    if (readBtn) {
      e.preventDefault();
      openReadReviewsModal(readBtn.dataset.artisanId, readBtn.dataset.artisanName);
      return;
    }

    const writeBtn = e.target.closest('.action-write-review');
    if (writeBtn) {
      e.preventDefault();
      openWriteReviewModal(writeBtn.dataset.artisanId, writeBtn.dataset.siteId, writeBtn.dataset.artisanName);
      return;
    }

    const bookBtn = e.target.closest('.action-book-site');
    if (bookBtn) {
      e.preventDefault();
      openBookingModal(
        bookBtn.dataset.siteId,
        bookBtn.dataset.artisanId,
        bookBtn.dataset.artisanUserId,
        bookBtn.dataset.siteTitle,
        bookBtn.dataset.artisanName,
        parseFloat(bookBtn.dataset.entryFee) || 0
      );
      return;
    }

    const editBtn = e.target.closest('.action-edit-site');
    if (editBtn) {
      e.preventDefault();
      openEditSiteModal(editBtn.dataset.siteId);
      return;
    }

    const deleteBtn = e.target.closest('.action-delete-site');
    if (deleteBtn) {
      e.preventDefault();
      deleteSite(deleteBtn.dataset.siteId);
      return;
    }
  });
}

// =============================================
// REVIEWS
// =============================================
function openReadReviewsModal(artisanId, artisanName) {
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
      const reviewerName = r.users ? `${r.users.first_name} ${r.users.last_name}` : 'Verified Traveler';
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
}

function openWriteReviewModal(artisanId, siteId, artisanName) {
  document.getElementById('writeReviewForm').reset();
  document.getElementById('review-artisan-id').value = artisanId;
  document.getElementById('review-site-id').value = siteId || '';
  document.getElementById('writeReviewTarget').textContent = `Artisan: ${artisanName}`;
  document.getElementById('writeReviewModal').classList.remove('hidden');
}

// =============================================
// BOOKING & PAYSTACK CHECKOUT
// =============================================
function openBookingModal(siteId, artisanId, artisanUserId, siteTitle, artisanName, fee) {
  currentBookingSite = { siteId, artisanId, artisanUserId, siteTitle, artisanName, fee };

  document.getElementById('bookForm').reset();
  document.getElementById('book-site-id').value = siteId;
  document.getElementById('book-artisan-id').value = artisanId;
  document.getElementById('book-artisan-name').value = artisanName;

  document.getElementById('bookModalTitle').textContent = `Book: ${siteTitle}`;
  document.getElementById('bookModalArtisan').textContent = `Hosted by: ${artisanName}`;

  document.getElementById('bookFeePerPerson').textContent = `KES ${fee.toLocaleString()}`;
  document.getElementById('bookTotalAmount').textContent = `KES ${fee.toLocaleString()}`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('book-date').value = tomorrow.toISOString().split('T')[0];

  document.getElementById('bookModal').classList.remove('hidden');
}

function initBookingCalculator() {
  const visitorsInput = document.getElementById('book-visitors');
  if (visitorsInput) {
    visitorsInput.addEventListener('input', () => {
      const visitors = Math.max(1, parseInt(visitorsInput.value, 10) || 1);
      const fee = currentBookingSite?.fee || 0;
      const total = fee * visitors;
      document.getElementById('bookTotalAmount').textContent = `KES ${total.toLocaleString()}`;
    });
  }
}

function handlePaystackPayment() {
  const siteId = document.getElementById('book-site-id').value;
  const artisanId = document.getElementById('book-artisan-id').value;
  const artisanUserId = currentBookingSite?.artisanUserId;
  const artisanName = document.getElementById('book-artisan-name').value;
  const visitDate = document.getElementById('book-date').value;
  const visitors = parseInt(document.getElementById('book-visitors').value, 10) || 1;
  const fee = currentBookingSite?.fee || 0;
  const totalAmount = fee * visitors;

  if (typeof PaystackPop === 'undefined') {
    alert('Paystack SDK failed to load. Please verify your connection.');
    return;
  }

  if (totalAmount <= 0) {
    recordBookingInDatabase({
      siteId,
      artisanId,
      artisanUserId,
      artisanName,
      visitDate,
      visitors,
      totalAmount: 0,
      reference: 'FREE-' + Date.now()
    });
    return;
  }

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: activeUser.email,
    amount: Math.round(totalAmount * 100),
    currency: 'KES',
    ref: 'LH-' + Math.floor((Math.random() * 1000000000) + 1),
    callback: function(response) {
      recordBookingInDatabase({
        siteId,
        artisanId,
        artisanUserId,
        artisanName,
        visitDate,
        visitors,
        totalAmount,
        reference: response.reference
      });
    },
    onClose: function() {
      alert('Transaction was cancelled.');
    }
  });

  handler.openIframe();
}

async function recordBookingInDatabase(bookingData) {
  try {
    await supabaseClient.from('bookings').insert([{
      customer_id: activeUser.id,
      site_id: bookingData.siteId,
      artisan_id: bookingData.artisanId,
      visit_date: bookingData.visitDate,
      visitors: bookingData.visitors,
      total_amount: bookingData.totalAmount,
      status: 'confirmed'
    }]);

    document.getElementById('bookModal').classList.add('hidden');
    alert(`Payment successful! Reference: ${bookingData.reference}. Opening direct chat.`);
    
    startChatWithUser(bookingData.artisanUserId, bookingData.artisanName);
  } catch (err) {
    console.error('Booking save note:', err);
    startChatWithUser(bookingData.artisanUserId, bookingData.artisanName);
  }
}

// =============================================
// DATABASE-BACKED PERSISTENT CHAT
// =============================================
async function loadChatContacts() {
  const container = document.getElementById('chatContactsList');
  if (!container) return;

  try {
    const { data: sentMessages } = await supabaseClient
      .from('messages')
      .select('recipient_id, users!messages_recipient_id_fkey(id, first_name, last_name, role)')
      .eq('sender_id', activeUser.id);

    const { data: receivedMessages } = await supabaseClient
      .from('messages')
      .select('sender_id, users!messages_sender_id_fkey(id, first_name, last_name, role)')
      .eq('recipient_id', activeUser.id);

    const contactsMap = new Map();

    sentMessages?.forEach(m => {
      if (m.users && m.users.id !== activeUser.id) {
        contactsMap.set(m.users.id, {
          userId: m.users.id,
          name: `${m.users.first_name} ${m.users.last_name}`,
          role: m.users.role
        });
      }
    });

    receivedMessages?.forEach(m => {
      if (m.users && m.users.id !== activeUser.id) {
        contactsMap.set(m.users.id, {
          userId: m.users.id,
          name: `${m.users.first_name} ${m.users.last_name}`,
          role: m.users.role
        });
      }
    });

    const contacts = Array.from(contactsMap.values());

    if (!contacts.length) {
      container.innerHTML = '<p class="muted" style="padding:16px;">No conversations yet. Book a site to begin chat.</p>';
      return;
    }

    container.innerHTML = contacts.map(c => `
      <div class="chat-contact-item ${activeChatPartner?.userId === c.userId ? 'active' : ''}" 
        onclick="selectChatPartner('${c.userId}', '${escapeHtml(c.name)}', '${escapeHtml(c.role)}')">
        <div class="chat-contact-name">${escapeHtml(c.name)}</div>
        <small class="muted-small">${c.role.toUpperCase()}</small>
      </div>
    `).join('');

  } catch (err) {
    console.warn('Could not load chat contacts list:', err.message);
  }
}

function startChatWithUser(recipientUserId, recipientName) {
  if (!recipientUserId) {
    alert('Artisan direct user account is not linked. Check back shortly.');
    return;
  }

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const chatNavBtn = document.querySelector('[data-section="chat"]');
  if (chatNavBtn) chatNavBtn.classList.add('active');

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('chat').classList.add('active');

  selectChatPartner(recipientUserId, recipientName, 'Host Artisan');
}

window.selectChatPartner = async function(userId, name, role = 'User') {
  activeChatPartner = { userId, name, role };

  document.getElementById('chatRecipientName').textContent = name;
  document.getElementById('chatRecipientRole').textContent = `${role} (Direct)`;
  document.getElementById('chatMessageInput').disabled = false;
  document.getElementById('sendMsgBtn').disabled = false;

  await loadMessagesForActivePartner();
};

async function loadMessagesForActivePartner() {
  const box = document.getElementById('chatMessagesBox');
  if (!box || !activeChatPartner) return;

  try {
    const { data: msgs, error } = await supabaseClient
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${activeUser.id},recipient_id.eq.${activeChatPartner.userId}),and(sender_id.eq.${activeChatPartner.userId},recipient_id.eq.${activeUser.id})`)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!msgs || !msgs.length) {
      box.innerHTML = `<div class="chat-placeholder"><p>No messages yet. Send a message to start conversation.</p></div>`;
      return;
    }

    box.innerHTML = msgs.map(m => `
      <div class="message-bubble ${m.sender_id === activeUser.id ? 'sent' : 'received'}">
        ${escapeHtml(m.message_text)}
      </div>
    `).join('');

    box.scrollTop = box.scrollHeight;
  } catch (err) {
    console.error('Failed to load messages from database:', err);
  }
}

const chatInputForm = document.getElementById('chatInputForm');
if (chatInputForm) {
  chatInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chatMessageInput');
    const text = input.value.trim();

    if (!text || !activeChatPartner) return;

    try {
      input.value = '';

      const { error } = await supabaseClient
        .from('messages')
        .insert([{
          sender_id: activeUser.id,
          recipient_id: activeChatPartner.userId,
          message_text: text
        }]);

      if (error) throw error;

      await loadMessagesForActivePartner();
      await loadChatContacts();
    } catch (err) {
      alert(`Message could not be sent: ${err.message}`);
    }
  });
}

function setupRealtimeMessages() {
  if (messageSubscription) return;

  messageSubscription = supabaseClient
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const newMsg = payload.new;
      if (
        activeChatPartner &&
        (newMsg.sender_id === activeChatPartner.userId || newMsg.recipient_id === activeChatPartner.userId)
      ) {
        loadMessagesForActivePartner();
      }
      loadChatContacts();
    })
    .subscribe();
}

// =============================================
// MODAL CONTROLS & SUBMIT HANDLERS
// =============================================
function initModals() {
  initBookingCalculator();

  document.getElementById('closeReadReviewsBtn')?.addEventListener('click', () => {
    document.getElementById('readReviewsModal').classList.add('hidden');
  });

  const writeReviewModal = document.getElementById('writeReviewModal');
  document.getElementById('closeWriteReviewBtn')?.addEventListener('click', () => {
    writeReviewModal.classList.add('hidden');
  });

  const writeReviewForm = document.getElementById('writeReviewForm');
  if (writeReviewForm) {
    writeReviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitReviewBtn');
      btn.disabled = true;

      try {
        const artisanId = document.getElementById('review-artisan-id').value;
        const siteId = document.getElementById('review-site-id').value || null;
        const rating = parseInt(document.getElementById('review-rating-select').value, 10);
        const comment = document.getElementById('review-comment-text').value.trim();

        const payload = {
          customer_id: activeUser.id,
          artisan_id: artisanId,
          rating,
          comment
        };
        if (siteId) {
          payload.site_id = siteId;
        }

        const { error } = await supabaseClient.from('reviews').insert([payload]);
        if (error) throw error;

        alert('Thank you! Your review has been submitted.');
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
  document.getElementById('closeBookModalBtn')?.addEventListener('click', () => {
    bookModal.classList.add('hidden');
  });

  const bookForm = document.getElementById('bookForm');
  if (bookForm) {
    bookForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handlePaystackPayment();
    });
  }

  // Site create / edit modal with Storage Upload
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

  document.getElementById('closeSiteModalBtn')?.addEventListener('click', () => {
    siteModal.classList.add('hidden');
  });

  const siteForm = document.getElementById('siteForm');
  if (siteForm) {
    siteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeArtisan) return;

      const saveBtn = document.getElementById('saveSiteBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Uploading & Saving...';

      try {
        const siteId = document.getElementById('site-id').value;
        const imageFileInput = document.getElementById('site-image');
        let uploadedImageUrl = null;

        // Upload image to 'site-images' storage bucket if selected
        if (imageFileInput && imageFileInput.files && imageFileInput.files[0]) {
          const file = imageFileInput.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `${activeArtisan.id}_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabaseClient
            .storage
            .from('site-images')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabaseClient
            .storage
            .from('site-images')
            .getPublicUrl(fileName);

          uploadedImageUrl = publicUrlData.publicUrl;
        }

        const payload = {
          artisan_id: activeArtisan.id,
          title: document.getElementById('site-title').value.trim(),
          description: document.getElementById('site-description').value.trim(),
          location: document.getElementById('site-location').value.trim(),
          entry_fee: parseFloat(document.getElementById('site-fee').value) || 0
        };

        if (uploadedImageUrl) {
          payload.image_url = uploadedImageUrl;
        }

        if (siteId) {
          const { error } = await supabaseClient.from('tourist_sites').update(payload).eq('id', siteId);
          if (error) throw error;
        } else {
          const { error } = await supabaseClient.from('tourist_sites').insert([payload]);
          if (error) throw error;
        }

        siteModal.classList.add('hidden');
        siteForm.reset();
        await loadSitesFeed();
        alert('Site saved successfully!');
      } catch (err) {
        alert(`Failed to save site: ${err.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Site';
      }
    });
  }

  const mapModal = document.getElementById('mapModal');
  document.getElementById('openMapBtn')?.addEventListener('click', () => {
    mapModal.classList.remove('hidden');
  });
  document.getElementById('closeMapBtn')?.addEventListener('click', () => {
    mapModal.classList.add('hidden');
  });

  [document.getElementById('readReviewsModal'), writeReviewModal, bookModal, siteModal, mapModal].forEach(m => {
    if (m) {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.add('hidden');
      });
    }
  });
}

// =============================================
// SITE CRUD & NAVIGATION HELPERS
// =============================================
function openEditSiteModal(siteId) {
  const site = cachedSites.find(s => s.id === siteId);
  if (!site) return;

  document.getElementById('site-id').value = site.id;
  document.getElementById('site-title').value = site.title || site.name || '';
  document.getElementById('site-description').value = site.description || '';
  document.getElementById('site-location').value = site.location || '';
  document.getElementById('site-fee').value = site.entry_fee || '';

  document.getElementById('siteModalTitle').textContent = 'Edit Site Listing';
  document.getElementById('siteModal').classList.remove('hidden');
}

async function deleteSite(siteId) {
  if (!confirm('Are you sure you want to delete this tourist site?')) return;
  try {
    const { error } = await supabaseClient.from('tourist_sites').delete().eq('id', siteId);
    if (error) throw error;
    await loadSitesFeed();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

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
      if (sectionKey === 'chat') loadChatContacts();
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

function initSearch() {
  const searchInput = document.getElementById('siteSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      loadSitesFeed(e.target.value.trim());
    });
  }
}

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

function initLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
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
