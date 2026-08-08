# Campora Auth System Regeneration — Targeted Fixes

## Steps
- [x] 1. Enforce strong password policy on backend `/register` (auth.js) — ALREADY PRESENT
- [x] 2. Accept & hash password in OTP register verify (otp.js) — ALREADY PRESENT
- [x] 3. register.html: add Password + Confirm Password fields (show/hide), remove owner-only fields, keep role cards — ALREADY PRESENT
- [x] 4. register.js: add strong password + confirm validation, show/hide toggles, send password in payload — ALREADY PRESENT
- [x] 5. login.html: add show/hide password toggle + Forgot Password link — ALREADY PRESENT
- [x] 6. login.js: wire show/hide toggle handler — ALREADY PRESENT
- [x] 7. auth.css: add `.password-field` / `.password-toggle` styles — ALREADY PRESENT
- [x] 8. Syntax-check modified backend JS files — ALL PASS
- [x] 9. Verify frontend element IDs match JS, API paths match backend — ALL MATCH
- [x] 10. Report changes + any remaining issues
