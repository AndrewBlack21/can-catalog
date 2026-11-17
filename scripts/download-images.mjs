// scripts/download-images.mjs
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE =
  'https://prnnlnahzfzoxejavsqg.supabase.co/storage/v1/object/public/product-images/';
const OUT_DIR = 'public/catalog-images';

const data = JSON.parse(await fs.readFile('public/catalog.json', 'utf8'));

for (const product of data.products) {
  for (const img of product.product_images ?? []) {
    if (!img.storage_path) continue;

    const dest = path.join(OUT_DIR, img.storage_path);
    try { await fs.access(dest); continue; } catch {} // já baixado

    const enc = img.storage_path.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(BASE + enc);
    if (!res.ok) { console.error('FALHOU', res.status, img.storage_path); continue; }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    console.log('ok', img.storage_path);
  }
}
console.log('Pronto.');