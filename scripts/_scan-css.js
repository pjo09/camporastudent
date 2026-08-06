const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "frontend");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html"));

for (const f of files) {
  const html = fs.readFileSync(path.join(dir, f), "utf8");
  const links = [...html.matchAll(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi)].map((m) =>
    m[0].replace(/^\s+|\s+$/g, "")
  );
  console.log("=== " + f + " ===");
  links.forEach((l) => console.log("  " + l));
  const inline = html.match(/<style>([\s\S]*?)<\/style>/gi);
  if (inline) console.log("  [inline <style> blocks: " + inline.length + "]");
}

