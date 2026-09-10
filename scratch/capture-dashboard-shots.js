const puppeteer = require("puppeteer-core");
const http = require("http");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..", "frontend");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\piyus\\.gemini\\antigravity\\brain\\f4d8ded0-92fa-4295-b355-6a6e0061055c";

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

async function capture() {
  const server = await startServer();
  const port = server.address().port;

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("camporaUser", JSON.stringify({
      _id: "test-user-123",
      name: "Aarav Sharma",
      email: "aarav@example.com",
      role: "student"
    }));
    localStorage.setItem("camporaToken", "mock-jwt-token");
  });

  // 1. Student Dashboard Desktop
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${port}/pages/student/dashboard.html`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "student_dashboard_1440px.png"), fullPage: false });

  // 2. Student Dashboard Mobile
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(`http://127.0.0.1:${port}/pages/student/dashboard.html`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "student_dashboard_375px.png"), fullPage: false });

  // 3. Owner Dashboard Desktop
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${port}/pages/owner/dashboard.html`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "owner_dashboard_1440px.png"), fullPage: false });

  // 4. Owner Dashboard Mobile
  await page.setViewport({ width: 375, height: 812 });
  await page.goto(`http://127.0.0.1:${port}/pages/owner/dashboard.html`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "owner_dashboard_375px.png"), fullPage: false });

  await browser.close();
  server.close();
  console.log("Screenshots captured successfully!");
}

capture().catch(console.error);
