// =============================================
// ADMIN INITIALIZATION
// =============================================
let currentAdmin = null;
let allUsers = [];
let allArtisans = [];
let allSites = [];
let allReviews = [];

document.addEventListener('DOMContentLoaded', async () => {
    await initializeAdmin();
    setupAdminNavigation();
    setupAdminLogout();
});

// =============================================
// INITIALIZATION
// =============================================
async function initializeAdmin() {
    try {
        currentAdmin = await getCurrentUser();
        
        // Verify admin role
        if (!currentAdmin || currentAdmin.role !== 'admin') {
            window.location.href = 'index.html';
            return;
        }

        const adminUserInfo = document.getElementById('adminUserInfo');
        adminUserInfo.innerHTML = `<span>${currentAdmin.first_name} ${currentAdmin.last_name} (Admin)</span>`;

        // Load all data
        await loadAllUsers();
        await loadAllArtisans();
        await loadAllSites();
        await loadAllReviews();
        await loadAnalytics();

        setupEventListeners();
    } catch (err) {
        console.error('Admin init error:', err);
    }
}

// =============================================
// ADMIN NAVIGATION
// =============================================
function setupAdminNavigation() {
    document.querySelectorAll('.admin-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            
            document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(section).classList.add('active');
            
            document.getElementById('adminPageTitle').textContent = item.textContent.trim();

            // Load fresh data for the section
            switch(section) {
                case 'users':
                    loadAllUsers();
                    break;
                case 'artisans':
                    loadAllArtisans();
                    break;
                case 'sites':
                    loadAllSites();
                    break;
                case 'reviews':
                    loadAllReviews();
                    break;
                case 'analytics':
                    loadAnalytics();
                    break;
            }
        });
    });
}

// =============================================
// USERS MANAGEMENT
// =============================================
async function loadAllUsers() {
    try {
        const { data, error } = await supabase
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
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.user_id}</td>
            <td>${user.first_name} ${user.last_name}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-${user.role}">${user.role}</span></td>
            <td>${user.phone_number || '-'}</td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn-action" onclick="viewUserDetails(${user.user_id})">View</button>
                <button class="btn-action btn-danger" onclick="confirmDeleteUser(${user.user_id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('userSearch')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allUsers.filter(user => 
        user.first_name.toLowerCase().includes(query) ||
        user.last_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
    renderUsersTable(filtered);
});

document.getElementById('roleFilter')?.addEventListener('change', (e) => {
    const role = e.target.value;
    const filtered = role ? allUsers.filter(u => u.role === role) : allUsers;
    renderUsersTable(filtered);
});

async function viewUserDetails(userId) {
    const user = allUsers.find(u => u.user_id === userId);
    if (!user) return;

    const modal = document.getElementById('userModal');
    const detailsDiv = document.getElementById('userDetails');

    detailsDiv.innerHTML = `
        <div class="user-detail-info">
            <p><strong>ID:</strong> ${user.user_id}</p>
            <p><strong>First Name:</strong> ${user.first_name}</p>
            <p><strong>Last Name:</strong> ${user.last_name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Phone:</strong> ${user.phone_number || 'N/A'}</p>
            <p><strong>Role:</strong> ${user.role}</p>
            <p><strong>Created:</strong> ${new Date(user.created_at).toLocaleString()}</p>
            <p><strong>Updated:</strong> ${new Date(user.updated_at).toLocaleString()}</p>
        </div>
    `;

    document.getElementById('deleteUserBtn').onclick = () => deleteUser(userId);
    modal.style.display = 'block';
}

function confirmDeleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        deleteUser(userId);
    }
}

async function deleteUser(userId) {
    try {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;

        alert('User deleted successfully');
        document.getElementById('userModal').style.display = 'none';
        await loadAllUsers();
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
}

// =============================================
// ARTISANS MANAGEMENT
// =============================================
async function loadAllArtisans() {
    try {
        const { data, error } = await supabase
            .from('artisans')
            .select(`
                *,
                users(first_name, last_name, email),
                tourist_sites(count)
            `)
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
    
    if (!artisans || artisans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No artisans found</td></tr>';
        return;
    }

    tbody.innerHTML = artisans.map(artisan => `
        <tr>
            <td>${artisan.artisan_id}</td>
            <td>${artisan.business_name}</td>
            <td>${artisan.users.first_name} ${artisan.users.last_name}</td>
            <td>${artisan.craft_category || '-'}</td>
            <td>${artisan.location || '-'}</td>
            <td>${artisan.tourist_sites?.length || 0}</td>
            <td>
                <button class="btn-action" onclick="viewArtisanProfile(${artisan.artisan_id})">View</button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('artisanSearch')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allArtisans.filter(artisan =>
        artisan.business_name.toLowerCase().includes(query) ||
        artisan.craft_category?.toLowerCase().includes(query)
    );
    renderArtisansTable(filtered);
});

function viewArtisanProfile(artisanId) {
    alert('Artisan profile details coming soon');
}

// =============================================
// SITES MANAGEMENT
// =============================================
async function loadAllSites() {
    try {
        const { data, error } = await supabase
            .from('tourist_sites')
            .select(`
                *,
                artisans(business_name, user_id)
            `)
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
    
    if (!sites || sites.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No sites found</td></tr>';
        return;
    }

    tbody.innerHTML = sites.map(site => `
        <tr>
            <td>${site.site_id}</td>
            <td>${site.title}</td>
            <td>${site.artisans.business_name}</td>
            <td>${site.location}</td>
            <td>$${parseFloat(site.entry_fee).toFixed(2)}</td>
            <td><span class="badge ${site.is_active ? 'badge-success' : 'badge-inactive'}">${site.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>${new Date(site.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn-action btn-danger" onclick="confirmDeleteSite(${site.site_id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('siteSearch')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allSites.filter(site =>
        site.title.toLowerCase().includes(query) ||
        site.location.toLowerCase().includes(query)
    );
    renderSitesTable(filtered);
});

async function confirmDeleteSite(siteId) {
    if (confirm('Delete this site?')) {
        try {
            const { error } = await supabase
                .from('tourist_sites')
                .delete()
                .eq('site_id', siteId);

            if (error) throw error;
            await loadAllSites();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    }
}

// =============================================
// REVIEWS MANAGEMENT
// =============================================
async function loadAllReviews() {
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select(`
                *,
                users(first_name, last_name),
                artisans(business_name)
            `)
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
    
    if (!reviews || reviews.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No reviews found</td></tr>';
        return;
    }

    tbody.innerHTML = reviews.map(review => `
        <tr>
            <td>${review.review_id}</td>
            <td>${review.users.first_name} ${review.users.last_name}</td>
            <td>${review.artisans.business_name}</td>
            <td>${'⭐'.repeat(review.rating)}</td>
            <td>${(review.comment || '-').substring(0, 50)}</td>
            <td>${new Date(review.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn-action btn-danger" onclick="confirmDeleteReview(${review.review_id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

document.getElementById('reviewSearch')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allReviews.filter(review =>
        review.users.first_name.toLowerCase().includes(query) ||
        review.artisans.business_name.toLowerCase().includes(query)
    );
    renderReviewsTable(filtered);
});

async function confirmDeleteReview(reviewId) {
    if (confirm('Delete this review?')) {
        try {
            const { error } = await supabase
                .from('reviews')
                .delete()
                .eq('review_id', reviewId);

            if (error) throw error;
            await loadAllReviews();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    }
}

// =============================================
// ANALYTICS
// =============================================
async function loadAnalytics() {
    try {
        // Count queries
        const { count: userCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        const { count: artisanCount } = await supabase
            .from('artisans')
            .select('*', { count: 'exact', head: true });

        const { count: siteCount } = await supabase
            .from('tourist_sites')
            .select('*', { count: 'exact', head: true });

        const { count: reviewCount } = await supabase
            .from('reviews')
            .select('*', { count: 'exact', head: true });

        // Get ratings data
        const { data: reviewsData } = await supabase
            .from('reviews')
            .select('rating, entry_fee')
            .eq('is_active', true);

        const avgRating = reviewsData && reviewsData.length > 0
            ? (reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length).toFixed(2)
            : 0;

        // Get revenue
        const { data: sitesData } = await supabase
            .from('tourist_sites')
            .select('entry_fee');

        const totalRevenue = sitesData
            ? sitesData.reduce((sum, s) => sum + (parseFloat(s.entry_fee) || 0), 0).toFixed(2)
            : 0;

        // Update cards
        document.getElementById('totalUsers').textContent = userCount || 0;
        document.getElementById('totalArtisans').textContent = artisanCount || 0;
        document.getElementById('totalSites').textContent = siteCount || 0;
        document.getElementById('totalReviews').textContent = reviewCount || 0;
        document.getElementById('avgRating').textContent = `⭐ ${avgRating}`;
        document.getElementById('totalRevenue').textContent = `$${totalRevenue}`;

        // Users by role
        const { data: roleData } = await supabase
            .from('users')
            .select('role');

        const roleCount = {};
        roleData?.forEach(u => {
            roleCount[u.role] = (roleCount[u.role] || 0) + 1;
        });

        const roleHtml = Object.entries(roleCount)
            .map(([role, count]) => `<p>${role}: ${count}</p>`)
            .join('');
        document.getElementById('usersByRole').innerHTML = roleHtml || '<p>No data</p>';

        // Top artisans
        const { data: topArtisansData } = await supabase
            .from('reviews')
            .select('artisan_id, artisans(business_name)')
            .limit(5);

        const artisanReviewCount = {};
        topArtisansData?.forEach(r => {
            const name = r.artisans.business_name;
            artisanReviewCount[name] = (artisanReviewCount[name] || 0) + 1;
        });

        const topHtml = Object.entries(artisanReviewCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => `<p>${name}: ${count} reviews</p>`)
            .join('');
        document.getElementById('topArtisans').innerHTML = topHtml || '<p>No data</p>';

    } catch (err) {
        console.error('Analytics error:', err);
    }
}

// =============================================
// EVENT SETUP
// =============================================
function setupEventListeners() {
    const userModal = document.getElementById('userModal');
    const closeBtn = userModal?.querySelector('.close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            userModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === userModal) {
            userModal.style.display = 'none';
        }
    });
}

function setupAdminLogout() {
    document.getElementById('adminLogoutBtn').addEventListener('click', logout);
}
