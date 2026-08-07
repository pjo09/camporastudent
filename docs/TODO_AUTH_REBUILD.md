# Campora Authentication Rebuild — Task Tracker

## Backend
- [ ] Add `purpose` field to Otp model (backward-compatible, default `register`)
- [ ] Add OTP resend cooldown (429) in `routes/otp.js`
- [ ] Pass `purpose` through OTP send/verify
- [ ] Strengthen password policy in `routes/auth.js` (min 8 + upper + lower + number + special)
- [ ] Add `POST /api/auth/admin/login` (email restriction + password auth, generic errors)
- [ ] Add `POST /api/auth/forgot-password` (generic response, no enumeration)
- [ ] Add `POST /api/auth/verify-reset-otp`
- [ ] Add `POST /api/auth/reset-password`
- [ ] Add admin login to rate limiter in `app.js`

## Frontend
- [ ] Verify session.js redirects (student/owner/admin)
- [ ] Make legacy `register.html` redirect to canonical `signup.html`
- [ ] Update any links pointing to `register.html` → `signup.html`

## Testing
- [ ] Run `node _test-auth-harden.js` and fix all failures
- [ ] Verify request/response contracts match frontend
- [ ] Final report

