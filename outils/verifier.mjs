// Vérifie la copie : restes de Shopify, liens internes cassés, fichiers manquants.
// Usage : node verifier.mjs [dossier du site]
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..', 'docs'));

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    out.push(...(e.isDirectory() ? await walk(p) : [p]));
  }
  return out;
}

async function exists(rel) {
  const clean = decodeURIComponent(rel.split(/[?#]/)[0]);
  const candidates = clean.endsWith('/') ? [clean + 'index.html'] : [clean, clean + '.html', clean + '/index.html'];
  for (const c of candidates) {
    try {
      if ((await fs.stat(path.join(ROOT, c))).isFile()) return true;
    } catch {}
  }
  return false;
}

const files = await walk(ROOT);
const html = files.filter((f) => f.endsWith('.html'));
let size = 0;
for (const f of files) size += (await fs.stat(f)).size;
console.log(`${files.length} fichiers, ${(size / 1048576).toFixed(1)} Mo, ${html.length} pages`);

const leftovers = new Map();
const broken = new Set();
for (const f of html) {
  const text = await fs.readFile(f, 'utf8');
  for (const m of text.matchAll(/.{0,60}(myshopify\.com|cdn\.shopify\.com|shopifysvc|fonts\.googleapis|fonts\.gstatic).{0,40}/g)) {
    const key = m[0].replace(/\s+/g, ' ');
    leftovers.set(key, (leftovers.get(key) || 0) + 1);
  }
  for (const m of text.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const u = m[1].replace(/&amp;/g, '&');
    if (u.startsWith('//')) continue;
    if (!(await exists(u))) broken.add(`${path.relative(ROOT, f)} -> ${u}`);
  }
  for (const m of text.matchAll(/srcset="([^"]*)"/g)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u.startsWith('/') && !u.startsWith('//') && !(await exists(u))) broken.add(`${path.relative(ROOT, f)} -> ${u}`);
    }
  }
}
console.log('\nRestes externes :');
for (const [k, v] of leftovers) console.log(`  ${v}x ${k}`);
console.log(`\nLiens internes cassés : ${broken.size}`);
for (const b of [...broken].slice(0, 40)) console.log('  ' + b);
