/* ============================================================
   DentalMart — shared site script (loaded by every page)
   - catalogue grid + search/filter read from /assets/products.json
   - quote list stored in the browser, keyed by SKU
   - slide-out quote drawer injected on every page
   - Web3Forms submission for quote + contact forms

   SETUP: paste your Web3Forms access key on the next line.
   ============================================================ */
const WEB3FORMS_ACCESS_KEY = "YOUR_WEB3FORMS_ACCESS_KEY";

/* Categories are derived from products.json at load time, so a new value in the
   CSV creates a new filter chip automatically. This list only sets the order
   the familiar ones appear in; anything new lands after them, alphabetically. */
const CAT_ORDER = ['Consumables', 'Instruments', 'Materials', 'Equipment'];
let CATS = ['All'];
function buildCatList(items){
  const found = [...new Set(items.map(p => p.cat).filter(Boolean))];
  found.sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
    if(ia !== -1 && ib !== -1) return ia - ib;
    if(ia !== -1) return -1;
    if(ib !== -1) return 1;
    return a.localeCompare(b);
  });
  CATS = ['All', ...found];
}

const ICONS = {
  Consumables:'<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  Equipment:'<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  Instruments:'<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.4 2.4-2-2 2.4-2.4z"/></svg>',
  Materials:'<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v5L5 17a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/></svg>',
  _default:'<svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M8 6V4h8v2"/></svg>'
};
const fallbackIcon = cat => ICONS[cat] || ICONS._default;

const el = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---- quote list: { SKU: {n: name, q: qty} } ---- */
let mem = {};
function loadCart(){ try { return JSON.parse(localStorage.getItem('dm_cart')) || {}; } catch(e){ return mem; } }
function saveCart(c){ mem = c; try { localStorage.setItem('dm_cart', JSON.stringify(c)); } catch(e){} }
let cart = loadCart();
let PRODUCTS = [];

function totalQty(){ return Object.values(cart).reduce((a,b) => a + (b.q||0), 0); }
function updateBadge(){ const n = totalQty(), b = el('badge'); if(b){ b.textContent = n; b.classList.toggle('show', n > 0); } }

/* ---- drawer injected on every page ---- */
function injectUI(){
  const d = document.createElement('div');
  d.innerHTML = `
  <div class="overlay" id="overlay"></div>
  <aside class="drawer" id="drawer" aria-label="Quote list">
    <div class="dhead"><h2>Your quote list</h2><button class="dclose" id="dclose" aria-label="Close">&times;</button></div>
    <div class="ditems" id="ditems"></div>
    <div class="dfoot" id="dfoot">
      <div class="subrow"><span>Items in list</span><strong id="itemCount">0</strong></div>
      <p class="note">Add as many items as you like. We'll reply with pricing, bulk discounts, and availability for everything on your list.</p>
      <button class="cta" id="reqBtn" disabled>Request a quote</button>
    </div>
    <div class="qform hidden" id="qform">
      <div class="result" id="result"></div>
      <h3>Request a quote</h3>
      <div class="frow">
        <div class="field"><label for="f_name">Name</label><input id="f_name" required></div>
        <div class="field"><label for="f_clinic">Clinic</label><input id="f_clinic"></div>
      </div>
      <div class="frow">
        <div class="field"><label for="f_email">Email</label><input id="f_email" type="email" required></div>
        <div class="field"><label for="f_phone">Phone</label><input id="f_phone" type="tel"></div>
      </div>
      <div class="field"><label for="f_notes">Notes (optional)</label><textarea id="f_notes" rows="2" placeholder="Delivery timing, quantities, account #…"></textarea></div>
      <button class="cta" id="sendBtn">Send quote request</button>
      <button class="back" id="backBtn">&larr; Back to list</button>
    </div>
  </aside>`;
  document.body.appendChild(d);
  el('overlay').onclick = closeDrawer;
  el('dclose').onclick = closeDrawer;
  el('reqBtn').onclick = showForm;
  el('backBtn').onclick = hideForm;
  el('sendBtn').onclick = sendQuote;
  const qb = el('quoteBtn'); if(qb) qb.onclick = openDrawer;
  const nt = el('navToggle'), nav = el('navlinks');
  if(nt && nav){
    nt.onclick = () => {
      const open = nav.classList.toggle('open');
      nt.setAttribute('aria-expanded', String(open));
      nt.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    document.addEventListener('click', e => {
      if(nav.classList.contains('open') && !nav.contains(e.target) && !nt.contains(e.target)){
        nav.classList.remove('open');
        nt.setAttribute('aria-expanded', 'false');
      }
    });
  }
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeDrawer(); });
}

/* ---- quote list actions ---- */
function add(sku, name, btn){
  const item = cart[sku] || { n: name, q: 0 };
  item.n = name || item.n; item.q += 1;
  cart[sku] = item; saveCart(cart);
  if(btn){ btn.textContent = 'Added ✓'; btn.classList.add('added'); }
  updateBadge(); renderDrawer();
}
function changeQty(sku, d){
  if(!cart[sku]) return;
  cart[sku].q += d;
  if(cart[sku].q <= 0) delete cart[sku];
  saveCart(cart); updateBadge(); renderDrawer(); renderCatalogue(); renderFeatured();
}
function removeItem(sku){ delete cart[sku]; saveCart(cart); updateBadge(); renderDrawer(); renderCatalogue(); renderFeatured(); }

function renderDrawer(){
  const items = el('ditems'); if(!items) return;
  const skus = Object.keys(cart);
  el('itemCount').textContent = totalQty();
  el('reqBtn').disabled = skus.length === 0;
  if(!skus.length){ items.innerHTML = '<div class="dempty">Your quote list is empty.<br>Add items from the catalogue to get started.</div>'; return; }
  items.innerHTML = skus.map(sku => `<div class="ditem">
    <div class="ti"><div class="tn">${esc(cart[sku].n)}</div><div class="ts">SKU ${esc(sku)}</div>
      <div class="qty"><button onclick="changeQty('${esc(sku)}',-1)">&minus;</button><span>${cart[sku].q}</span><button onclick="changeQty('${esc(sku)}',1)">+</button></div></div>
    <button class="rm" onclick="removeItem('${esc(sku)}')">Remove</button></div>`).join('');
}
function openDrawer(){ el('overlay').classList.add('open'); el('drawer').classList.add('open'); }
function closeDrawer(){ el('overlay').classList.remove('open'); el('drawer').classList.remove('open'); }
function showForm(){ el('qform').classList.remove('hidden'); el('dfoot').style.display = 'none'; }
function hideForm(){ el('qform').classList.add('hidden'); el('dfoot').style.display = 'block'; }

/* ---- product card (links to the real product page) ---- */
function card(p){
  const added = cart[p.sku] ? ' added' : '';
  const pic = p.image
    ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`
    : `<div class="noimg"><span class="mk"></span><span class="lbl">Photo coming soon</span></div>`;
  return `<article class="pcard">
    <a class="plink" href="${esc(p.url)}">
      <div class="pic">${pic}<span class="view">View details</span></div>
      <div class="pbody-top"><div class="pcat">${esc(p.cat)}${p.brand ? ` &middot; ${esc(p.brand)}` : ''}</div><h3 class="pname">${esc(p.name)}</h3><div class="psku">SKU ${esc(p.sku)}</div></div>
    </a>
    <div class="pbody-bot"><button class="add${added}" data-sku="${esc(p.sku)}" data-name="${esc(p.name)}">${cart[p.sku] ? 'Added ✓' : 'Add to quote'}</button></div>
  </article>`;
}

/* ---- featured (home page) ---- */
function renderFeatured(){
  const box = el('featured'); if(!box || !PRODUCTS.length) return;
  const n = parseInt(box.dataset.count || '8', 10);
  const feat = PRODUCTS.filter(p => p.featured);
  box.innerHTML = (feat.length ? feat : PRODUCTS).slice(0, n).map(card).join('');
}

/* ---- catalogue (products page): faceted filters ---- */
const PAGE = 12;
const FACETS = [
  { key: 'cat',   label: 'Category', order: CAT_ORDER },
  { key: 'type',  label: 'Type' },
  { key: 'brand', label: 'Brand' }
];
const sel = { cat: new Set(), type: new Set(), brand: new Set() };
let term = '', visible = PAGE;

function facetValues(key){
  const f = FACETS.find(x => x.key === key) || {};
  const vals = [...new Set(PRODUCTS.map(p => p[key]).filter(Boolean))];
  vals.sort((a, b) => {
    if(f.order){ const ia = f.order.indexOf(a), ib = f.order.indexOf(b);
      if(ia !== -1 && ib !== -1) return ia - ib; if(ia !== -1) return -1; if(ib !== -1) return 1; }
    return a.localeCompare(b);
  });
  return vals;
}

/* term + every facet except `exceptKey` (so a facet never filters itself out) */
function passes(p, exceptKey){
  if(term){
    const hay = (p.name + ' ' + p.sku + ' ' + p.cat + ' ' + (p.type||'') + ' ' + (p.brand||'') + ' ' + (p.keywords||'')).toLowerCase();
    if(!hay.includes(term)) return false;
  }
  for(const f of FACETS){
    if(f.key === exceptKey) continue;
    const s = sel[f.key];
    if(s.size && !s.has(p[f.key])) return false;
  }
  return true;
}
const match = p => passes(p, null);
const activeCount = () => FACETS.reduce((a, f) => a + sel[f.key].size, 0);

const FACET_LIMIT = 10;      // options shown per group before "Show more"
const expanded = {};         // which groups the user has expanded

function renderFilters(){
  const box = el('filters'); if(!box) return;
  let html = '';
  for(const f of FACETS){
    const vals = facetValues(f.key);
    if(vals.length < 2) continue;
    const rows = [];
    for(const v of vals){
      const n = PRODUCTS.filter(p => passes(p, f.key) && p[f.key] === v).length;
      const on = sel[f.key].has(v);
      if(!n && !on) continue;
      rows.push({ on, html: `<label class="frow2${on ? ' on' : ''}${!n ? ' zero' : ''}">
        <input type="checkbox" data-facet="${f.key}" value="${esc(v)}"${on ? ' checked' : ''}>
        <span class="fname">${esc(v)}</span><span class="fnum">${n}</span></label>` });
    }
    if(!rows.length) continue;

    const isOpen = !!expanded[f.key];
    let visibleRows;
    if(rows.length > FACET_LIMIT && !isOpen){
      visibleRows = rows.slice(0, FACET_LIMIT);
      rows.slice(FACET_LIMIT).forEach(r => { if(r.on) visibleRows.push(r); }); // never hide a checked option
    } else {
      visibleRows = rows;
    }

    let group = `<div class="fgroup"><h4>${esc(f.label)}</h4>${visibleRows.map(r => r.html).join('')}`;
    const hidden = rows.length - visibleRows.length;
    if(isOpen || hidden > 0)
      group += `<button class="fmore" data-facet="${f.key}">${isOpen ? 'Show less' : `Show ${hidden} more`}</button>`;
    group += `</div>`;
    html += group;
  }
  box.innerHTML = html || '<p class="fnone">No filters yet.</p>';
  box.querySelectorAll('input[type=checkbox]').forEach(cb => cb.onchange = () => {
    const s = sel[cb.dataset.facet];
    cb.checked ? s.add(cb.value) : s.delete(cb.value);
    visible = PAGE; refresh();
  });
  box.querySelectorAll('.fmore').forEach(b => b.onclick = () => {
    expanded[b.dataset.facet] = !expanded[b.dataset.facet];
    renderFilters();
  });
  const ft = el('filterToggle');
  if(ft){ const c = activeCount(); const t = ft.querySelector('.fcount'); if(t) t.textContent = c ? `(${c})` : ''; }
}

function renderActive(){
  const box = el('activeFilters'); if(!box) return;
  const pills = [];
  for(const f of FACETS) for(const v of sel[f.key])
    pills.push(`<button class="apill" data-facet="${f.key}" data-val="${esc(v)}">${esc(v)} <span>&times;</span></button>`);
  box.innerHTML = pills.length ? pills.join('') + '<button class="aclear" id="clearFilters">Clear all</button>' : '';
  box.querySelectorAll('.apill').forEach(b => b.onclick = () => { sel[b.dataset.facet].delete(b.dataset.val); visible = PAGE; refresh(); });
  const cl = el('clearFilters'); if(cl) cl.onclick = () => { FACETS.forEach(f => sel[f.key].clear()); visible = PAGE; refresh(); };
}

function renderCatalogue(){
  const grid = el('grid'); if(!grid || !PRODUCTS.length) return;
  const list = PRODUCTS.filter(match), shown = list.slice(0, visible);
  const c = el('count'); if(c) c.textContent = list.length ? `Showing ${shown.length} of ${list.length}` : '';
  if(!list.length){
    grid.innerHTML = '<div class="empty">No products match your filters. Try clearing one.</div>';
    el('loadmore').classList.add('hide'); return;
  }
  grid.innerHTML = shown.map(card).join('');
  el('loadmore').classList.toggle('hide', list.length <= visible);
}

function refresh(){ renderFilters(); renderActive(); renderCatalogue(); }

function initCatalogue(){
  const s = el('search');
  if(s) s.addEventListener('input', e => { term = e.target.value.trim().toLowerCase(); visible = PAGE; refresh(); });
  const lm = el('loadmore'); if(lm) lm.onclick = () => { visible += PAGE; renderCatalogue(); };
  const ft = el('filterToggle'); if(ft) ft.onclick = () => el('filters').classList.toggle('open');
  const params = new URLSearchParams(location.search);
  for(const f of FACETS){ const v = params.get(f.key); if(v && facetValues(f.key).includes(v)) sel[f.key].add(v); }
  refresh();
}

async function loadProducts(){
  if(!el('grid') && !el('featured')) return;
  if(Array.isArray(window.__DM_PRODUCTS)){          // offline preview build
    PRODUCTS = window.__DM_PRODUCTS;
  } else {
    try {
      const r = await fetch('/assets/products.json', { cache: 'no-cache' });
      PRODUCTS = await r.json();
    } catch(e){ PRODUCTS = []; }
  }
  buildCatList(PRODUCTS);
  renderFeatured();
  if(el('grid')) initCatalogue();
}

/* ---- quote submit ---- */
function quoteText(){ return Object.keys(cart).map(sku => `${cart[sku].q} x ${cart[sku].n} (SKU ${sku})`).join('\n'); }
async function sendQuote(){
  const res = el('result'); res.className = 'result';
  const name = el('f_name').value.trim(), email = el('f_email').value.trim();
  if(!name || !email){ res.className = 'result err'; res.textContent = 'Please add your name and email.'; return; }
  if(WEB3FORMS_ACCESS_KEY === "YOUR_WEB3FORMS_ACCESS_KEY"){ res.className = 'result err'; res.textContent = 'Setup step left: add your Web3Forms access key in assets/site.js.'; return; }
  const btn = el('sendBtn'); btn.disabled = true; const lbl = btn.textContent; btn.textContent = 'Sending…';
  const payload = { access_key: WEB3FORMS_ACCESS_KEY, subject: 'New quote request — DentalMart', from_name: 'DentalMart website',
    name, email, clinic: el('f_clinic').value.trim(), phone: el('f_phone').value.trim(), notes: el('f_notes').value.trim(),
    item_count: totalQty(), requested_items: quoteText() };
  try {
    const r = await fetch('https://api.web3forms.com/submit', { method:'POST', headers:{'Content-Type':'application/json', Accept:'application/json'}, body: JSON.stringify(payload) });
    const j = await r.json();
    if(j.success){
      res.className = 'result ok';
      res.textContent = 'Thanks! Your quote request is in. We\u2019ll get back to you within one business day.';
      cart = {}; saveCart(cart); updateBadge(); renderDrawer(); renderCatalogue(); renderFeatured();
    } else { res.className = 'result err'; res.textContent = 'Something went wrong. Please email quotes@dentalmart.ca.'; }
  } catch(e){ res.className = 'result err'; res.textContent = 'Network issue. Please try again, or email quotes@dentalmart.ca.'; }
  finally { btn.disabled = false; btn.textContent = lbl; }
}

/* ---- contact form ---- */
async function sendContact(){
  const res = el('c_result'); res.className = 'result';
  const name = el('c_name').value.trim(), email = el('c_email').value.trim();
  if(!name || !email){ res.className = 'result err'; res.textContent = 'Please add your name and email.'; return; }
  if(WEB3FORMS_ACCESS_KEY === "YOUR_WEB3FORMS_ACCESS_KEY"){ res.className = 'result err'; res.textContent = 'Setup step left: add your Web3Forms access key in assets/site.js.'; return; }
  const btn = el('c_send'); btn.disabled = true; const lbl = btn.textContent; btn.textContent = 'Sending…';
  const payload = { access_key: WEB3FORMS_ACCESS_KEY, subject: 'New message — DentalMart', from_name: 'DentalMart website',
    name, email, clinic: el('c_clinic').value.trim(), phone: el('c_phone').value.trim(), message: el('c_message').value.trim() };
  try {
    const r = await fetch('https://api.web3forms.com/submit', { method:'POST', headers:{'Content-Type':'application/json', Accept:'application/json'}, body: JSON.stringify(payload) });
    const j = await r.json();
    if(j.success){
      res.className = 'result ok';
      res.textContent = 'Thanks! Your message is in. We\u2019ll reply within one business day.';
      ['c_name','c_clinic','c_email','c_phone','c_message'].forEach(i => el(i).value = '');
    } else { res.className = 'result err'; res.textContent = 'Something went wrong. Please email hello@dentalmart.ca.'; }
  } catch(e){ res.className = 'result err'; res.textContent = 'Network issue. Please try again, or email hello@dentalmart.ca.'; }
  finally { btn.disabled = false; btn.textContent = lbl; }
}

/* ---- boot ---- */
document.addEventListener('DOMContentLoaded', () => {
  injectUI();
  updateBadge();
  renderDrawer();
  loadProducts();
  const cf = el('c_send'); if(cf) cf.onclick = sendContact;
  document.addEventListener('click', e => {
    const b = e.target.closest('.add, .madd');
    if(!b || !b.dataset.sku) return;
    e.preventDefault(); e.stopPropagation();
    add(b.dataset.sku, b.dataset.name, b);
  });
});
