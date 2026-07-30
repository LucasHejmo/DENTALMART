# DentalMart — site + catalogue

One spreadsheet in, a full static site out. `products.csv` is the only file you edit to
manage the catalogue. Every time you push it to GitHub, Cloudflare rebuilds the site and
regenerates a real HTML page for every product.

---

## Adding products (the whole job)

1. Open `products.csv` — in Excel, Numbers, or Google Sheets.
2. Add one row per product.
3. Save as CSV, upload it to GitHub (drag and drop over the old file), commit.
4. Cloudflare rebuilds in ~30 seconds. New product pages are live.

That's it. No HTML editing, ever.

### The columns

| Column | Required | What it does |
|---|---|---|
| `sku` | yes | Your product code. Also the key for the quote list and image lookup. Don't change it after launch — it's part of nothing public-facing except the page, but changing it breaks saved quote lists. |
| `name` | yes | Product title. Becomes the page `<h1>`, the `<title>`, and the URL slug. |
| `category` | yes | One of: `Consumables`, `Instruments`, `Materials`, `Equipment`. Anything else creates a new category page automatically. |
| `short_description` | recommended | One or two sentences. Used as the meta description Google shows in results — write it for a clinic manager searching, not for a brochure. |
| `description` | optional | Longer copy for the body of the page. Blank line = new paragraph. This is where the SEO weight lives. |
| `specs` | optional | Bullet points, separated by `\|`. Example: `Box of 100\|Powder-free\|Nitrile` |
| `brand` | optional | Shown on the page and included in structured data. |
| `pack_size` | optional | e.g. `Box of 100`, `Case of 10`. |
| `image` | optional | Filename in `images/products/`. Leave blank and it auto-finds `<SKU>.jpg` / `.png` / `.webp`. |
| `featured` | optional | `yes` puts it in the "Popular products" row on the home page. |
| `keywords` | optional | Extra search terms for the on-site search box only. Not published, not a meta keywords tag. |

Commas and quotes inside a field are fine — save as a normal CSV and the parser handles them.

### Product photos

Drop them in `images/products/` named after the SKU (`DM-1001.jpg`). No CSV change needed.
Products without a photo get the category icon as a placeholder, so you can launch before
the photography is done and add images later.

---

## What gets generated

| Output | From |
|---|---|
| `/product/<slug>.html` | one page per row — unique title, meta description, canonical URL, Product + BreadcrumbList structured data, related items |
| `/category/<slug>.html` | one page per category, listing everything in it |
| `/assets/products.json` | powers the catalogue grid, search, and filters |
| `/sitemap.xml` | every page, regenerated each build — submit once in Google Search Console |
| `/robots.txt` | points crawlers at the sitemap |

Source files you edit by hand: `index.html`, `about.html`, `contact.html`, `products.html`,
`assets/site.css`, `assets/site.js`. Everything in `dist/` is generated — never edit it.

---

## Deploying (GitHub → Cloudflare Pages)

1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Build settings:
   - Framework preset: **None**
   - Build command: `node build.js`
   - Build output directory: `dist`
4. Environment variables → add `SITE_URL` = `https://dentalmart.ca` (your real domain, no
   trailing slash). This is what canonical URLs and the sitemap are built from — get it wrong
   and Google indexes the wrong hostname.
5. Custom domains → add `dentalmart.ca` and `www.dentalmart.ca`, redirect www to the root.

After that, every `git push` (or CSV upload through the GitHub web UI) redeploys automatically.

### Forms

Get a free access key from [web3forms.com](https://web3forms.com), then paste it into
`assets/site.js`, line 10:

```js
const WEB3FORMS_ACCESS_KEY = "your-key-here";
```

It's a public key — it's meant to sit in client-side code. It covers both the quote-list
submission and the contact form.

---

## Previewing without a server

`node preview.js` writes a `preview/` folder of standalone pages you can open by
double-clicking — CSS, JS, and data inlined, links flattened. Preview those; deploy
`dist/`. Never commit `dist/` or `preview/` (both are in .gitignore).

## Working locally (optional)

```bash
node build.js                       # generate dist/
cd dist && python3 -m http.server 8080   # open http://localhost:8080
```

Node 18+ is all you need. No dependencies, no install step.

---

## After the first deploy — SEO checklist

- [ ] Google Search Console: add the property, submit `https://dentalmart.ca/sitemap.xml`
- [ ] Bing Webmaster Tools: same (imports from Search Console in one click)
- [ ] Google Business Profile for the Mississauga location
- [ ] Rewrite the auto-generated `short_description` and `description` for your top ~20
      sellers — unique copy is what actually ranks; identical boilerplate across 200 pages
      is the fastest way to get them treated as thin content
- [ ] Real photos on those same top sellers
