# Logout Redirect to Landing Page

Goal: After logout, always redirect to the site root (landing page) — never login.html.

Approach: Use `window.location.origin + "/"`. In production this resolves to
https://camporastudent.vercel.app/ ; in local dev it resolves to the local root.

## Steps
- [x] 1. session.js: add `window.location.replace(window.location.origin + "/")` in logout()
- [x] 2. login.js: remove trailing `window.location.href = "login.html"` (rely on session.js)
- [x] 3. admin-dashboard.js: remove trailing `login.html` redirect
- [x] 4. owner-shell.js: remove trailing `login.html` redirect
- [x] 5. student-utils.js: remove trailing `login.html` redirect
- [x] 6. student-dashboard.js: remove trailing `login.html` redirect
- [x] 7. navbar.js: drop trailing `index.html` redirect (use shared logout)
- [x] 8. script.js: drop trailing `index.html` redirect (use shared logout)
- [x] 9. app.js (classic): redirect to site root after clearing keys
- [x] 10. otp-auth.js: redirect to site root after clearing keys
- [x] 11. Root frontend/*.html & pages/student/*.html: `dropdownLogout` fallback href → landing URL
