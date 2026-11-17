// =============================================
// TRAVEL GUIDE (regions, itineraries, transport, tips)
// Depends on: supabaseClient (app.js), openBookingModal, activeMode (dashboard.js)
// =============================================
const TRAVEL_MODES = {
  train:     { label: 'Train',          icon: 'train' },
  bus:       { label: 'Bus',            icon: 'bus' },
  matatu:    { label: 'Matatu',         icon: 'bus' },
  flight:    { label: 'Flight',         icon: 'plane' },
  ferry:     { label: 'Ferry',          icon: 'ship' },
  taxi:      { label: 'Taxi',           icon: 'car' },
  ride_hail: { label: 'Ride-hailing',   icon: 'smartphone' },
  tuk_tuk:   { label: 'Tuk-tuk',        icon: 'car' },
  boda_boda: { label: 'Boda boda',      icon: 'bike' },
  car_hire:  { label: 'Car hire',       icon: 'car' },
  walking:   { label: 'Walking',        icon: 'footprints' }
};

const TRAVEL_TIP_CATEGORIES = {
  general:       { label: 'General',       icon: 'info' },
  safety:        { label: 'Safety',        icon: 'shield-check' },
  health:        { label: 'Health',        icon: 'heart-pulse' },
  money:         { label: 'Money',         icon: 'wallet' },
  culture:       { label: 'Culture',       icon: 'users' },
  packing:       { label: 'Packing',       icon: 'backpack' },
  weather:       { label: 'Weather',       icon: 'sun' },
  communication: { label: 'Communication', icon: 'message-circle' }
};

const TRAVEL_BUDGETS = { budget: 'Budget', mid_range: 'Mid-range', luxury: 'Luxury' };
const TRAVEL_TIMES = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', full_day: 'Full day' };

const travelState = {
  loaded: false,
  regions: [],
  regionId: null,
  tab: 'overview',
  openItineraries: new Set(),
  cache: {}          // regionId -> { transport, tips, itineraries }
};
const travelSites = {};   // siteId -> site row (for the Book buttons)

// ---------- formatting helpers ----------
function travelMoney(amount, currency) {
  return `${currency || 'KES'} ${Number(amount).toLocaleString()}`;
}

function travelCostRange(min, max, currency) {
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (!hasMin && !hasMax) return 'Price varies';
  if (hasMin && hasMax) {
    return Number(min) === Number(max)
      ? travelMoney(min, currency)
      : `${travelMoney(min, currency)} - ${Number(max).toLocaleString()}`;
  }
  return hasMin ? `From ${travelMoney(min, currency)}` : `Up to ${travelMoney(max, currency)}`;
}

function travelDuration(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

// ---------- loading ----------
async function loadTravelGuide() {
  const root = document.getElementById('travelContent');
  if (!root || travelState.loaded) return;

  root.innerHTML = '<p class="muted">Loading travel guide...</p>';
  try {
    const { data, error } = await supabaseClient
      .from('regions')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;

    travelState.regions = data || [];
    travelState.loaded = true;

    if (!travelState.regions.length) {
      root.innerHTML = '<div class="travel-empty"><i data-lucide="map"></i><p>No travel guides have been published yet. Check back soon.</p></div>';
      if (window.lucide) lucide.createIcons();
      return;
    }

    await selectTravelRegion(travelState.regionId || travelState.regions[0].id);
  } catch (err) {
    console.error('Travel guide load error:', err);
    root.innerHTML = '<div class="travel-empty"><i data-lucide="alert-triangle"></i><p>We could not load the travel guide right now. Please try again later.</p></div>';
    if (window.lucide) lucide.createIcons();
  }
}

async function selectTravelRegion(regionId) {
  travelState.regionId = regionId;
  renderTravelGuide(true);

  if (!travelState.cache[regionId]) {
    try {
      const [transport, tips, itineraries, sites] = await Promise.all([
        supabaseClient.from('transport_options').select('*').eq('region_id', regionId).order('sort_order'),
        supabaseClient.from('travel_tips').select('*').or(`region_id.eq.${regionId},region_id.is.null`).order('sort_order'),
        supabaseClient
          .from('itineraries')
          .select('*, itinerary_stops(*, tourist_sites(id, title, entry_fee, artisan_id, artisans(id, user_id, business_name)))')
          .eq('region_id', regionId)
          .eq('is_published', true)
          .order('duration_days', { ascending: true }),
        supabaseClient
          .from('tourist_sites')
          .select('id, title, description, location, entry_fee, artisan_id, artisans(id, user_id, business_name)')
          .eq('region_id', regionId)
          .order('title', { ascending: true })
      ]);

      const firstError = transport.error || tips.error || itineraries.error || sites.error;
      if (firstError) throw firstError;

      const itins = (itineraries.data || []).map(it => ({
        ...it,
        itinerary_stops: (it.itinerary_stops || []).sort(
          (a, b) => a.day_number - b.day_number || a.stop_order - b.stop_order
        )
      }));
      itins.forEach(it => it.itinerary_stops.forEach(s => {
        if (s.tourist_sites) travelSites[s.tourist_sites.id] = s.tourist_sites;
      }));

      (sites.data || []).forEach(s => { travelSites[s.id] = s; });

      travelState.cache[regionId] = {
        sites: sites.data || [],
        transport: transport.data || [],
        tips: tips.data || [],
        itineraries: itins
      };
    } catch (err) {
      console.error('Travel region load error:', err);
      const panel = document.getElementById('travelPanel');
      if (panel) panel.innerHTML = '<p class="muted">Could not load this region. Please try again.</p>';
      return;
    }
  }

  if (travelState.regionId === regionId) renderTravelGuide(false);
}

// ---------- rendering ----------
function renderTravelGuide(loading) {
  const root = document.getElementById('travelContent');
  if (!root) return;

  const region = travelState.regions.find(r => r.id === travelState.regionId);
  if (!region) return;

  const tabs = [
    ['overview', 'Overview', 'compass'],
    ['itineraries', 'Itineraries', 'route'],
    ['transport', 'Getting around', 'bus'],
    ['tips', 'Essential tips', 'lightbulb']
  ];

  root.innerHTML = `
    <div class="travel-toolbar">
      <div class="travel-region-picker">
        <label for="travelRegionSelect" class="muted-small">Destination</label>
        <select id="travelRegionSelect">
          ${travelState.regions.map(r =>
            `<option value="${escapeHtml(r.id)}" ${r.id === region.id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="travel-tabs" role="tablist">
      ${tabs.map(([key, label, icon]) => `
        <button type="button" role="tab" class="travel-tab ${travelState.tab === key ? 'active' : ''}" data-travel-tab="${key}">
          <i data-lucide="${icon}"></i><span>${label}</span>
        </button>`).join('')}
    </div>
    <div id="travelPanel" class="travel-panel">
      ${loading ? '<p class="muted">Loading...</p>' : renderTravelPanel(region)}
    </div>`;

  if (window.lucide) lucide.createIcons();
}

function renderTravelPanel(region) {
  const data = travelState.cache[region.id];
  if (!data) return '<p class="muted">Loading...</p>';
  switch (travelState.tab) {
    case 'itineraries': return renderTravelItineraries(data.itineraries);
    case 'transport':   return renderTravelTransport(data.transport);
    case 'tips':        return renderTravelTips(data.tips, region);
    default:            return renderTravelOverview(region, data.sites);
  }
}

function renderTravelOverview(region, sites) {
  const facts = [
    ['calendar', 'Best time to visit', region.best_time_to_visit],
    ['cloud-sun', 'Climate', region.climate],
    ['map-pin', 'Getting there', region.getting_there],
    ['shield-check', 'Safety', region.safety_overview]
  ].filter(f => f[2]);

  return `
    <div class="travel-card">
      <h2>${escapeHtml(region.name)}</h2>
      ${region.county ? `<p class="muted-small">${escapeHtml(region.county)} County</p>` : ''}
      <p class="travel-text">${escapeHtml(region.summary)}</p>
    </div>
    <div class="travel-facts">
      ${facts.map(([icon, title, text]) => `
        <div class="travel-card travel-fact">
          <h4><i data-lucide="${icon}"></i> ${title}</h4>
          <p class="travel-text">${escapeHtml(text)}</p>
        </div>`).join('')}
    </div>
    ${renderTravelSites(region, sites || [])}`;
}

function renderTravelSites(region, sites) {
  if (!sites.length) return '';
  return `
    <h3 class="travel-group-title">Heritage experiences in ${escapeHtml(region.name)}</h3>
    <div class="travel-grid">
      ${sites.map(s => `
        <div class="travel-card">
          <h4>${escapeHtml(s.title)}</h4>
          <p class="muted-small">${escapeHtml(s.location || '')}${s.artisans ? ` · Hosted by ${escapeHtml(s.artisans.business_name)}` : ''}</p>
          <p class="travel-text travel-clamp">${escapeHtml(s.description || '')}</p>
          <div class="travel-badges"><span class="travel-badge">${Number(s.entry_fee) > 0 ? travelMoney(s.entry_fee) : 'Free entry'}</span></div>
          ${s.artisans && activeMode === 'customer'
            ? `<button type="button" class="btn btn-primary btn-small" data-travel-book="${escapeHtml(s.id)}">Book</button>` : ''}
        </div>`).join('')}
    </div>`;
}

function renderTravelItineraries(itineraries) {
  if (!itineraries.length) return '<p class="muted">No itineraries for this destination yet.</p>';

  return itineraries.map(it => {
    const open = travelState.openItineraries.has(it.id);
    const days = {};
    it.itinerary_stops.forEach(s => { (days[s.day_number] = days[s.day_number] || []).push(s); });

    const body = Object.keys(days).sort((a, b) => a - b).map(day => `
      <div class="travel-day">
        <h4>Day ${day}</h4>
        ${days[day].map(renderTravelStop).join('')}
      </div>`).join('');

    return `
      <div class="travel-card travel-itinerary">
        <div class="travel-itin-head">
          <div>
            <h3>${escapeHtml(it.title)}</h3>
            <div class="travel-badges">
              <span class="travel-badge">${it.duration_days} day${it.duration_days > 1 ? 's' : ''}</span>
              <span class="travel-badge">${TRAVEL_BUDGETS[it.budget_level] || ''}</span>
              ${it.est_cost_min !== null || it.est_cost_max !== null
                ? `<span class="travel-badge">${escapeHtml(travelCostRange(it.est_cost_min, it.est_cost_max, it.currency))} / person</span>` : ''}
              ${it.best_season ? `<span class="travel-badge">${escapeHtml(it.best_season)}</span>` : ''}
            </div>
          </div>
          <button type="button" class="btn btn-outline btn-small" data-itin-toggle="${escapeHtml(it.id)}">
            ${open ? 'Hide plan' : 'View plan'}
          </button>
        </div>
        <p class="travel-text">${escapeHtml(it.summary)}</p>
        ${open ? `<div class="travel-itin-body">${body || '<p class="muted">Stops coming soon.</p>'}</div>` : ''}
      </div>`;
  }).join('');
}

function renderTravelStop(stop) {
  const site = stop.tourist_sites;
  const canBook = site && site.artisans && activeMode === 'customer';
  const meta = [
    stop.time_of_day ? TRAVEL_TIMES[stop.time_of_day] : '',
    stop.duration_minutes ? travelDuration(stop.duration_minutes) : '',
    stop.location_name || ''
  ].filter(Boolean).map(escapeHtml).join(' · ');

  return `
    <div class="travel-stop">
      <div class="travel-stop-dot"></div>
      <div class="travel-stop-body">
        <strong>${escapeHtml(stop.title)}</strong>
        ${meta ? `<div class="muted-small">${meta}</div>` : ''}
        ${stop.description ? `<p class="travel-text">${escapeHtml(stop.description)}</p>` : ''}
        ${stop.transport_note ? `<p class="travel-note"><i data-lucide="navigation"></i> ${escapeHtml(stop.transport_note)}</p>` : ''}
        ${canBook ? `<button type="button" class="btn btn-primary btn-small" data-travel-book="${escapeHtml(site.id)}">Book ${escapeHtml(site.title)}</button>` : ''}
      </div>
    </div>`;
}

function renderTravelTransport(options) {
  if (!options.length) return '<p class="muted">No transport information for this destination yet.</p>';

  return `<div class="travel-grid">${options.map(o => {
    const mode = TRAVEL_MODES[o.mode] || { label: o.mode, icon: 'map-pin' };
    const route = [o.from_location, o.to_location].filter(Boolean).map(escapeHtml).join(' → ');
    const cost = travelCostRange(o.cost_min, o.cost_max, o.currency);
    const dur = travelDuration(o.duration_minutes);
    return `
      <div class="travel-card">
        <div class="travel-mode"><i data-lucide="${mode.icon}"></i><span>${escapeHtml(mode.label)}</span></div>
        <h4>${escapeHtml(o.title)}</h4>
        ${route ? `<p class="muted-small">${route}</p>` : ''}
        ${o.description ? `<p class="travel-text">${escapeHtml(o.description)}</p>` : ''}
        <div class="travel-badges">
          <span class="travel-badge">${escapeHtml(cost)}</span>
          ${dur ? `<span class="travel-badge">${dur}</span>` : ''}
          ${o.operator ? `<span class="travel-badge">${escapeHtml(o.operator)}</span>` : ''}
        </div>
        ${o.tips ? `<p class="travel-note"><i data-lucide="lightbulb"></i> ${escapeHtml(o.tips)}</p>` : ''}
      </div>`;
  }).join('')}</div>`;
}

function renderTravelTips(tips, region) {
  if (!tips.length) return '<p class="muted">No tips available yet.</p>';

  const local = tips.filter(t => t.region_id);
  const general = tips.filter(t => !t.region_id);

  const group = (title, list) => list.length ? `
    <h3 class="travel-group-title">${escapeHtml(title)}</h3>
    <div class="travel-grid">
      ${list.map(t => {
        const cat = TRAVEL_TIP_CATEGORIES[t.category] || TRAVEL_TIP_CATEGORIES.general;
        return `
          <div class="travel-card">
            <div class="travel-mode"><i data-lucide="${cat.icon}"></i><span>${cat.label}</span></div>
            <h4>${escapeHtml(t.title)}</h4>
            <p class="travel-text">${escapeHtml(t.content)}</p>
          </div>`;
      }).join('')}
    </div>` : '';

  return group(`Tips for ${region.name}`, local) + group('Good to know across Kenya', general);
}

// ---------- events ----------
// Fills the Region dropdown in the artisan "Add/Edit site" form.
async function populateSiteRegionSelect() {
  const sel = document.getElementById('site-region');
  if (!sel) return;
  const { data, error } = await supabaseClient
    .from('regions').select('id, name').eq('is_published', true).order('name');
  if (error) return;
  sel.innerHTML = '<option value="">No region</option>' +
    (data || []).map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  populateSiteRegionSelect();
  const section = document.getElementById('travel');
  if (!section) return;

  section.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-travel-tab]');
    if (tabBtn) {
      travelState.tab = tabBtn.dataset.travelTab;
      renderTravelGuide(false);
      return;
    }

    const toggleBtn = e.target.closest('[data-itin-toggle]');
    if (toggleBtn) {
      const id = toggleBtn.dataset.itinToggle;
      if (travelState.openItineraries.has(id)) travelState.openItineraries.delete(id);
      else travelState.openItineraries.add(id);
      renderTravelGuide(false);
      return;
    }

    const bookBtn = e.target.closest('[data-travel-book]');
    if (bookBtn) {
      const site = travelSites[bookBtn.dataset.travelBook];
      if (!site || !site.artisans) return;
      openBookingModal(
        site.id,
        site.artisan_id,
        site.artisans.user_id,
        site.title,
        site.artisans.business_name,
        Number(site.entry_fee) || 0
      );
    }
  });

  section.addEventListener('change', (e) => {
    if (e.target.id === 'travelRegionSelect') selectTravelRegion(e.target.value);
  });
});
