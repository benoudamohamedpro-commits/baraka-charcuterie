import * as cheerio from 'cheerio';
import fs from 'node:fs';
const $ = cheerio.load(fs.readFileSync(process.argv[2], 'utf8'));
const act = $('header-actions, .header-actions__action, [class*="header-actions"]').first();
console.log('--- header-actions tags:');
$('header-actions').each((i, e) => console.log($(e).toString().replace(/\s+/g,' ').slice(0, 2500)));
console.log('--- account:', $('shopify-account, [class*=account]').map((i,e)=>e.tagName+'.'+($(e).attr('class')||'')).get().slice(0,10));
console.log('--- hydration script:');
$('script').each((i, e) => { const t = $(e).html()||''; if (t.includes('section-hydration') || t.includes('chatDrawer')) console.log(t.slice(0, 1200)); });
