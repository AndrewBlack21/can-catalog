import fs from "node:fs";
import path from "node:path";

const catalogPath = path.resolve("public/catalog.json");
const imagesRoot = path.resolve("public/catalog-images");

if (!fs.existsSync(catalogPath)) {
  console.error("ERRO: public/catalog.json não encontrado.");
  process.exit(1);
}

let catalog;
try {
  catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
} catch (error) {
  console.error("ERRO: catalog.json não contém JSON válido:", error.message);
  process.exit(1);
}

if (!Array.isArray(catalog.products)) {
  console.error("ERRO: catalog.json precisa conter um array products.");
  process.exit(1);
}

const missing = [];
let checked = 0;

for (const product of catalog.products) {
  for (const media of product.product_images || []) {
    let storagePath = media.storage_path;
    if (!storagePath || typeof storagePath !== "string") continue;

    storagePath = storagePath.trim().replace(/\\\\/g, "/");

    if (/^https?:\\/\\//i.test(storagePath)) {
      try {
        const url = new URL(storagePath);
        const marker = "/storage/v1/object/public/product-images/";
        const markerIndex = url.pathname.indexOf(marker);
        if (markerIndex < 0) continue;
        storagePath = url.pathname.slice(markerIndex + marker.length);
      } catch {
        missing.push({ product: product.name, path: storagePath, reason: "URL inválida" });
        continue;
      }
    }

    storagePath = storagePath.replace(/^\\/+/, "").replace(/^product-images\\//i, "");
    const segments = storagePath.split("/").filter(Boolean);
    if (!segments.length || segments.some((part) => part === "." || part === "..")) {
      missing.push({ product: product.name, path: storagePath, reason: "caminho inválido" });
      continue;
    }

    checked += 1;
    const filePath = path.resolve(imagesRoot, ...segments);
    if (!filePath.startsWith(imagesRoot + path.sep) || !fs.existsSync(filePath)) {
      missing.push({ product: product.name, path: storagePath, reason: "arquivo não encontrado" });
    }
  }
}

console.log(`Mídias verificadas: ${checked}`);
console.log(`Mídias ausentes: ${missing.length}`);

if (missing.length) {
  for (const item of missing) {
    console.log(`- ${item.product || "Produto sem nome"} | ${item.path} | ${item.reason}`);
  }
  process.exitCode = 1;
} else {
  console.log("OK: todos os arquivos locais referenciados foram encontrados.");
}
