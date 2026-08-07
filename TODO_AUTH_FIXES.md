# Campora Auth Fixes - TODO

## ✅ Completed (already in good state)
- [x] Login page HTML - skeleton, password-field, auth-form-wrap, no OTP
- [x] Register page HTML - role selector, password fields, no OTP section
- [x] Register JS - direct /api/auth/register with bcrypt + auto-login, no OTP
- [x] Admin login HTML/JS - separate page, backend email gate
- [x] Forgot password - 3-step flow, OTP timers, resend
- [x] Backend auth.js - password validation, admin gate, forgot/reset endpoints
- [x] Backend otp.js - OTP-login disabled with guard
- [x] Otp model - purpose, attempts, used, lastSentAt fields
- [x] session.js - role-based redirects, logout, remember me
- [x] auth.css - all new components, dark/light, responsive 320-1920px

## 🔲 Remaining Fixes
- [ ] 1. login.js - Add skeleton-hide init + password toggle wiring
- [ ] 2. register.html - Add loading skeleton + novalidate
- [ ] 3. backend/app.js - Extend rate limiting to admin-login + forgot/reset
- [ ] 4. backend/routes/auth.js - Fix stale "use OTP login" message
- [ ] 5. Final validation - backend require check + full flow verification

