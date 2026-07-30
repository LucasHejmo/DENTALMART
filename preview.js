#!/usr/bin/env node
/* ============================================================
   DentalMart preview build
   ------------------------------------------------------------
   Runs the normal build, then flattens dist/ into preview/ as
   standalone files: CSS and JS inlined, catalogue data embedded,
   links rewritten to relative filenames. Every page opens by
   double-clicking it — no server, no internet, nothing to set up.

   Run:  node preview.js

   This is for looking at the site only. Deploy dist/, never this.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'preview');

execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });

const css = fs.readFileSync(path.join(DIST, 'assets', 'site.css'), 'utf8');
const js = fs.readFileSync(path.join(DIST, 'assets', 'site.js'), 'utf8');
const products = JSON.parse(fs.readFileSync(path.join(DIST, 'assets', 'products.json'), 'utf8'));

const flatName = url => url
  .replace(/^\//, '')
  .replace(/^product\//, 'product-')
  .replace(/^category\//, 'category-');

// product urls inside the embedded data need flattening too
const previewProducts = products.map(p => ({ ...p, url: flatName(p.url), image: p.image ? p.image.replace(/^\//, '') : '' }));

function rewrite(html) {
  return html
    .replace(/<link rel="stylesheet" href="\/assets\/site\.css">/, `<style>\n${css}\n</style>`)
    .replace(/<script src="\/assets\/site\.js" defer><\/script>/,
      `<script>window.__DM_PRODUCTS = ${JSON.stringify(previewProducts)};</script>\n<script>\n${js}\n</script>`)
    .replace(/href="\/product\/([^"]+)"/g, 'href="product-$1"')
    .replace(/href="\/category\/([^"]+)"/g, 'href="category-$1"')
    .replace(/href="\/products\.html[^"]*"/g, 'href="products.html"')
    .replace(/href="\/(index|about|contact)\.html"/g, 'href="$1.html"')
    .replace(/href="\/"/g, 'href="index.html"')
    .replace(/src="\/images\//g, 'src="images/')
    .replace(/url\('\/images\//g, "url('images/");
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let n = 0;
const walk = dir => {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) { if (f !== 'assets') walk(full); continue; }
    if (!f.endsWith('.html')) continue;
    const rel = path.relative(DIST, full).split(path.sep).join('/');
    fs.writeFileSync(path.join(OUT, flatName(rel)), rewrite(fs.readFileSync(full, 'utf8')));
    n++;
  }
};
walk(DIST);

// images referenced relatively still resolve if you copy them across
if (fs.existsSync(path.join(ROOT, 'images'))) {
  fs.cpSync(path.join(ROOT, 'images'), path.join(OUT, 'images'), { recursive: true });
}

console.log(`Preview: ${n} standalone pages -> preview/`);
