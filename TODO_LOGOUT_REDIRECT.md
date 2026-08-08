# TODO: Campora Logout Redirection to Landing Page

## Objective
After logout, always redirect authenticated users to the Campora landing page https://camporastudent.vercel.app/ (never login.html/index.html/dashboard). Keep session.js logout() as the single source of truth. Prevent back-button from reopening protected dashboards.

## Steps
- [x] 1. session.js: add LANDING_URL constant + redirectToLanding() helper (uses window.location.replace)
- [x] 2. admin-dashboard.js: logout handler → redirectToLanding()
- [x] 3. owner-shell.js: logout handler → redirectToLanding()
- [x] 4. student-utils.js: logout handler → redirectToLanding()
- [x] 5. student-dashboard.js: logout handler → redirectToLanding()
- [x] 6. login.js: window.logout → redirectToLanding()
- [x] 7. navbar.js: logout → redirectToLanding()
- [x] 8. app.js: bindLogout → redirectToLanding()
- [x] 9. script.js: navbar logout → redirectToLanding()
- [x] 10. otp-auth.js: logout() clears all keys + redirectToLanding()

## Verification
- [ ] Student → Dashboard → Logout → Landing page
- [ ] Owner → Dashboard → Logout → Landing page
- [ ] Admin → Dashboard → Logout → Landing page
- [ ] Token/session removed after logout
- [ ] Browser Back after logout does NOT reopen dashboard
- [ ] Login still redirects to correct role dashboard
