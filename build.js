#!/usr/bin/env node
/* ============================================================
   DentalMart static build
   ------------------------------------------------------------
   Reads products.csv and generates, into /dist:
     - one SEO page per product   -> /product/<slug>.html
     - one page per category      -> /category/<slug>.html
     - catalogue data             -> /assets/products.json
     - sitemap.xml + robots.txt
   Everything else (index/about/contact/products, assets, images)
   is copied across untouched.

   Run:  node build.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

const SITE_URL = (process.env.SITE_URL || 'https://dentalmart.ca').replace(/\/$/, '');
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const COPY = ['index.html', 'about.html', 'contact.html', 'products.html', 'assets', 'images', 'favicon.ico', '_headers', '_redirects'];

const CAT_ORDER = ['Consumables', 'Instruments', 'Materials', 'Equipment'];

const CATEGORY_COPY = {
  Consumables: 'Everyday disposables for a busy operatory — gloves, barriers, bibs, and the restock items that run out fastest.',
  Instruments: 'Hand instruments and cassettes built from surgical-grade stainless steel, autoclavable and made for daily chairside use.',
  Materials:   'Restorative and impression materials with predictable working times and batch traceability for your compliance records.',
  Equipment:   'Operatory and sterilization equipment, supplied with setup guidance, warranty, and service across Canada.'
};

const catCopy = c => CATEGORY_COPY[c] || `Dental ${String(c).toLowerCase()} supplied to clinics across Canada — browse the range and request pricing.`;

/* ---------- tiny helpers ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map(h => h.trim().toLowerCase());
  return rows
    .filter(r => r.some(v => v.trim() !== ''))
    .map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) copyRecursive(path.join(src, f), path.join(dest, f));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

/* ---------- shared chrome ---------- */
const header = active => `
<header>
  <div class="wrap hin">
    <a href="/" class="logo"><span class="m"></span><span>DentalMart</span></a>
    <nav class="navlinks" id="navlinks">
      <a href="/"${active === 'home' ? ' class="on"' : ''}>Home</a>
      <a href="/products.html"${active === 'products' ? ' class="on"' : ''}>Products</a>
      <a href="/about.html">About</a>
      <a href="/contact.html">Contact</a>
    </nav>
    <button class="navtoggle" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="navlinks">
      <svg viewBox="0 0 24 24" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
    </button>
    <button class="quote-btn" id="quoteBtn">
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M6 6L5 3H2"/></svg>
      <span class="lbl">Quote list</span> <span class="badge" id="badge">0</span>
    </button>
  </div>
</header>`;

const footer = `
<footer>
  <div class="wrap fin">
    <span>&copy; ${new Date().getFullYear()} DentalMart &middot; Mississauga, ON</span>
    <nav class="fnav"><a href="/">Home</a><a href="/products.html">Products</a><a href="/about.html">About</a><a href="/contact.html">Contact</a></nav>
    <span class="wilk"><span class="s"></span>A Wilk Company</span>
  </div>
</footer>`;

const head = ({ title, desc, canonical, jsonld }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>`;

const CAT_ICONS = {
  Consumables:'<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  Equipment:'<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
  Instruments:'<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.4 2.4-2-2 2.4-2.4z"/></svg>',
  Materials:'<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v5L5 17a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/></svg>',
  _default:'<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M8 6V4h8v2"/></svg>'
};
const catIcon = c => CAT_ICONS[c] || CAT_ICONS._default;

const miniCard = p => `<article class="pcard">
  <a class="plink" href="${p.url}">
    <div class="pic">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="noimg"><span class="mk"></span><span class="lbl">Photo coming soon</span></div>`}<span class="view">View details</span></div>
    <div class="pbody-top"><div class="pcat">${esc(p.cat)}${p.brand ? ` &middot; ${esc(p.brand)}` : ''}</div><h3 class="pname">${esc(p.name)}</h3><div class="psku">SKU ${esc(p.sku)}</div></div>
  </a>
  <div class="pbody-bot"><button class="add" data-sku="${esc(p.sku)}" data-name="${esc(p.name)}">Add to quote</button></div>
</article>`;

/* ---------- product page ---------- */
function productPage(p, all) {
  const canonical = `${SITE_URL}${p.url}`;
  const title = `${p.name}${p.brand ? ' — ' + p.brand : ''} | DentalMart`;
  const desc = (p.short || `${p.name} (SKU ${p.sku}) — ${p.cat.toLowerCase()} supplied to dental clinics across Canada. Request pricing from DentalMart.`).slice(0, 300);

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: p.name,
        sku: p.sku,
        category: p.cat,
        description: p.short || desc,
        url: canonical,
        ...(p.image ? { image: SITE_URL + p.image } : {}),
        ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {})
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
          { '@type': 'ListItem', position: 2, name: 'Products', item: SITE_URL + '/products.html' },
          { '@type': 'ListItem', position: 3, name: p.cat, item: `${SITE_URL}/category/${slugify(p.cat)}.html` },
          { '@type': 'ListItem', position: 4, name: p.name, item: canonical }
        ]
      }
    ]
  };

  const related = all.filter(x => x.cat === p.cat && x.sku !== p.sku).slice(0, 4);

  return `${head({ title, desc, canonical, jsonld })}
${header('products')}

<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/">Home</a><span>/</span><a href="/products.html">Products</a><span>/</span><a href="/category/${slugify(p.cat)}.html">${esc(p.cat)}</a><span>/</span>${esc(p.name)}
  </nav>

  <div class="pdp">
    <div class="pdp-media">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : `<div class="noimg"><span class="mk"></span><span class="lbl">Photo coming soon</span></div>`}</div>
    <div class="pdp-info">
      <div class="pcat">${esc(p.cat)}</div>
      <h1>${esc(p.name)}</h1>
      <div class="pdp-meta">SKU <b>${esc(p.sku)}</b>${p.brand ? ` &middot; Brand <b>${esc(p.brand)}</b>` : ''}${p.pack ? ` &middot; Pack <b>${esc(p.pack)}</b>` : ''}</div>
      ${p.short ? `<p class="lede">${esc(p.short)}</p>` : ''}
      ${p.specs.length ? `<ul class="pdp-specs">${p.specs.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      <div class="pdp-cta">
        <button class="madd" data-sku="${esc(p.sku)}" data-name="${esc(p.name)}">Add to quote</button>
        <a class="btn btn-ghost" href="/products.html">Browse catalogue</a>
      </div>
      <p class="pdp-note">Add as many items as you need, then send one request — we'll come back with pricing, bulk discounts, and availability.</p>
    </div>
  </div>

  ${p.body ? `<section class="pdp-copy"><h2>About the ${esc(p.name)}</h2>${p.body.split('\n').filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('')}</section>` : ''}

  ${related.length ? `<section class="related">
    <h2>More ${esc(p.cat.toLowerCase())}</h2>
    <div class="grid">${related.map(miniCard).join('')}</div>
  </section>` : ''}
</div>

${footer}
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

/* ---------- category page ---------- */
function categoryPage(cat, items, CATEGORY_LINKS_PLACEHOLDER) {
  const slug = slugify(cat);
  const canonical = `${SITE_URL}/category/${slug}.html`;
  const title = `Dental ${cat} | Buy Online in Canada | DentalMart`;
  const desc = `${catCopy(cat)} Browse ${items.length} products and request a quote from DentalMart.`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Dental ${cat}`,
    url: canonical,
    description: desc,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: SITE_URL + p.url }))
    }
  };
  return `${head({ title, desc, canonical, jsonld })}
${header('products')}

<section class="pagebanner">
  <div class="bgimg" style="background-image:url('/images/banner-${slugify(cat)}.jpg'),url('/images/banner-products.jpg')"></div>
  <div class="wrap inner">
    <span class="beyebrow">${esc(cat)} &middot; ${items.length} product${items.length === 1 ? '' : 's'}</span>
    <h1>Dental ${esc(cat.toLowerCase())}</h1>
    <p class="sub">${esc(catCopy(cat))}</p>
    <p class="catlinks">Browse by category: ${CATEGORY_LINKS_PLACEHOLDER}</p>
  </div>
</section>

<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span><a href="/products.html">Products</a><span>/</span>${esc(cat)}</nav>
  <div class="toolbar"><span class="count">${items.length} product${items.length === 1 ? '' : 's'}</span></div>
  <div class="grid">${items.map(miniCard).join('')}</div>
  <div style="padding:34px 0 60px"><a class="btn btn-ghost" href="/products.html">Search the full catalogue</a></div>
</div>

${footer}
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

/* ---------- build ---------- */
function build() {
  const csvPath = path.join(ROOT, 'products.csv');
  if (!fs.existsSync(csvPath)) { console.error('products.csv not found'); process.exit(1); }

  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  const seenSlug = new Set(), seenSku = new Set();

  const products = rows.map(r => {
    const name = r.name || '';
    const sku = (r.sku || slugify(name)).toUpperCase();
    if (!name || !sku) return null;
    if (seenSku.has(sku)) { console.warn(`  ! duplicate SKU skipped: ${sku}`); return null; }
    seenSku.add(sku);

    let slug = slugify(name);
    if (!slug || seenSlug.has(slug)) slug = `${slug}-${slugify(sku)}`;
    seenSlug.add(slug);

    const imgFile = r.image || '';
    let image = '';
    if (imgFile) image = imgFile.startsWith('/') || imgFile.startsWith('http') ? imgFile : `/images/products/${imgFile}`;
    else {
      for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        if (fs.existsSync(path.join(ROOT, 'images', 'products', `${sku}.${ext}`))) { image = `/images/products/${sku}.${ext}`; break; }
      }
    }

    return {
      sku, name,
      cat: r.category || 'Consumables',
      type: r.type || '',
      short: r.short_description || '',
      body: r.description || '',
      specs: (r.specs || '').split('|').map(s => s.trim()).filter(Boolean),
      brand: r.brand || '',
      pack: r.pack_size || '',
      keywords: r.keywords || '',
      featured: /^(y|yes|1|true)$/i.test(r.featured || ''),
      image,
      url: `/product/${slug}.html`
    };
  }).filter(Boolean);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  for (const item of COPY) copyRecursive(path.join(ROOT, item), path.join(DIST, item));

  // catalogue data for the grid + search
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'assets', 'products.json'), JSON.stringify(
    products.map(({ sku, name, cat, type, url, image, brand, keywords, featured }) => ({ sku, name, cat, type, url, image, brand, keywords, featured }))
  ));

  // product pages
  fs.mkdirSync(path.join(DIST, 'product'), { recursive: true });
  for (const p of products) fs.writeFileSync(path.join(DIST, p.url), productPage(p, products));

  // category pages
  fs.mkdirSync(path.join(DIST, 'category'), { recursive: true });
  const cats = [...new Set(products.map(p => p.cat))].sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  const catLinks = cats.map(c => `<a href="/category/${slugify(c)}.html">${esc(c)}</a>`).join(' &middot; ');
  for (const c of cats) fs.writeFileSync(path.join(DIST, 'category', `${slugify(c)}.html`), categoryPage(c, products.filter(p => p.cat === c), catLinks));

  // any page carrying the placeholder gets the live category list
  for (const f of ['index.html', 'about.html', 'contact.html', 'products.html']) {
    const fp = path.join(DIST, f);
    if (!fs.existsSync(fp)) continue;
    const html = fs.readFileSync(fp, 'utf8');
    if (html.includes('<!--CATEGORY_LINKS-->')) fs.writeFileSync(fp, html.replace(/<!--CATEGORY_LINKS-->/g, catLinks));
  }

  // sitemap + robots
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', pri: '1.0' },
    { loc: '/products.html', pri: '0.9' },
    { loc: '/about.html', pri: '0.5' },
    { loc: '/contact.html', pri: '0.5' },
    ...cats.map(c => ({ loc: `/category/${slugify(c)}.html`, pri: '0.8' })),
    ...products.map(p => ({ loc: p.url, pri: '0.7' }))
  ];
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${SITE_URL}${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.pri}</priority></url>`).join('\n') +
    `\n</urlset>\n`);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

  console.log(`Built ${products.length} products, ${cats.length} categories -> dist/`);
  const noImg = products.filter(p => !p.image).length;
  if (noImg) console.log(`  ${noImg} product(s) have no image yet (category icon used as placeholder)`);
}

build();
