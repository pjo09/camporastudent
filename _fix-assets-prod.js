// One-time fix: replace Font Awesome kit with official CDN stylesheet
// and fix logo asset paths across student dashboard files.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "frontend");
const KIT = '<script src="https://kit.fontawesome.com/a2e0e6ad65.js" crossorigin="anonymous"></script>';
const CDN = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" />';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

let changedHtml = 0;
let changedJs = 0;

for (const file of walk(root)) {
  let c = fs.readFileSync(file, "utf8");
  const orig = c;

  if (/\.html$/.test(file) && c.includes(KIT)) {
    c = c.split(KIT).join(CDN);
  }

if (/\.js$/.test(file)) {
    // Fix relative ./assets/... -> root-relative /assets/... (works for root and subdirectory pages)
    c = c.split('"./assets/logos/logo.png"').join('"/assets/logos/logo.png"');
    c = c.split("'./assets/logos/logo.png'").join("'/assets/logos/logo.png'");
    c = c.split('"./assets/images/property-placeholder.jpg"').join('"/assets/images/property-placeholder.jpg"');
    c = c.split("'./assets/images/property-placeholder.jpg'").join("'/assets/images/property-placeholder.jpg'");
  }

  if (c !== orig) {
    fs.writeFileSync(file, c);
    if (/\.html$/.test(file)) changedHtml++;
    else changedJs++;
    console.log("Updated:", file.replace(root + path.sep, ""));
  }
}

console.log(`\nDone. HTML updated: ${changedHtml}, JS updated: ${changedJs}`);
