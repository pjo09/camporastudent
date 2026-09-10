const puppeteer = require("puppeteer-core");
const http = require("http");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..", "frontend");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const VIEWPORTS = [
  { name: "320px", width: 320, height: 640 },
  { name: "375px", width: 375, height: 812 },
  { name: "390px", width: 390, height: 844 },
  { name: "768px", width: 768, height: 1024 },
  { name: "1440px", width: 1440, height: 900 },
];

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      const filePath = path.join(ROOT, urlPath);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function testAllViewports() {
  const server = await startServer();
  const port = server.address().port;
  console.log(`Server listening on port ${port}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const outDir = path.join(__dirname, "screenshots");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });

      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const url = req.url();
        if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) req.continue();
        else req.abort();
      });

      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 30000 });
      await page.evaluate(() => {
        const intro = document.getElementById("introScreen");
        if (intro) intro.style.display = "none";
        document.body.classList.add("intro-done");
      });
      await new Promise((r) => setTimeout(r, 600));

      const screenshotPath = path.join(outDir, `mobile_${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });

      const metrics = await page.evaluate((vw) => {
        const doc = {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
        const searchPill = document.querySelector(".hero-search-pill");
        const queryInput = document.querySelector(".hero-query-input");
        const searchBtn = document.querySelector(".hero-search-btn");
        const trustBadges = Array.from(document.querySelectorAll(".trust-badge-pill"));
        const searchRect = searchPill ? searchPill.getBoundingClientRect() : null;
        const btnRect = searchBtn ? searchBtn.getBoundingClientRect() : null;

        return {
          viewportWidth: vw,
          hasHScroll: doc.hasHScroll,
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          searchWidth: searchRect ? Math.round(searchRect.width) : 0,
          searchFits: searchRect ? searchRect.right <= vw + 1 : false,
          btnWidth: btnRect ? Math.round(btnRect.width) : 0,
          btnFullWidth: btnRect ? btnRect.width >= (vw - 64) : false,
          trustBadgesCount: trustBadges.length,
          trustBadgesVisible: trustBadges.filter(b => b.getBoundingClientRect().height > 0).length,
        };
      }, vp.width);

      console.log(`\n=== Viewport: ${vp.name} ===`);
      console.log(`  Horizontal Scroll: ${metrics.hasHScroll ? "YES (" + metrics.scrollWidth + "px)" : "NONE (Pass)"}`);
      console.log(`  Search Card Fits: ${metrics.searchFits} (Width: ${metrics.searchWidth}px)`);
      console.log(`  Search Button Width: ${metrics.btnWidth}px`);
      console.log(`  Trust Badges Visible: ${metrics.trustBadgesVisible} / ${metrics.trustBadgesCount}`);
      console.log(`  Screenshot Saved: ${screenshotPath}`);

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

testAllViewports().catch((e) => {
  console.error("Viewport QA Error:", e);
  process.exit(1);
});
