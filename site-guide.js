// =============================================
// SITE TRAVEL GUIDE (tips + transport per site)
// Artisans: add / edit / delete tips and transport for their own sites.
// Customers: read-only view of the same data.
// Depends on: supabaseClient (app.js), cachedSites / activeMode / activeArtisan /
// escapeHtml (dashboard.js), TRAVEL_MODES / TRAVEL_TIP_CATEGORIES /
// travelCostRange / travelDuration / travelState (travel.js)
// =============================================
const SG = {
  site: null,
  tab: 'tips',
  tips: [],
  transport: [],
  editing: null,   // { type: 'tips' | 'transport', id: string | null }
  loading: false
};

function sgCanEdit() {
  return activeMode === 'artisan' && activeArtisan && SG.site && SG.site.artisan_id === activeArtisan.id;
}

async function openSiteGuide(siteId) {
  const site = cachedSites.find(s => s.id === siteId);
  if (!site) return;

  SG.site = site;
  SG.tab = 'tips';
  SG.editing = null;
  SG.tips = [];
  SG.transport = [];

  document.getElementById('siteGuideTitle').textContent = site.title || 'Travel guide';
  document.getElementById('siteGuideSubtitle').textContent = sgCanEdit()
    ? 'Help visitors plan: add tips and how to get here'
    : 'Tips and transport from the host';
  document.getElementById('siteGuideModal').classList.remove('hidden');
  sgRenderTabs();
  document.getElementById('siteGuideBody').innerHTML = '<p class="muted">Loading...</p>';

  await sgLoad();
  sgRender();
}

async function sgLoad() {
  try {
    const [tips, transport] = await Promise.all([
      supabaseClient.from('travel_tips').select('*').eq('site_id', SG.site.id).order('sort_order').order('created_at'),
      supabaseClient.from('transport_options').select('*').eq('site_id', SG.site.id).order('sort_order').order('created_at')
    ]);
    if (tips.error) throw tips.error;
    if (transport.error) throw transport.error;
    SG.tips = tips.data || [];
    SG.transport = transport.data || [];
  } catch (err) {
    console.error('Site guide load error:', err);
    document.getElementById('siteGuideBody').innerHTML =
      `<p class="muted">Could not load the travel guide: ${escapeHtml(err.message || 'unknown error')}</p>`;
    throw err;
  }
}

function sgRenderTabs() {
  document.querySelectorAll('.sg-tab').forEach(b => b.classList.toggle('active', b.dataset.sgTab === SG.tab));
}

function sgRender() {
  sgRenderTabs();
  const body = document.getElementById('siteGuideBody');
  const rows = SG.tab === 'tips' ? SG.tips : SG.transport;
  const canEdit = sgCanEdit();

  const list = rows.length
    ? `<div class="sg-list">${rows.map(r => SG.tab === 'tips' ? sgTipCard(r, canEdit) : sgTransportCard(r, canEdit)).join('')}</div>`
    : `<p class="muted" style="margin-bottom:14px;">${canEdit
        ? `No ${SG.tab === 'tips' ? 'tips' : 'transport options'} yet. Add the first one below.`
        : `The host hasn't added ${SG.tab === 'tips' ? 'tips' : 'transport information'} for this site yet.`}</p>`;

  body.innerHTML = list + (canEdit ? sgForm() : '');
  if (window.lucide) lucide.createIcons();
}

function sgTipCard(t, canEdit) {
  const cat = TRAVEL_TIP_CATEGORIES[t.category] || TRAVEL_TIP_CATEGORIES.general;
  return `
    <div class="sg-item">
      <div class="sg-item-head">
        <div>
          <span class="sg-tag">${escapeHtml(cat.label)}</span>
          <h4>${escapeHtml(t.title)}</h4>
        </div>
        ${canEdit ? sgItemActions(t.id) : ''}
      </div>
      <p class="sg-text">${escapeHtml(t.content)}</p>
    </div>`;
}

function sgTransportCard(o, canEdit) {
  const mode = TRAVEL_MODES[o.mode] || { label: o.mode };
  const route = [o.from_location, o.to_location].filter(Boolean).map(escapeHtml).join(' → ');
  const dur = travelDuration(o.duration_minutes);
  return `
    <div class="sg-item">
      <div class="sg-item-head">
        <div>
          <span class="sg-tag">${escapeHtml(mode.label)}</span>
          <h4>${escapeHtml(o.title)}</h4>
          ${route ? `<p class="muted-small">${route}</p>` : ''}
        </div>
        ${canEdit ? sgItemActions(o.id) : ''}
      </div>
      ${o.description ? `<p class="sg-text">${escapeHtml(o.description)}</p>` : ''}
      <div class="sg-meta">
        <span>${escapeHtml(travelCostRange(o.cost_min, o.cost_max, o.currency))}</span>
        ${dur ? `<span>${dur}</span>` : ''}
        ${o.operator ? `<span>${escapeHtml(o.operator)}</span>` : ''}
      </div>
      ${o.tips ? `<p class="sg-text"><strong>Tip:</strong> ${escapeHtml(o.tips)}</p>` : ''}
    </div>`;
}

function sgItemActions(id) {
  return `
    <div class="sg-item-actions">
      <button type="button" class="btn btn-outline btn-small" data-sg-edit="${escapeHtml(id)}" aria-label="Edit"><i data-lucide="edit-3"></i></button>
      <button type="button" class="btn btn-danger btn-small" data-sg-delete="${escapeHtml(id)}" aria-label="Delete"><i data-lucide="trash-2"></i></button>
    </div>`;
}

// ---------- form ----------
function sgForm() {
  const editingRow = SG.editing && SG.editing.type === SG.tab
    ? (SG.tab === 'tips' ? SG.tips : SG.transport).find(r => r.id === SG.editing.id) : null;
  const v = (k, d = '') => escapeHtml(editingRow && editingRow[k] !== null && editingRow[k] !== undefined ? editingRow[k] : d);
  const heading = editingRow ? 'Edit' : 'Add';
  const actions = `
    <div class="sg-form-actions">
      <button type="submit" class="btn btn-primary" id="sgSaveBtn">${editingRow ? 'Save changes' : (SG.tab === 'tips' ? 'Add tip' : 'Add transport option')}</button>
      ${editingRow ? '<button type="button" class="btn btn-outline" id="sgCancelEdit">Cancel</button>' : ''}
    </div>`;

  if (SG.tab === 'tips') {
    const cats = Object.entries(TRAVEL_TIP_CATEGORIES).map(([k, c]) =>
      `<option value="${k}" ${v('category', 'general') === k ? 'selected' : ''}>${c.label}</option>`).join('');
    return `
      <form class="sg-form" id="sgForm" data-sg-form="tips">
        <h4>${heading} a travel tip</h4>
        <div class="form-group">
          <label for="sg-category">Category</label>
          <select id="sg-category">${cats}</select>
        </div>
        <div class="form-group">
          <label for="sg-title">Title</label>
          <input type="text" id="sg-title" maxlength="120" placeholder="e.g. Best time to arrive" value="${v('title')}" required>
        </div>
        <div class="form-group">
          <label for="sg-content">Tip</label>
          <textarea id="sg-content" rows="4" placeholder="What should visitors know before they come?" required>${v('content')}</textarea>
        </div>
        ${actions}
      </form>`;
  }

  const modes = Object.entries(TRAVEL_MODES).map(([k, m]) =>
    `<option value="${k}" ${v('mode', 'matatu') === k ? 'selected' : ''}>${m.label}</option>`).join('');
  return `
    <form class="sg-form" id="sgForm" data-sg-form="transport">
      <h4>${heading} a transport option</h4>
      <div class="form-row">
        <div class="form-group">
          <label for="sg-mode">Mode</label>
          <select id="sg-mode">${modes}</select>
        </div>
        <div class="form-group">
          <label for="sg-title">Title</label>
          <input type="text" id="sg-title" maxlength="120" placeholder="e.g. Matatu from Voi stage" value="${v('title')}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="sg-from">From</label>
          <input type="text" id="sg-from" placeholder="e.g. Voi town" value="${v('from_location')}">
        </div>
        <div class="form-group">
          <label for="sg-to">To</label>
          <input type="text" id="sg-to" placeholder="e.g. the workshop" value="${v('to_location')}">
        </div>
      </div>
      <div class="form-group">
        <label for="sg-desc">Directions / details</label>
        <textarea id="sg-desc" rows="3" placeholder="Where to board, landmarks, drop-off point...">${v('description')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="sg-cost-min">Cost from (KES)</label>
          <input type="number" id="sg-cost-min" min="0" step="1" value="${v('cost_min')}">
        </div>
        <div class="form-group">
          <label for="sg-cost-max">Cost to (KES)</label>
          <input type="number" id="sg-cost-max" min="0" step="1" value="${v('cost_max')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="sg-duration">Duration (minutes)</label>
          <input type="number" id="sg-duration" min="1" step="1" value="${v('duration_minutes')}">
        </div>
        <div class="form-group">
          <label for="sg-operator">Operator (optional)</label>
          <input type="text" id="sg-operator" placeholder="e.g. Mombasa Raha" value="${v('operator')}">
        </div>
      </div>
      <div class="form-group">
        <label for="sg-tips">Tips (optional)</label>
        <textarea id="sg-tips" rows="2" placeholder="e.g. Last matatu leaves at 6pm">${v('tips')}</textarea>
      </div>
      ${actions}
    </form>`;
}

const sgNum = (id) => {
  const raw = document.getElementById(id).value.trim();
  return raw === '' ? null : Number(raw);
};
const sgText = (id) => document.getElementById(id).value.trim() || null;

async function sgSave(form) {
  if (!sgCanEdit()) return;
  const btn = document.getElementById('sgSaveBtn');
  const type = form.dataset.sgForm;
  btn.disabled = true;

  try {
    let table, payload;
    if (type === 'tips') {
      table = 'travel_tips';
      payload = {
        category: document.getElementById('sg-category').value,
        title: document.getElementById('sg-title').value.trim(),
        content: document.getElementById('sg-content').value.trim()
      };
    } else {
      table = 'transport_options';
      payload = {
        mode: document.getElementById('sg-mode').value,
        title: document.getElementById('sg-title').value.trim(),
        from_location: sgText('sg-from'),
        to_location: sgText('sg-to'),
        description: sgText('sg-desc'),
        operator: sgText('sg-operator'),
        cost_min: sgNum('sg-cost-min'),
        cost_max: sgNum('sg-cost-max'),
        duration_minutes: sgNum('sg-duration'),
        tips: sgText('sg-tips')
      };
      if (payload.cost_min !== null && payload.cost_max !== null && payload.cost_max < payload.cost_min) {
        throw new Error('"Cost to" cannot be lower than "Cost from".');
      }
    }

    const editingId = SG.editing && SG.editing.type === type ? SG.editing.id : null;
    if (editingId) {
      const { error } = await supabaseClient.from(table).update(payload).eq('id', editingId);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from(table).insert([{
        ...payload,
        artisan_id: activeArtisan.id,
        site_id: SG.site.id,
        region_id: SG.site.region_id || null
      }]);
      if (error) throw error;
    }

    SG.editing = null;
    travelState.cache = {};   // so the public Travel Guide tab refetches
    await sgLoad();
    sgRender();
  } catch (err) {
    alert(`Could not save: ${err.message}`);
    btn.disabled = false;
  }
}

async function sgDelete(id) {
  if (!sgCanEdit()) return;
  if (!confirm('Delete this item?')) return;
  const table = SG.tab === 'tips' ? 'travel_tips' : 'transport_options';
  try {
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if (error) throw error;
    SG.editing = null;
    travelState.cache = {};
    await sgLoad();
    sgRender();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

// ---------- events ----------
document.addEventListener('DOMContentLoaded', () => {
  const feed = document.getElementById('sitesFeedContainer');
  if (feed) {
    feed.addEventListener('click', (e) => {
      const btn = e.target.closest('.action-site-guide');
      if (btn) { e.preventDefault(); openSiteGuide(btn.dataset.siteId); }
    });
  }

  const modal = document.getElementById('siteGuideModal');
  if (!modal) return;

  document.getElementById('closeSiteGuideBtn')?.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) { modal.classList.add('hidden'); return; }

    const tab = e.target.closest('[data-sg-tab]');
    if (tab) { SG.tab = tab.dataset.sgTab; SG.editing = null; sgRender(); return; }

    const edit = e.target.closest('[data-sg-edit]');
    if (edit) {
      SG.editing = { type: SG.tab, id: edit.dataset.sgEdit };
      sgRender();
      document.getElementById('sgForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const del = e.target.closest('[data-sg-delete]');
    if (del) { sgDelete(del.dataset.sgDelete); return; }

    if (e.target.closest('#sgCancelEdit')) { SG.editing = null; sgRender(); }
  });

  modal.addEventListener('submit', (e) => {
    const form = e.target.closest('#sgForm');
    if (form) { e.preventDefault(); sgSave(form); }
  });
});
