# Logout Redirect to Landing Page

Goal: After logout, always redirect to the site root (landing page) — never login.html.

Approach: Use `window.location.origin + "/"`. In production this resolves to
https://camporastudent.vercel.app/ ; in local dev it resolves to the local root.

## Steps
- [x] 1. session.js: add `window.location.replace(window.location.origin + "/")` in logout()
- [ ] 2. login.js: remove trailing `window.location.href = "login.html"` (rely on session.js)
- [ ] 3. admin-dashboard.js: remove trailing `login.html` redirect
- [ ] 4. owner-shell.js: remove trailing `login.html` redirect
- [ ] 5. student-utils.js: remove trailing `login.html` redirect
- [ ] 6. student-dashboard.js: remove trailing `login.html` redirect
- [ ] 7. navbar.js: drop trailing `index.html` redirect (use shared logout)
- [ ] 8. script.js: drop trailing `index.html` redirect (use shared logout)
- [ ] 9. app.js (classic): redirect to site root after clearing keys
- [ ] 10. otp-auth.js: redirect to site root after clearing keys
