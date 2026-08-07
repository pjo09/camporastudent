# CAMPORA AUTH SYSTEM — HARDENING & VERIFICATION

## Objective
Harden and verify the existing Campora authentication system without rebuilding the UI.

## Steps

### Backend
- [ ] 1. Add `attempts` + resend-cooldown fields to `Otp` model (backend/models/Otp.js)
- [ ] 2. Add OTP max-attempts enforcement + resend cooldown in `backend/routes/otp.js`
- [ ] 3. Add `POST /api/auth/verify-reset-otp` endpoint in `backend/routes/auth.js`
- [ ] 4. Add max-attempts + resend cooldown to forgot/reset flow in `backend/routes/auth.js`
- [ ] 5. Add rate limiting for admin-login, forgot-password, reset-password, verify-reset-otp in `backend/app.js`

### Frontend
- [ ] 6. Fix `frontend/js/forgot-password.js` step 2 to actually verify the OTP via the API before advancing

### Testing
- [ ] 7. Boot backend and verify clean startup
- [ ] 8. E2E API tests:
  - Student registration (OTP → verify → auto-login)
  - Owner registration (PENDING status, no token)
  - Password login (student + owner)
  - Admin login (allowed email + denied email)
  - Forgot password → verify OTP → reset → login with new password
  - Invalid/expired OTP, max attempts, resend cooldown
  - Duplicate email
  - JWT validation (GET /api/auth/me) + role-based redirects
- [ ] 9. Verify frontend/backend request-response contracts match
- [ ] 10. Fix any bugs discovered
- [ ] 11. Produce final implementation + testing report

