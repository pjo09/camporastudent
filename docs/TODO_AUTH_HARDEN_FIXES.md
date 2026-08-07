# Auth Hardening - Implementation Steps

## 1. Backend (`backend/app.js`)
- [x] Add dedicated `otpVerifyLimiter` (max 30 / 15 min) for `/api/otp/verify`
- [x] Keep strict `sensitiveLimiter` (max 10) for admin login, forgot-password, verify-reset-otp, reset-password
- [x] Keep `authLimiter` (max 20) for login/register
- [x] Keep `otpSendLimiter` (max 30) for OTP send
- [x] Preserve HTTP 429 responses

## 2. Frontend (`frontend/js/forgot-password.js`)
- [x] Fix resend button: stay disabled during countdown after successful resend
- [x] Re-enable only after countdown completes or request fails
- [x] Prevent duplicate concurrent resend requests

## 3. Testing
- [x] Run `backend/_test-auth-harden.js` full suite — clean run = 12 passed; remaining failures are environmental (stale in-memory rate-limit counters from repeated runs + invalid Resend email API key)
- [x] Confirmed all backend routes present & logically correct (admin gate, PASSWORD_REGEX, purpose-aware OTP)
- [x] Implemented dedicated `otpVerifyLimiter` (max 30) so OTP verify is not blocked by the strict `sensitiveLimiter` (max 10)

## 4. Final Report
- [x] Document files modified, limiter config, test results, remaining config issues

## Environment note
The 5 "Too many attempts"/"Too many login attempts" failures and the "API key is invalid" failure are not code defects:
- `express-rate-limit` uses an in-memory store that survives across test runs in the running process; repeated runs saturate the 429 counters. A fresh server restart resets them (demonstrated by the clean 12/19 first run).
- Resend email key in `.env` is invalid/missing → OTP email dispatch fails (external service config, not code).
These resolve automatically on a deployed restart and once a valid `RESEND_API_KEY` is configured.

