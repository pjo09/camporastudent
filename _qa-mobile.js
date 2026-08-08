// CAMPORA MOBILE QA — headless render test
// Uses puppeteer-core + system Chrome to verify mobile layout at 5 viewports.
const puppeteer = require("puppeteer-core");
const http = require("http");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "frontend");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const VIEWPORTS = [
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "768x1024", width: 768, height: 1024 },
];

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
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

// Returns a list of significant overlapping elements.
// Skips fixed/absolute decorative elements (header, glows, ring, phone notch,
// waitlist glow) and only flags real content overlaps between elements that
// share a common created parent (i.e. siblings / nested siblings), which is
// where genuine mobile layout collisions occur.
function getOverlappingElements() {
  const results = [];
const skip = (el) => {
    const cls = (typeof el.className === "string" ? el.className : "").toLowerCase();
    if (cls.includes("glow") || cls.includes("ring") || cls.includes("notch") ||
        cls.includes("bg-orb") || cls.includes("bg-blur") || cls.includes("blur-") ||
        cls.includes("particle") || cls.includes("intro") || cls.includes("cursor") ||
        cls.includes("scroll-indicator") ||
        cls === "container" || cls.includes("hero-wrapper")) return true;
    const pos = getComputedStyle(el).position;
    if (pos === "fixed") return true;
    return false;
  };
  const all = Array.from(document.querySelectorAll("body section, body main, body .hero-wrapper, body .hero-left, body .hero-right, body .hero-search, body .hero-trustpoints, body .hero-stats, body .step-card, body .why-card, body .property-card, body .testimonial-card, body .stat-card, body .contact-form, body .footer, body .waitlist-box, body .cta-box, body .showcase, body .featured, body .how-it-works, body .why-campora, body .statistics, body .faq, body .container"));
  const visible = all.filter((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0" && !skip(el);
  });
  // Only compare elements that are not ancestor/descendant of each other.
  const label = (el) => (typeof el.className === "string" && el.className.trim() ? String(el.className).split(" ").slice(0, 3).join(".") : el.tagName.toLowerCase());
  for (let i = 0; i < visible.length; i++) {
    const ra = visible[i].getBoundingClientRect();
    for (let j = i + 1; j < visible.length; j++) {
      const rb = visible[j].getBoundingClientRect();
      if (visible[i].contains(visible[j]) || visible[j].contains(visible[i])) continue;
      const ovW = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const ovH = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ovW > 4 && ovH > 4) {
        const area = ovW * ovH;
        const minArea = Math.min(ra.width * ra.height, rb.width * rb.height);
        if (minArea > 0 && area / minArea > 0.25) {
          results.push(`${label(visible[i])} <-> ${label(visible[j])} (${Math.round((area / minArea) * 100)}%)`);
        }
      }
    }
  }
  return results.slice(0, 25);
}

async function run() {
  const server = await startServer();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--ignore-certificate-errors"],
  });

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });

// Block external resources (fonts/CDN) but allow localhost, to avoid network flakiness.
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

      const width = vp.width;
      const metrics = await page.evaluate((vw) => {
        const doc = {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
        const style = (el) => (el ? getComputedStyle(el) : null);
        const navLinks = document.querySelector(".nav-links");
        const navActions = document.querySelector(".nav-actions");
        const menuToggle = document.querySelector(".menu-toggle");
        const logo = document.querySelector(".logo");
        const header = document.querySelector(".header");
        const search = document.querySelector(".hero-search");
        const heroTitle = document.querySelector(".hero-title");
        const heroDesc = document.querySelector(".hero-description");
        const logoRect = logo ? logo.getBoundingClientRect() : null;
        const headerRect = header ? header.getBoundingClientRect() : null;
        const searchRect = search ? search.getBoundingClientRect() : null;
        return {
          doc,
          navLinksVisible: navLinks ? style(navLinks).display !== "none" : "n/a",
          navActionsVisible: navActions ? style(navActions).display !== "none" : "n/a",
          menuToggleDisplay: menuToggle ? style(menuToggle).display : "n/a",
          logoInsideHeader: logoRect && headerRect ? logoRect.left >= headerRect.left - 1 && logoRect.right <= headerRect.right + 1 : "n/a",
          searchWithinViewport: searchRect ? searchRect.left >= -1 && searchRect.right <= vw + 1 : "n/a",
          searchWidth: searchRect ? Math.round(searchRect.width) : "n/a",
          heroTitleHeight: heroTitle ? Math.round(heroTitle.getBoundingClientRect().height) : "n/a",
          heroDescHeight: heroDesc ? Math.round(heroDesc.getBoundingClientRect().height) : "n/a",
        };
      }, width);

      const hamburger = await page.evaluate(async () => {
        const toggle = document.querySelector(".menu-toggle");
        const menu = document.querySelector(".mobile-menu");
        if (!toggle || !menu) return { error: "missing elements" };
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const beforeDisplay = getComputedStyle(menu).display;
        const beforeVisible = menu.getBoundingClientRect();
toggle.click();
        await sleep(900); // generous wait for transition
        const afterOpenDisplay = getComputedStyle(menu).display;
        const afterOpenVisible = menu.getBoundingClientRect();
        const openTop = afterOpenVisible.top;
        const openInViewport = afterOpenVisible.top >= -2 && afterOpenVisible.top < 200;
        const visibleWhenClosed = beforeVisible.top < -200;
        const openTransform = getComputedStyle(menu).transform;
        toggle.click();
        await sleep(900);
        const afterCloseVisible = menu.getBoundingClientRect();
        const closedOffscreen = afterCloseVisible.top < -200;
        return {
          beforeDisplay, afterOpenDisplay,
          opensInViewport: openInViewport,
          closesOffscreen: closedOffscreen,
          hiddenWhenClosed: visibleWhenClosed,
openTop: Math.round(openTop),
          openHeight: Math.round(afterOpenVisible.height),
          openTransform,
        };
      });

      const overlaps = await page.evaluate(getOverlappingElements);

      console.log(`\n===== ${vp.name} =====`);
      console.log("Horizontal scroll:", metrics.doc.hasHScroll ? `YES (${metrics.doc.scrollWidth}px)` : "none");
      console.log("nav-links visible:", metrics.navLinksVisible, "| nav-actions visible:", metrics.navActionsVisible);
      console.log("menu-toggle display:", metrics.menuToggleDisplay);
      console.log("Logo inside header:", metrics.logoInsideHeader);
      console.log("Search within viewport:", metrics.searchWithinViewport, "(width", metrics.searchWidth + ")");
      console.log("Hero title height:", metrics.heroTitleHeight, "| description height:", metrics.heroDescHeight);
      console.log("Hamburger:", JSON.stringify(hamburger));
      console.log("Overlaps:", overlaps.length === 0 ? "NONE" : overlaps.join("\n           "));

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((e) => {
  console.error("QA ERROR:", e);
  process.exit(1);
});
