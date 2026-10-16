// =============================================
// DASHBOARD STATE
// =============================================
let activeUser = null;
let activeArtisan = null;
let activeMode = 'customer';
let cachedReviews = [];

document.addEventListener('DOMContentLoaded', async () => {
  await initDashboard();
  initNav();
  initLogout();
  initModals();
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
      document.getElementById('openAddSiteBtn').style.display = 'inline-block';
      document.getElementById('artisan-fields').style.display = 'block';
    }

    const userInfoEl = document.getElementById('userInfo');
    userInfoEl.textContent = `${activeUser.first_name} ${activeUser.last_name} (${activeMode.toUpperCase()})`;

    await loadHomeSection();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

// =============================================
// NAVIGATION & VIEW SWITCHER
// =============================================
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const sectionKey = btn.dataset.section;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(sectionKey).classList.add('active');

      if (sectionKey === 'home') loadHomeSection();
      if (sectionKey === 'sites') loadSites();
      if (sectionKey === 'artisans') loadArtisans();
      if (sectionKey === 'reviews') loadReviews();
      if (sectionKey === 'profile') loadProfile();
    });
  });
}

// =============================================
// SECTION LOADERS
// =============================================
async function loadHomeSection() {
  document.getElementById('welcomeText').textContent = `Welcome, ${activeUser.first_name}!`;
  const welcomeDesc = document.getElementById('welcomeDesc');
  const statsGrid = document.getElementById('statsGrid');

  try {
    if (activeMode === 'customer') {
      welcomeDesc.textContent = 'Discover verified local artisans and heritage sites across Kenya.';

      const [{ count: artisansCount }, { count: sitesCount }, { count: reviewsCount }] = await Promise.all([
        supabaseClient.from('artisans').select('*', { count: 'exact', head: true }),
        supabaseClient.from('tourist_sites').select('*', { count: 'exact', head: true }),
        supabaseClient.from('reviews').select('*', { count: 'exact', head: true })
      ]);

      statsGrid.innerHTML = `
        <div class="stat-card"><h3>${artisansCount || 0}</h3><p>Artisans</p></div>
        <div class="stat-card"><h3>${sitesCount || 0}</h3><p>Tourist Sites</p></div>
        <div class="stat-card"><h3>${reviewsCount || 0}</h3><p>Community Reviews</p></div>
      `;
    } else {
      welcomeDesc.textContent = 'Manage your tourist sites and track community feedback.';

      if (!activeArtisan) return;

      const [{ count: sitesCount }, { data: reviewsData }] = await Promise.all([
        supabaseClient.from('tourist_sites').select('*', { count: 'exact', head: true }).eq('artisan_id', activeArtisan.id),
        supabaseClient.from('reviews').select('rating').eq('artisan_id', activeArtisan.id)
      ]);

      const reviewCount = reviewsData ? reviewsData.length : 0;
      const avgRating = reviewCount > 0
        ? (reviewsData.reduce((acc, curr) => acc + curr.rating, 0) / reviewCount).toFixed(1)
        : 'N/A';

      statsGrid.innerHTML = `
        <div class="stat-card"><h3>${sitesCount || 0}</h3><p>My Sites</p></div>
        <div class="stat-card"><h3>${reviewCount}</h3><p>Total Reviews</p></div>
        <div class="stat-card"><h3>⭐ ${avgRating}</h3><p>Average Rating</p></div>
      `;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadSites() {
  const container = document.getElementById('sitesContainer');
  try {
    let query = supabaseClient.from('tourist_sites').select('*, artisans(id, business_name, location)');
    if (activeMode === 'artisan' && activeArtisan) {
      query = query.eq('artisan_id', activeArtisan.id);
    }

    const { data: sites, error } = await query;
    if (error) throw error;

    if (!sites || sites.length === 0) {
      container.innerHTML = '<p class="muted">No sites found.</p>';
      return;
    }

    container.innerHTML = sites.map(site => {
      const artisanName = site.artisans?.business_name || 'Curated Artisan';
      const artisanId = site.artisan_id;

      return `
        <div class="card">
          <h3>${site.title}</h3>
          <p>${site.description}</p>
          <p><strong>Location:</strong> ${site.location}</p>
          <p><strong>Entry Fee:</strong> $${parseFloat(site.entry_fee || 0).toFixed(2)}</p>
          <p><strong>Curated by:</strong> ${artisanName}</p>
          <div class="card-actions">
            ${activeMode === 'customer' ? `
              <button class="btn btn-primary btn-small" onclick="openReviewModal('${artisanId}', '${artisanName}', '${site.title}')">⭐ Review Site</button>
            ` : ''}
            ${activeMode === 'artisan' ? `
              <button class="btn btn-danger btn-small" onclick="deleteSite('${site.id}')">Delete</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
  }
}

async function loadArtisans() {
  const container = document.getElementById('artisansContainer');
  try {
    const { data: artisans, error } = await supabaseClient
      .from('artisans')
      .select('*, users(first_name, last_name, phone_number)');

    if (error) throw error;

    if (!artisans || artisans.length === 0) {
      container.innerHTML = '<p class="muted">No artisans found.</p>';
      return;
    }

    container.innerHTML = artisans.map(artisan => `
      <div class="card">
        <h3>${artisan.business_name}</h3>
        <p>${artisan.bio || 'No bio provided'}</p>
        <p><strong>Craft:</strong> ${artisan.craft_category || 'General'}</p>
        <p><strong>Location:</strong> ${artisan.location || 'Local'}</p>
        <p><strong>Contact:</strong> ${artisan.users?.phone_number || 'N/A'}</p>
        ${activeMode === 'customer' ? `
          <div class="card-actions">
            <button class="btn btn-primary btn-small" onclick="openReviewModal('${artisan.id}', '${artisan.business_name}')">⭐ Review Artisan</button>
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
  }
}

async function loadReviews() {
  const container = document.getElementById('reviewsContainer');
  try {
    let query = supabaseClient.from('reviews').select('*, users(id, first_name, last_name), artisans(business_name)');
    if (activeMode === 'artisan' && activeArtisan) {
      query = query.eq('artisan_id', activeArtisan.id);
    }

    const { data: reviews, error } = await query;
    if (error) throw error;

    cachedReviews = reviews || [];

    if (!cachedReviews.length) {
      container.innerHTML = '<p class="muted">No reviews found.</p>';
      return;
    }

    container.innerHTML = cachedReviews.map(r => {
      const isOwner = activeUser && r.customer_id === activeUser.id;
      return `
        <div class="card">
          <p><strong>Reviewer:</strong> ${r.users?.first_name || 'Customer'} ${r.users?.last_name || ''}</p>
          <p><strong>Artisan:</strong> ${r.artisans?.business_name || 'N/A'}</p>
          <p><strong>Rating:</strong> ${'⭐'.repeat(r.rating)}</p>
          <p>${r.comment || ''}</p>
          <p><small class="muted">${new Date(r.created_at).toLocaleDateString()}</small></p>
          ${isOwner ? `
            <div class="card-actions">
              <button class="btn btn-outline btn-small" onclick="editReview('${r.id}')">Edit</button>
              <button class="btn btn-danger btn-small" onclick="deleteReview('${r.id}')">Delete</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
  }
}

// =============================================
// REVIEWS CRUD ACTIONS
// =============================================
window.openReviewModal = function(artisanId, targetName, siteTitle = null) {
  const modal = document.getElementById('reviewModal');
  document.getElementById('reviewForm').reset();
  document.getElementById('review-id').value = '';
  document.getElementById('review-artisan-id').value = artisanId;
  document.getElementById('reviewModalTitle').textContent = siteTitle ? `Review: ${siteTitle}` : `Review: ${targetName}`;
  document.getElementById('reviewTargetLabel').textContent = `Target: ${targetName}`;
  modal.classList.remove('hidden');
};

window.editReview = function(reviewId) {
  const review = cachedReviews.find(r => r.id === reviewId);
  if (!review) return;

  const modal = document.getElementById('reviewModal');
  document.getElementById('review-id').value = review.id;
  document.getElementById('review-artisan-id').value = review.artisan_id;
  document.getElementById('review-rating').value = review.rating;
  document.getElementById('review-comment').value = review.comment || '';
  document.getElementById('reviewModalTitle').textContent = 'Edit Review';
  document.getElementById('reviewTargetLabel').textContent = `Target: ${review.artisans?.business_name || 'Artisan'}`;
  modal.classList.remove('hidden');
};

window.deleteReview = async function(reviewId) {
  if (!confirm('Are you sure you want to delete this review?')) return;
  try {
    const { error } = await supabaseClient
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;
    await loadReviews();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
};

// =============================================
// PROFILE UPDATE LOGIC
// =============================================
function loadProfile() {
  document.getElementById('profile-first-name').value = activeUser.first_name || '';
  document.getElementById('profile-last-last').value = activeUser.last_name || '';
  document.getElementById('profile-email').value = activeUser.email || '';
  document.getElementById('profile-phone').value = activeUser.phone_number || '';

  if (activeMode === 'artisan' && activeArtisan) {
    document.getElementById('profile-business-name').value = activeArtisan.business_name || '';
    document.getElementById('profile-bio').value = activeArtisan.bio || '';
    document.getElementById('profile-craft-category').value = activeArtisan.craft_category || '';
    document.getElementById('profile-location').value = activeArtisan.location || '';
  }
}

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('saveProfileBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const updatedPhone = document.getElementById('profile-phone').value.trim();

    const { error: userErr } = await supabaseClient
      .from('users')
      .update({ phone_number: updatedPhone })
      .eq('id', activeUser.id);

    if (userErr) throw userErr;
    activeUser.phone_number = updatedPhone;

    if (activeMode === 'artisan' && activeArtisan) {
      const updatedBusiness = {
        business_name: document.getElementById('profile-business-name').value.trim(),
        bio: document.getElementById('profile-bio').value.trim(),
        craft_category: document.getElementById('profile-craft-category').value.trim(),
        location: document.getElementById('profile-location').value.trim()
      };

      const { error: artisanErr } = await supabaseClient
        .from('artisans')
        .update(updatedBusiness)
        .eq('id', activeArtisan.id);

      if (artisanErr) throw artisanErr;
      Object.assign(activeArtisan, updatedBusiness);
    }

    alert('Profile updated successfully!');
  } catch (err) {
    alert(`Update failed: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Update Profile';
  }
});

// =============================================
// MODAL CONTROLS & FORM SUBMITS
// =============================================
function initModals() {
  const siteModal = document.getElementById('siteModal');
  const openSiteBtn = document.getElementById('openAddSiteBtn');
  const closeSiteBtn = document.getElementById('closeSiteModalBtn');
  const siteForm = document.getElementById('siteForm');

  if (openSiteBtn) openSiteBtn.addEventListener('click', () => siteModal.classList.remove('hidden'));
  if (closeSiteBtn) closeSiteBtn.addEventListener('click', () => siteModal.classList.add('hidden'));

  siteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeArtisan) return;

    try {
      const payload = {
        artisan_id: activeArtisan.id,
        title: document.getElementById('site-title').value.trim(),
        description: document.getElementById('site-description').value.trim(),
        location: document.getElementById('site-location').value.trim(),
        entry_fee: parseFloat(document.getElementById('site-fee').value) || 0
      };

      const { error } = await supabaseClient.from('tourist_sites').insert([payload]);
      if (error) throw error;

      siteForm.reset();
      siteModal.classList.add('hidden');
      await loadSites();
    } catch (err) {
      alert(`Error saving site: ${err.message}`);
    }
  });

  const reviewModal = document.getElementById('reviewModal');
  const closeReviewBtn = document.getElementById('closeReviewModalBtn');
  const reviewForm = document.getElementById('reviewForm');

  if (closeReviewBtn) closeReviewBtn.addEventListener('click', () => reviewModal.classList.add('hidden'));

  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('saveReviewBtn');
    saveBtn.disabled = true;

    try {
      const reviewId = document.getElementById('review-id').value;
      const artisanId = document.getElementById('review-artisan-id').value;
      const rating = parseInt(document.getElementById('review-rating').value, 10);
      const comment = document.getElementById('review-comment').value.trim();

      if (reviewId) {
        // Update review
        const { error } = await supabaseClient
          .from('reviews')
          .update({ rating, comment })
          .eq('id', reviewId);

        if (error) throw error;
      } else {
        // Insert new review
        const { error } = await supabaseClient
          .from('reviews')
          .insert([{
            customer_id: activeUser.id,
            artisan_id: artisanId,
            rating,
            comment
          }]);

        if (error) throw error;
      }

      reviewModal.classList.add('hidden');
      reviewForm.reset();
      await loadReviews();
      alert('Review posted successfully!');
    } catch (err) {
      alert(`Error submitting review: ${err.message}`);
    } finally {
      saveBtn.disabled = false;
    }
  });
}

window.deleteSite = async function(siteId) {
  if (!confirm('Are you sure you want to delete this site?')) return;
  try {
    const { error } = await supabaseClient.from('tourist_sites').delete().eq('id', siteId);
    if (error) throw error;
    await loadSites();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
};

function initLogout() {
  document.getElementById('logoutBtn').addEventListener('click', logout);
}