// =============================================
// ADMIN: TRAVEL GUIDE CONTENT MANAGER
// Depends on: supabaseClient (app.js), currentAdmin + escapeHtml (admin.js)
// One generic list/form engine drives regions, tips, transport, itineraries and stops.
// =============================================
const TA = {
  tab: 'regions',
  regions: [],
  sites: [],
  rows: {},            // entity -> loaded rows
  editing: null,       // { entity, id, fixed }
  stopsItinerary: null // itinerary row whose stops are open
};

const taPairs = (arr) => arr.map(v => [v, v.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())]);
const taRegionOpts = () => TA.regions.map(r => [r.id, r.name]);
const taSiteOpts = () => TA.sites.map(s => [s.id, s.title]);
const taBadge = (on) => `<span class="badge ${on ? 'badge-confirmed' : ''}">${on ? 'Published' : 'Draft'}</span>`;
const taSlug = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const TA_ENTITIES = {
  regions: {
    table: 'regions', label: 'Region', select: '*',
    order: [['sort_order', true], ['name', true]],
    heads: ['Name', 'County', 'Status'],
    cells: r => [r.name, r.county || '-', taBadge(r.is_published)],
    fields: [
      { k: 'name', l: 'Name', t: 'text', req: true },
      { k: 'slug', l: 'Slug (leave blank to generate)', t: 'text' },
      { k: 'county', l: 'County', t: 'text' },
      { k: 'summary', l: 'Summary', t: 'textarea', req: true },
      { k: 'best_time_to_visit', l: 'Best time to visit', t: 'textarea' },
      { k: 'climate', l: 'Climate', t: 'textarea' },
      { k: 'getting_there', l: 'Getting there', t: 'textarea' },
      { k: 'safety_overview', l: 'Safety overview', t: 'textarea' },
      { k: 'sort_order', l: 'Sort order', t: 'number', def: 0 },
      { k: 'is_published', l: 'Published (visible to travellers)', t: 'checkbox' }
    ]
  },
  tips: {
    table: 'travel_tips', label: 'Tip', select: '*, regions(name)',
    order: [['created_at', false]],
    heads: ['Title', 'Category', 'Region'],
    cells: r => [r.title, r.category, r.regions?.name || 'All Kenya'],
    fields: [
      { k: 'region_id', l: 'Region', t: 'select', o: taRegionOpts, blank: 'All Kenya (general tip)' },
      { k: 'category', l: 'Category', t: 'select', req: true,
        o: () => taPairs(['general', 'safety', 'health', 'money', 'culture', 'packing', 'weather', 'communication']) },
      { k: 'title', l: 'Title', t: 'text', req: true },
      { k: 'content', l: 'Content', t: 'textarea', req: true },
      { k: 'sort_order', l: 'Sort order', t: 'number', def: 0 }
    ]
  },
  transport: {
    table: 'transport_options', label: 'Transport option', select: '*, regions(name)',
    order: [['created_at', false]],
    heads: ['Title', 'Mode', 'Region'],
    cells: r => [r.title, r.mode.replace(/_/g, ' '), r.regions?.name || '-'],
    fields: [
      { k: 'region_id', l: 'Region', t: 'select', o: taRegionOpts, req: true },
      { k: 'mode', l: 'Mode', t: 'select', req: true,
        o: () => taPairs(['train', 'bus', 'matatu', 'flight', 'ferry', 'taxi', 'ride_hail', 'tuk_tuk', 'boda_boda', 'car_hire', 'walking']) },
      { k: 'title', l: 'Title', t: 'text', req: true },
      { k: 'from_location', l: 'From', t: 'text' },
      { k: 'to_location', l: 'To', t: 'text' },
      { k: 'description', l: 'Description', t: 'textarea' },
      { k: 'operator', l: 'Operator', t: 'text' },
      { k: 'cost_min', l: 'Cost from (KES)', t: 'number' },
      { k: 'cost_max', l: 'Cost to (KES)', t: 'number' },
      { k: 'duration_minutes', l: 'Duration (minutes)', t: 'number' },
      { k: 'tips', l: 'Tips', t: 'textarea' },
      { k: 'sort_order', l: 'Sort order', t: 'number', def: 0 }
    ]
  },
  itineraries: {
    table: 'itineraries', label: 'Itinerary', select: '*, regions(name)',
    order: [['created_at', false]],
    heads: ['Title', 'Region', 'Days', 'Status'],
    cells: r => [r.title, r.regions?.name || '-', r.duration_days, taBadge(r.is_published)],
    fields: [
      { k: 'region_id', l: 'Region', t: 'select', o: taRegionOpts, req: true },
      { k: 'title', l: 'Title', t: 'text', req: true },
      { k: 'summary', l: 'Summary', t: 'textarea', req: true },
      { k: 'duration_days', l: 'Duration (days)', t: 'number', req: true, def: 1 },
      { k: 'budget_level', l: 'Budget level', t: 'select', req: true,
        o: () => [['budget', 'Budget'], ['mid_range', 'Mid-range'], ['luxury', 'Luxury']] },
      { k: 'est_cost_min', l: 'Estimated cost from (KES per person)', t: 'number' },
      { k: 'est_cost_max', l: 'Estimated cost to (KES per person)', t: 'number' },
      { k: 'best_season', l: 'Best season', t: 'text' },
      { k: 'is_published', l: 'Published (visible to travellers)', t: 'checkbox' }
    ]
  },
  stops: {
    table: 'itinerary_stops', label: 'Stop', select: '*, tourist_sites(title)',
    order: [['day_number', true], ['stop_order', true]],
    heads: ['Day', 'Order', 'Title', 'Linked site'],
    cells: r => [r.day_number, r.stop_order, r.title, r.tourist_sites?.title || '-'],
    fields: [
      { k: 'day_number', l: 'Day number', t: 'number', req: true, def: 1 },
      { k: 'stop_order', l: 'Order within the day', t: 'number', req: true, def: 1 },
      { k: 'title', l: 'Title', t: 'text', req: true },
      { k: 'description', l: 'Description', t: 'textarea' },
      { k: 'time_of_day', l: 'Time of day', t: 'select',
        o: () => [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening'], ['full_day', 'Full day']], blank: 'Not set' },
      { k: 'duration_minutes', l: 'Duration (minutes)', t: 'number' },
      { k: 'location_name', l: 'Location name', t: 'text' },
      { k: 'transport_note', l: 'How to get here from the previous stop', t: 'textarea' },
      { k: 'site_id', l: 'Link a bookable site (shows a Book button)', t: 'select', o: taSiteOpts, blank: 'None' }
    ]
  }
};

// ---------- loading ----------
async function loadTravelAdmin() {
  await taLoadLookups();
  await taLoadTab(TA.tab);
}

async function taLoadLookups() {
  const [regions, sites] = await Promise.all([
    supabaseClient.from('regions').select('id, name').order('name'),
    supabaseClient.from('tourist_sites').select('id, title').order('title')
  ]);
  TA.regions = regions.data || [];
  TA.sites = sites.data || [];
  taFillSiteRegionSelect();
}

async function taLoadTab(entity) {
  TA.tab = entity;
  const ent = TA_ENTITIES[entity];
  const root = document.getElementById('travelAdminBody');
  if (!root) return;

  document.querySelectorAll('[data-ta-tab]').forEach(b => b.classList.toggle('active', b.dataset.taTab === entity));
  root.innerHTML = '<p class="loading-td">Loading...</p>';

  let q = supabaseClient.from(ent.table).select(ent.select);
  ent.order.forEach(([col, asc]) => { q = q.order(col, { ascending: asc }); });
  const { data, error } = await q;
  if (error) {
    root.innerHTML = `<p class="loading-td">Could not load: ${escapeHtml(error.message)}. Have you run travel_guide.sql?</p>`;
    return;
  }
  TA.rows[entity] = data || [];
  root.innerHTML = taTable(entity, TA.rows[entity]);
  if (window.lucide) lucide.createIcons();
}

function taTable(entity, rows, extraAction) {
  const ent = TA_ENTITIES[entity];
  const body = rows.length ? rows.map(r => `
    <tr>
      ${ent.cells(r).map((c, i) => `<td>${i === 0 && typeof c === 'string' ? escapeHtml(c) : (typeof c === 'string' && c.startsWith('<span') ? c : escapeHtml(c))}</td>`).join('')}
      <td>
        <div class="btn-action-group">
          ${entity === 'itineraries' ? `<button class="btn-action" title="Manage stops" data-ta-act="stops" data-id="${r.id}"><i data-lucide="list-ordered"></i></button>` : ''}
          <button class="btn-action" title="Edit" data-ta-act="edit" data-entity="${entity}" data-id="${r.id}"><i data-lucide="edit-3"></i></button>
          <button class="btn-action btn-danger" title="Delete" data-ta-act="del" data-entity="${entity}" data-id="${r.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    </tr>`).join('')
    : `<tr><td colspan="${ent.heads.length + 1}" class="loading-td">Nothing here yet.</td></tr>`;

  return `
    <div class="ta-actions">
      <button class="btn btn-primary" data-ta-act="add" data-entity="${entity}"><i data-lucide="plus"></i> Add ${ent.label.toLowerCase()}</button>
    </div>
    <div class="table-container">
      <table>
        <thead><tr>${ent.heads.map(h => `<th>${h}</th>`).join('')}<th>Actions</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

// ---------- form modal ----------
function taOpenForm(entity, id, fixed) {
  const ent = TA_ENTITIES[entity];
  const row = id ? (TA.rows[entity] || []).find(r => r.id === id) : null;
  TA.editing = { entity, id: id || null, fixed: fixed || null };

  document.getElementById('taFormTitle').textContent = `${id ? 'Edit' : 'Add'} ${ent.label.toLowerCase()}`;
  document.getElementById('taFormFields').innerHTML = ent.fields.map(f => {
    const val = row ? row[f.k] : (f.def !== undefined ? f.def : '');
    const v = val === null || val === undefined ? '' : val;
    const idAttr = `ta-f-${f.k}`;
    let input;
    if (f.t === 'textarea') {
      input = `<textarea id="${idAttr}" rows="3" ${f.req ? 'required' : ''}>${escapeHtml(v)}</textarea>`;
    } else if (f.t === 'select') {
      const opts = f.o().map(([ov, ol]) => `<option value="${escapeHtml(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${escapeHtml(ol)}</option>`).join('');
      input = `<select id="${idAttr}" ${f.req ? 'required' : ''}>${f.req ? '' : `<option value="">${escapeHtml(f.blank || 'None')}</option>`}${opts}</select>`;
    } else if (f.t === 'checkbox') {
      return `<div class="form-group ta-check"><label><input type="checkbox" id="${idAttr}" ${v ? 'checked' : ''}> ${escapeHtml(f.l)}</label></div>`;
    } else {
      input = `<input type="${f.t === 'number' ? 'number' : 'text'}" ${f.t === 'number' ? 'step="any" min="0"' : ''} id="${idAttr}" value="${escapeHtml(v)}" ${f.req ? 'required' : ''}>`;
    }
    return `<div class="form-group"><label for="${idAttr}">${escapeHtml(f.l)}</label>${input}</div>`;
  }).join('');

  document.getElementById('taFormModal').classList.remove('hidden');
}

async function taSaveForm(e) {
  e.preventDefault();
  const { entity, id, fixed } = TA.editing;
  const ent = TA_ENTITIES[entity];
  const btn = document.getElementById('taFormSaveBtn');

  const payload = {};
  ent.fields.forEach(f => {
    const el = document.getElementById(`ta-f-${f.k}`);
    let v;
    if (f.t === 'checkbox') v = el.checked;
    else if (f.t === 'number') v = el.value === '' ? null : Number(el.value);
    else { v = el.value.trim(); if (v === '' && !f.req) v = null; }
    if (v === null && f.def !== undefined) v = f.def;
    payload[f.k] = v;
  });
  if (entity === 'regions' && !payload.slug) payload.slug = taSlug(payload.name);
  if (fixed) Object.assign(payload, fixed);
  if (!id && entity === 'itineraries') payload.created_by = currentAdmin?.id || null;

  btn.disabled = true;
  try {
    const q = id
      ? supabaseClient.from(ent.table).update(payload).eq('id', id)
      : supabaseClient.from(ent.table).insert([payload]);
    const { error } = await q;
    if (error) throw error;

    document.getElementById('taFormModal').classList.add('hidden');
    if (entity === 'stops') await taLoadStops();
    else {
      if (entity === 'regions') await taLoadLookups();
      await taLoadTab(TA.tab);
    }
  } catch (err) {
    alert(`Save failed: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function taDelete(entity, id) {
  const ent = TA_ENTITIES[entity];
  const warn = entity === 'regions'
    ? 'Delete this region? Its tips, transport options and itineraries will be deleted too.'
    : `Delete this ${ent.label.toLowerCase()}?`;
  if (!confirm(warn)) return;

  const { error } = await supabaseClient.from(ent.table).delete().eq('id', id);
  if (error) { alert(`Delete failed: ${error.message}`); return; }

  if (entity === 'stops') await taLoadStops();
  else {
    if (entity === 'regions') await taLoadLookups();
    await taLoadTab(TA.tab);
  }
}

// ---------- stops modal ----------
async function taOpenStops(itineraryId) {
  TA.stopsItinerary = (TA.rows.itineraries || []).find(i => i.id === itineraryId);
  if (!TA.stopsItinerary) return;
  document.getElementById('taStopsTitle').textContent = `Stops: ${TA.stopsItinerary.title}`;
  document.getElementById('taStopsModal').classList.remove('hidden');
  await taLoadStops();
}

async function taLoadStops() {
  const body = document.getElementById('taStopsBody');
  const ent = TA_ENTITIES.stops;
  const { data, error } = await supabaseClient
    .from(ent.table).select(ent.select)
    .eq('itinerary_id', TA.stopsItinerary.id)
    .order('day_number').order('stop_order');
  if (error) { body.innerHTML = `<p class="loading-td">${escapeHtml(error.message)}</p>`; return; }
  TA.rows.stops = data || [];
  body.innerHTML = taTable('stops', TA.rows.stops);
  if (window.lucide) lucide.createIcons();
}

// ---------- site region dropdown on the admin "edit site" modal ----------
function taFillSiteRegionSelect() {
  const sel = document.getElementById('edit-site-region');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">No region</option>' +
    TA.regions.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)}</option>`).join('');
  sel.value = current;
}

// ---------- events ----------
document.addEventListener('DOMContentLoaded', () => {
  taLoadLookups().catch(() => {});

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-ta-tab]');
    if (tab) { taLoadTab(tab.dataset.taTab); return; }

    const btn = e.target.closest('[data-ta-act]');
    if (!btn) return;
    const { taAct, entity, id } = btn.dataset;
    const fixed = entity === 'stops' ? { itinerary_id: TA.stopsItinerary?.id } : null;

    if (taAct === 'add') taOpenForm(entity, null, fixed);
    if (taAct === 'edit') taOpenForm(entity, id, fixed);
    if (taAct === 'del') taDelete(entity, id);
    if (taAct === 'stops') taOpenStops(id);
  });

  document.getElementById('taFormForm')?.addEventListener('submit', taSaveForm);
  document.getElementById('taCloseFormBtn')?.addEventListener('click', () => document.getElementById('taFormModal').classList.add('hidden'));
  document.getElementById('taCloseStopsBtn')?.addEventListener('click', () => document.getElementById('taStopsModal').classList.add('hidden'));

  ['taFormModal', 'taStopsModal'].forEach(mid => {
    const m = document.getElementById(mid);
    m?.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hidden'); });
  });
});
