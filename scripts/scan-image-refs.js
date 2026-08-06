const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'frontend');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/\.(html|css|js)$/i.test(entry.name)) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const re = /(src|href)=["']([^"']+)["']/g;

const hits = [];
for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = re.exec(txt))) {
    const url = m[2];

    // Interested only in local-ish asset URLs that look like our broken pattern.
    const looksLikeFrontendImages =
      /^\/frontend\/images\//i.test(url) ||
      /^frontend\/images\//i.test(url) ||
      /^\.\/frontend\/images\//i.test(url) ||
      /\/frontend\/images\//i.test(url) ||
      /^\.\/images\//i.test(url) ||
      /^\/images\//i.test(url) ||
      /^images\//i.test(url) ||
      /^\.\.\/images\//i.test(url) ||
      /^\.\.\/frontend\/images\//i.test(url) ||
      /^\.\/frontend\/images\//i.test(url) ||
      /^\.{1,2}\/frontend\/images\//i.test(url) ||
      /frontend\/images\//i.test(url);

    const looksLikeImageFile = /\.(png|jpe?g|ico|svg|webp|gif)(\?.*)?$/i.test(url);

    if (looksLikeFrontendImages && looksLikeImageFile) {
      hits.push({ file: path.relative(__dirname, file).replace(/\\/g, '/'), url });
    }
  }
}

hits.sort((a, b) => a.file.localeCompare(b.file) || a.url.localeCompare(b.url));
console.log(JSON.stringify(hits, null, 2));

