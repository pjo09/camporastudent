=========================================
CAMPORA BROWSER CORS ROOT CAUSE REPORT
=========================================

Browser Origin:
https://camporastudent.vercel.app

Backend:
https://camporastudent.onrender.com

Actual Browser Preflight:
PASS

Exact Browser Request Headers:
Host: camporastudent.onrender.com
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36
Accept: application/json, text/plain, */*
Origin: https://camporastudent.vercel.app
Access-Control-Request-Method: GET
Access-Control-Request-Headers: authorization,content-type

Exact Browser Response Headers:
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://camporastudent.vercel.app
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Accept, Origin, X-Requested-With
Cross-Origin-Opener-Policy: same-origin-allow-popups
Server: cloudflare

OPTIONS Status:
204 No Content

Access-Control-Allow-Origin:
https://camporastudent.vercel.app

Access-Control-Allow-Headers:
Content-Type, Authorization, Accept, Origin, X-Requested-With

Access-Control-Allow-Methods:
GET, POST, PUT, PATCH, DELETE, OPTIONS

Redirect:
NO (0 Redirects)

Render Deployment:
Commit 41617be on origin/main

Vercel Deployment:
https://camporastudent.vercel.app (Syncing main)

Frontend Cache/Service Worker:
NO Service Worker active; cold-start 2s retry logic added to script.js apiGet and apiPost

Supabase:
NOT RELATED (DATABASE_PROVIDER=supabase remains 100% intact, 0 MongoDB fallback)

ROOT CAUSE:
1. Primary Root Cause: Render free tier instance hibernation (cold-start). When the backend is idle for >15 minutes, Render's platform proxy returns HTTP 503 hibernate-wake-error without Access-Control-Allow-Origin headers. The browser receives 503 without CORS headers and reports "No 'Access-Control-Allow-Origin' header is present".
2. Secondary Root Cause: Express rate limiters in backend/app.js did not skip OPTIONS requests, causing preflight to receive HTTP 429 HTML responses from rate limiters/Cloudflare without CORS headers.

FIX:
1. Updated backend/app.js: Placed app.use(cors(corsOptions)) at top of Express stack and added skip: (req) => req.method === "OPTIONS" || ... to all rate limiters.
2. Updated frontend/js/script.js: Added automatic 2.5s retry in apiGet and apiPost when catching cold-start 502/503 responses, ensuring seamless rendering when Render completes container warmup.

LIVE VERIFICATION:
PASS

Properties:
PASS (HTTP 200 OK)

Search:
PASS (HTTP 200 OK)

Statistics:
PASS (HTTP 200 OK)

Google Auth:
PASS (HTTP 401 Unauthorized validation / COOP: same-origin-allow-popups)

Production Data Modified:
0
