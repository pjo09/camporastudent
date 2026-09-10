const puppeteer = require("puppeteer-core");
const http = require("http");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..", "frontend");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const PAGES = [
  "/pages/student/dashboard.html",
  "/pages/owner/dashboard.html"
];

const VIEWPORTS = [
  { name: "320px", width: 320, height: 640 },
  { name: "375px", width: 375, height: 812 },
  { name: "390px", width: 390, height: 844 },
  { name: "414px", width: 414, height: 896 },
  { name: "768px", width: 768, height: 1024 },
  { name: "1024px", width: 1024, height: 768 },
  { name: "1280px", width: 1280, height: 800 },
  { name: "1440px", width: 1440, height: 900 },
  { name: "1920px", width: 1920, height: 1080 }
];

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
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

async function runQA() {
  const server = await startServer();
  const port = server.address().port;

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  for (const pageUrl of PAGES) {
    console.log(`\n========================================`);
    console.log(`TESTING PAGE: ${pageUrl}`);
    console.log(`========================================`);

    const page = await browser.newPage();
    
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem("camporaUser", JSON.stringify({
        _id: "test-user-123",
        name: "Test User",
        email: "test@example.com",
        role: "student"
      }));
      localStorage.setItem("camporaToken", "mock-jwt-token");
    });

    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`http://127.0.0.1:${port}${pageUrl}`, { waitUntil: "networkidle0" });

      const overflowElements = await page.evaluate((vpWidth) => {
        const docWidth = document.documentElement.scrollWidth;
        if (docWidth <= vpWidth + 1) return [];

        const all = Array.from(document.querySelectorAll("*"));
        const overflowing = [];
        for (const el of all) {
          const rect = el.getBoundingClientRect();
          if (rect.right > vpWidth + 2 && rect.width > 0) {
            let className = "";
            if (typeof el.className === "string") className = el.className;
            overflowing.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || "",
              class: className,
              right: rect.right,
              width: rect.width
            });
          }
        }
        return overflowing.slice(0, 10);
      }, vp.width);

      if (overflowElements.length > 0) {
        console.log(`[${vp.name}] ❌ OVERFLOW FOUND! DocWidth vs Viewport (${vp.width}px):`);
        overflowElements.forEach(item => {
          console.log(`  -> <${item.tag} id="${item.id}" class="${item.class}"> right=${item.right.toFixed(1)}px width=${item.width.toFixed(1)}px`);
        });
      } else {
        console.log(`[${vp.name}] ✅ NONE`);
      }
    }
    await page.close();
  }

  await browser.close();
  server.close();
  console.log("\nQA Run Completed!");
}

runQA().catch(console.error);
