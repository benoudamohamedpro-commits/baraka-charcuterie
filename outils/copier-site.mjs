// Copie statique de la boutique Shopify (vitrine) vers le dossier docs/ (GitHub Pages).
// Usage : node copier-site.mjs [dossier de sortie]
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const HOST = 'cd70bx-gg.myshopify.com';
const SRC = `https://${HOST}`;
const SITE = 'https://baraka-charcuterie.be';
const WHATSAPP = '32495315500';
const OUT = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..', 'docs'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const START_PAGES = ['/', '/collections/all', '/pages/contact', '/pages/notre-histoire'];
const PAGE_RE = /^\/(?:(?:products|collections|pages|policies)\/[\w.-]+|collections)?$/;

// Adresses de fichiers (images, CSS, JS, polices) à recopier en local
const ASSET_RE = new RegExp(
  [
    String.raw`(?:https?:)?\/\/${HOST.replace(/\./g, '\\.')}\/cdn\/(?:shop|fonts)\/[^\s"'()<>\\]+`,
    String.raw`(?:https?:)?\/\/cdn\.shopify\.com\/s\/files\/[^\s"'()<>\\]+`,
    String.raw`https:\/\/cdn\.shopify\.com\/storefront\/standard-events\.js`,
    String.raw`https:\/\/fonts\.googleapis\.com\/css2\?[^\s"'<>\\]+`,
    String.raw`https:\/\/fonts\.gstatic\.com\/[^\s"'()<>\\]+`,
    String.raw`(?<=["'(\s,])\/cdn\/(?:shop|fonts)\/[^\s"'()<>\\]+`,
  ].join('|'),
  'g'
);

const assets = new Map(); // url absolue -> chemin local (/cdn/...)
const pending = [];
const failed = [];

function decode(u) {
  return u.replace(/&amp;/g, '&');
}

function toAbsolute(raw, base = SRC) {
  const u = decode(raw);
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/')) return SRC + u;
  return new URL(u, base).href;
}

function localPathFor(abs) {
  const url = new URL(abs);
  if (url.hostname === 'fonts.googleapis.com') {
    return '/cdn/gfonts/' + createHash('md5').update(abs).digest('hex').slice(0, 10) + '.css';
  }
  if (url.hostname === 'fonts.gstatic.com') {
    return '/cdn/gfonts/' + createHash('md5').update(abs).digest('hex').slice(0, 10) + path.posix.extname(url.pathname);
  }
  let p = url.pathname;
  if (url.hostname === 'cdn.shopify.com' && p.startsWith('/s/files/')) {
    p = '/cdn/shop/' + p.split('/').slice(7).join('/');
  } else if (url.hostname === 'cdn.shopify.com') {
    p = '/cdn/shopify' + p;
  }
  // Variantes d'image (width, height, crop...) : on les garde dans le nom du fichier
  const params = [...url.searchParams].filter(([k]) => k !== 'v');
  if (params.length) {
    const suffix = params.map(([k, v]) => `${k}-${v}`.replace(/[^\w.-]/g, '_')).join('_');
    const ext = path.posix.extname(p);
    p = p.slice(0, p.length - ext.length) + '__' + suffix + ext;
  }
  return p;
}

function register(raw, base) {
  let abs;
  try {
    abs = toAbsolute(raw, base);
  } catch {
    return raw;
  }
  if (!assets.has(abs)) {
    assets.set(abs, localPathFor(abs));
    pending.push(abs);
  }
  return assets.get(abs);
}

function rewriteAssets(text, base) {
  return text.replace(ASSET_RE, (m) => register(m, base));
}

// Adresses écrites en JSON (données structurées) : https:\/\/boutique\/...
const ESCAPED_RE = new RegExp(String.raw`https:\\\/\\\/${HOST.replace(/\./g, '\\.')}((?:\\\/[^"\s\\]*)*)`, 'g');

function rewriteEscaped(text) {
  return text.replace(ESCAPED_RE, (_, rest) => {
    const p = rest.replace(/\\\//g, '/');
    const target = p.startsWith('/cdn/') ? SITE + register(SRC + p) : SITE + p;
    return target.replace(/\//g, '\\/');
  });
}

function finishPage(html, base) {
  html = rewriteAssets(html, base);
  html = rewriteEscaped(html);
  return html.replaceAll(SRC, SITE).replaceAll(`//${HOST}`, '//baraka-charcuterie.be');
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'fr-BE,fr;q=0.9' } });
  return res;
}

async function writeFile(rel, data) {
  const file = path.join(OUT, decodeURIComponent(rel));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

// --- Nettoyage d'une page : on retire ce qui ne marche qu'avec Shopify ---

const SCRIPT_SRC_BLOCK = /trekkie|\/cdn\/s\/|\/cdn\/wpm\/|shopifycloud|checkouts\/internal|standard-actions|shop-js|web-components\/account|page-view-event/;
const SCRIPT_TEXT_BLOCK = [
  'shopify.content_for_header',
  '"accessToken"',
  'Shopify).modules',
  'SignInWithShop',
  'featureAssets',
  'var __st=',
  'PaypalV4',
  "const t='contact',e='account'",
  'var userAgent = navigator.userAgent',
  'webmcp_adapter',
  'Shopify.PaymentButton',
  'portableWalletsHideBuyerConsent',
  'shopify-buyer-consent',
  '__TREKKIE_SHIM_QUEUE',
  'wpmLoader',
  'ShopifyAnalytics',
  'customDocumentWrite',
  '"customer":null',
  'shopify-chat',
  "from '@theme/section-hydration'",
  'Function.prototype.bind.bind(Function.prototype.call)',
  'var o=[];function n(){o.push(Array.prototype.slice.apply(arguments))',
];

const CONTACT_SCRIPT = `
<script>
  // Formulaire de contact : le site est statique, le message part sur WhatsApp.
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || form.id !== 'contact_form') return;
    event.preventDefault();
    var get = function (name) {
      var field = form.elements['contact[' + name + ']'];
      return field ? field.value.trim() : '';
    };
    var lines = [
      'Bonjour, je vous contacte depuis le site Baraka.',
      'Prénom : ' + get('first_name'),
      'Nom : ' + get('last_name'),
      'Téléphone : ' + get('phone'),
      'Email : ' + get('email'),
    ];
    if (get('body')) lines.push('Message : ' + get('body'));
    window.open('https://wa.me/${WHATSAPP}?text=' + encodeURIComponent(lines.join('\\n')), '_blank', 'noopener');
  });
</script>`;

// Nom de la boutique Shopify (« La boucherie ») remplacé par « Baraka » dans les titres et métadonnées.
// Le texte de la politique de confidentialité n'est pas modifié.
function renameShop(text) {
  return text.replace(/\|\s*Baraka\s*–\s*La boucherie/g, '| Baraka').replace(/La boucherie ?/g, 'Baraka');
}

function cleanPage(html) {
  const $ = cheerio.load(html);

  $('title').each((_, el) => void $(el).text(renameShop($(el).text())));
  $('meta[content*="La boucherie"]').each((_, el) => void $(el).attr('content', renameShop($(el).attr('content'))));
  $('script[type="application/ld+json"]').each((_, el) => void $(el).text(renameShop($(el).text())));
  $('.visually-hidden').filter((_, el) => $(el).text().trim() === 'La boucherie').text('Baraka');

  $('script').each((_, el) => {
    const src = $(el).attr('src') || '';
    const text = $(el).html() || '';
    const type = $(el).attr('type') || '';
    if (src && SCRIPT_SRC_BLOCK.test(src)) return void $(el).remove();
    if (type === 'speculationrules') return void $(el).remove();
    if (!src && SCRIPT_TEXT_BLOCK.some((s) => text.includes(s))) return void $(el).remove();
    if (!src && /^\s*var Shopify = Shopify \|\| \{\};/.test(text)) return void $(el).remove();
  });

  $('link').each((_, el) => {
    const rel = ($(el).attr('rel') || '').toLowerCase();
    const href = $(el).attr('href') || '';
    if (/prefetch|preconnect|dns-prefetch/.test(rel) && !href.includes(`/cdn/shop/t/`)) return void $(el).remove();
    if (rel === 'ucp' || rel === 'buy' || /oembed|atom/.test($(el).attr('type') || '')) return void $(el).remove();
  });
  $('meta[name^="shopify-"], meta[name="request-id"]').remove();
  $('meta[id^="shopify-"]').remove();

  // En-tête : compte client, panier et recherche n'existent pas sur un site statique
  $('header-actions .account-button, header-actions a[href="/cart"]').remove();
  $('header [aria-label="Rechercher"]').each((_, el) => {
    const wrapper = $(el).closest('search-button, .search-action, [class*="search-action"]');
    (wrapper.length ? wrapper : $(el)).remove();
  });
  $('shopify-chat, shopify-store, shopify-account, #chat-drawer').remove();

  // Pied de page : liens « Mon compte » et « Rechercher », newsletter (pas de serveur pour l'enregistrer)
  $('footer a[href="/account"], footer a[href="/search"]').closest('li').remove();
  $('.nbr-footer__newsletter').remove();

  // Formulaire de contact : envoi par WhatsApp
  if ($('#contact_form').length) {
    $('#contact_form').attr('action', '#').attr('method', 'get');
    $('#contact_form input[name="form_type"], #contact_form input[name="utf8"]').remove();
    $('body').append(CONTACT_SCRIPT);
  }

  return $.html();
}

function pageFile(p) {
  return p === '/' ? 'index.html' : p.slice(1) + '.html';
}

async function copyPages() {
  const seen = new Set();
  const queue = [...START_PAGES];
  const pages = [];
  while (queue.length) {
    const p = queue.shift();
    if (seen.has(p)) continue;
    seen.add(p);
    const res = await get(SRC + p);
    if (!res.ok) {
      failed.push(`${res.status} ${p}`);
      continue;
    }
    let html = await res.text();
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = ($(el).attr('href') || '').replace(SRC, '').split(/[?#]/)[0];
      if (PAGE_RE.test(href) && !seen.has(href)) queue.push(href);
    });
    html = finishPage(cleanPage(html), SRC + p);
    await writeFile(pageFile(p), html);
    pages.push(p);
    console.log('page', p);
  }
  // Une page qui a aussi un sous-dossier (ex. /collections) doit exister en index.html
  for (const p of pages) {
    if (p !== '/' && pages.some((o) => o.startsWith(p + '/'))) {
      await fs.copyFile(path.join(OUT, pageFile(p)), path.join(OUT, p.slice(1), 'index.html'));
    }
  }
  return pages;
}

async function copy404() {
  const res = await get(SRC + '/page-qui-n-existe-pas');
  await writeFile('404.html', finishPage(cleanPage(await res.text()), SRC));
}

async function copyAssets() {
  while (pending.length) {
    const batch = pending.splice(0, 8);
    await Promise.all(
      batch.map(async (abs) => {
        const local = assets.get(abs);
        const res = await get(abs);
        if (!res.ok) {
          failed.push(`${res.status} ${abs}`);
          return;
        }
        const type = res.headers.get('content-type') || '';
        if (/css|javascript/.test(type) || /\.(css|js)$/.test(local)) {
          let text = rewriteAssets(await res.text(), abs);
          if (local.endsWith('.css')) {
            // Images appelées en relatif dans le CSS (ex. url(logo.webp))
            text = text.replace(/url\((['"]?)(?!data:|https?:|\/|#)([^'")]+)\1\)/g, (_, q, rel) => `url(${q}${register(rel, abs)}${q})`);
          }
          await writeFile(local, text);
        } else {
          await writeFile(local, Buffer.from(await res.arrayBuffer()));
        }
      })
    );
  }
}

async function writeExtras(pages) {
  const urls = pages
    .filter((p) => !p.startsWith('/policies/'))
    .map((p) => `  <url><loc>${SITE}${p === '/' ? '/' : p}</loc></url>`)
    .join('\n');
  await writeFile(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
  await writeFile('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  await writeFile('CNAME', 'baraka-charcuterie.be\n');
  await writeFile('.nojekyll', '');
}

await fs.rm(OUT, { recursive: true, force: true });
const pages = await copyPages();
await copy404();
await copyAssets();
await writeExtras(pages);
console.log(`\n${pages.length} pages, ${assets.size} fichiers.`);
if (failed.length) console.log('Échecs :\n' + failed.join('\n'));
