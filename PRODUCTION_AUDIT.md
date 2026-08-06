# CAMPORA PRODUCTION READINESS AUDIT

**Scope:** Full backend + frontend integration audit — 7 phases
**Date:** Production audit (updated after code-level verification)
**Mode:** Read-only investigation + verified source inspection

---

## ✅ CONFIRMED WORKING (post-DNS-fix baseline)

| Area | Status | Evidence |
|---|---|---|
| Express server starts | ✅ | `CAMPORA BACKEND RUNNING` |
| MongoDB Atlas connected | ✅ | `✅ MongoDB Atlas Connected Successfully` |
| DNS bootstrap | ✅ | `DNS Bootstrap: using ["8.8.8.8","1.1.1.1"]` |
| `/api/health` | ✅ | HTTP 200 |
| All routes load | ✅ | All `✅ ... Route Loaded` |
| MongoDB failure does not kill process | ✅ | `process.exit(1)` removed from `config/db.js` |
| Express 5 sanitizer works | ✅ | Custom `mongoSanitizeExpress5.js` replaces broken `express-mongo-sanitize` |

---

# ✅ VERIFIED FIXED (source-confirmed)

## C2. Public read endpoints were unauthenticated → **RESOLVED**

| Route | Previous exposure | Current state (verified) |
|---|---|---|
| `GET /api/bookings` | All bookings + user PII | ✅ `auth` middleware + role-scoped filtering (student sees own, owner sees own-property, admin sees all) |
| `GET /api/bookings/check` | Booking existence oracle | ✅ `auth` required; uses `req.user.id` from JWT |
| `PUT /api/bookings/:id` | Anyone could mutate any booking | ✅ `auth` + ownership check (`isAdmin`/`isOwner`/`isStudent`); payment fields admin-only |
| `GET /api/contact` | All contact-form messages | ✅ `auth` + `role === "admin"` guard |
| `DELETE /api/contact/:id` | Anyone could delete messages | ✅ `auth` + `role === "admin"` guard |
| `DELETE /api/upload/:publicId` | Anyone could delete Cloudinary images | ✅ `auth` + `role === "admin"` guard |
| `POST /api/upload` | Anyone could upload to Cloudinary bucket | ✅ `auth` middleware required |

## C3. Booking payment bypass → **RESOLVED**

- ✅ `PUT /api/bookings/:id` builds updates from a **per-role whitelist**.
- ✅ Students/owners can **never** set `paymentStatus` / `paymentId` / `paymentDate` / `paymentMethod` — those fields are restricted to **admin-only**.
- ✅ Payment transitions happen server-side (Razorpay `/payment/verify` + admin routes).

## H1. Client-supplied userId/userEmail impersonation → **RESOLVED**

- ✅ `POST /api/bookings` uses `auth`; student is loaded from `req.user.id` via `User.findById`.
- ✅ `userName` / `userEmail` are derived server-side; `req.body.userId` etc. are ignored.

## H4. Cloudinary upload/delete ownership → **RESOLVED**

- ✅ `POST /api/upload` requires `auth`.
- ✅ `DELETE /api/upload/:publicId` requires `auth` + `admin` role.
- (Remaining enhancement, low priority: per-owner `public_id` registry binding.)

## H6. Razorpay amount client-supplied → **RESOLVED**

- ✅ `POST /api/payment/create-order` ignores client `amount` entirely.
- ✅ Amount is computed **server-side** from `booking.price` + `property.deposit` + `1000` booking fee.
- ✅ `POST /api/payment/verify` checks ownership + HMAC signature before marking paid.

## H2. Public properties returned all statuses → **RESOLVED**

- ✅ `GET /api/properties` filters `{ status: "approved", published: true, available: true, blacklisted: { $ne: true } }`.
- ✅ `GET /api/properties/search` applies the same approved/published filter.
- ✅ `GET /api/properties/:id` enforces approved/published/available for non-owners.

## M5. Property PUT self-escalation → **RESOLVED**

- ✅ `PUT /api/properties/:id` uses `PROPERTY_UPDATABLE_FIELDS` whitelist.
- ✅ `status` / `featured` / `verified` / `owner` can **never** be set by the client (owner-route only).

## M1. Frontend hardcoded API base → **RESOLVED (centralized)**

- ✅ `frontend/js/config.js` exports `API` / `API_BASE`; all active pages import from it.
- ✅ Hardcoded `http://localhost:5000/api` now appears only in `config.js` (the single dev source) + a comment in `image-utils.js`.
- ✅ Token keys centralized to `camporaToken` / `camporaUser` in `session.js`; `login.js`, `otp-auth.js`, all dashboards use the shared module.
- ✅ Broken legacy files (`frontend/js/bookings.js`, `frontend/js/dashboard.js`) that used the old `camporauser` key + raw `localStorage` were **unreferenced** and have been **removed** (archived in `frontend/js/legacy/`).

---

# 🟠 REMAINING ISSUES (not yet production-critical blockers, but should be addressed)

## R1. `GET /api/dashboard` (admin) `success(res, {...})` without `return`
`routes/admin.js` — harmless (last statement in try), but should be `return success(...)` for consistency. Style/perf only.

## R2. Mass-notification endpoints unbounded
`routes/admin.js` `POST /notifications/students|owners|all` loads all users into memory and `insertMany`s a huge array. No title/message length validation, no rate cap. Should validate + stream/`{ordered:false}` insertMany.

## R3. `GET /api/upload` / `DELETE /:publicId` return raw `err.message`
Info-leak risk. Return generic messages; log details server-side.

## R4. Reviews route missing ObjectId validation
`routes/reviews.js` `GET /:propertyId` and `POST /` don't validate ObjectId → CastError → 500 instead of 400. Add `mongoose.Types.ObjectId.isValid()` guard.

## R5. Schema hardening (M6)
- `Booking.price` no `min: 0`; `specialRequest` no max.
- `Contact` fields all optional in schema (route checks presence).
- `Review` missing compound unique index `{ property, user }` → duplicate reviews possible.
- `City` no `{state, name}` index; `College` no `{city}`/`{state}` index.

## R6. OTP email-bombing rate cap
`POST /api/otp/send` has no per-email/per-IP limiter beyond the global 100/15min. Add a stricter limiter keyed by email+IP; cap `/verify` attempts.

## R7. Global rate limit may be too low
`100 req / 15 min` global bucket counts public property reads. Consider per-route limits (auth stricter, public reads looser) and skip for `/api/health`.

## R8. Performance: full-collection loads
- `GET /api/admin/properties/occupancy`, `GET /api/admin/reports/occupancy` load all properties then reduce in JS → use `aggregate`.
- `GET /api/properties` and `GET /api/bookings` have no pagination on the public/booking GET (admin GETs do paginate).

## R9. `express-session`, `passport`, `passport-google-oauth20`, `express-validator`, `axios`, `nodemailer` in `package.json` appear unused
Dead dependencies → remove if confirmed (Google auth is handled by `google-auth-library`).

## R10. Minor
- `GET /api/upload` `DELETE /:publicId` and `POST /` catch-all `err.message` (see R3).
- `routes/upload.js` / `routes/owner.js` inline `require("../models/...")` — minor inconsistency.
- `googleId` not unique on User schema (L12).

---

# 🔴 CRITICAL BLOCKERS (must fix before production)

## C1. `.env` has a corrupted `GOOGLE_CLIENT_ID` and exposed real secrets

- The `.env` value for `GOOGLE_CLIENT_ID` is a **`mongodb+srv://...` connection string**, not a Google OAuth client ID.
- **Effect:** Google sign-in **will fail** with "Google authentication failed"; the frontend Google button is broken in production.
- The visible Razorpay / Resend test keys are committed to `.env` — **rotate them**.

**Fix (manual, .env):**
```env
GOOGLE_CLIENT_ID=<your-real-google-oauth-client-id>.apps.googleusercontent.com
MONGO_URI=mongodb+srv://<real-username>:<real-password>@cluster0.onnht0o.mongodb.net/?retryWrites=true&w=majority
```
> ⚠️ Rotate ALL exposed keys (Razorpay, Resend, Cloudinary, Mongo, JWT) before production.

## C4. `.env` not confirmed git-ignored
- Real keys may already be in git history. Add `.gitignore` for `.env` and purge history if it was committed.

---

# ℹ LOW / OPTIONAL

- **L1.** `controllers/` folder is dead code — `ownerController.js`, `studentController.js`, `adminController.js` not required by any route.
- **L2.** No test suite (`npm test` is a placeholder echo).
- **L3.** No CI/CD pipeline.
- **L4.** No Dockerfile / healthcheck beyond `/api/health`.
- **L5.** No structured logging (pino/winston); all `console.log`.
- **L6.** No `NODE_ENV`-based gating (helmet HSTS, trust proxy, etc.).
- **L7.** `express-rate-limit` behind a proxy requires `app.set('trust proxy', ...)`.
- **L8.** No request-id / correlation header.
- **L9.** No DB backup automation documented.
- **L10.** `Otp` TTL is good (300s) ✅.
- **L11.** `User` schema has `unique: true` on `email` but no unique index on `googleId` (duplicate Google accounts possible).

---

# MODEL AUDIT (Phase 3)

| Model | Indexes | Validators | Timestamps | Issues |
|---|---|---|---|---|
| User | email, role+status, createdAt | enum/trim/unique email | ✅ | `googleId` not unique; `rating` min/max OK |
| Property | city, state, college, rent, propertyType, status, featured, owner, averageRating, createdAt | enums + required | ✅ | no compound `(status, city)` index; `latitude/longitude` no range |
| Booking | propertyId, userId, ownerId, paymentStatus, bookingStatus + 4 compounds | enums | ✅ | `price` no `min`; `specialRequest` no max |
| Review | none | min/max rating, required comment | ✅ | **no `{property,user}` unique** → duplicates possible |
| Otp | createdAt TTL 300s | required | (uses createdAt default) | ✅ good |
| Notification | receiverId+createdAt | enums | ✅ | none |
| Contact | none | none (all optional) | ✅ | needs validation + admin-only access (now enforced at route) |
| State | unique name | required unique | ❌ no timestamps | fine |
| City | none | required name | ❌ no timestamps | needs `{state,name}` index |
| College | none | required | ✅ | needs `{city}` + `{state}` index |
| Setting | none | defaults | ✅ | single-doc pattern OK |

---

# SECURITY AUDIT (Phase 4) — Scorecard

| Control | Status |
|---|---|
| Helmet headers | ✅ applied |
| Rate limiting | ⚠️ global only; auth routes stricter; OTP + public reads uncovered (R6, R7) |
| Mongo injection sanitizer | ✅ custom Express 5 middleware |
| XSS sanitizer | ✅ `express-xss-sanitizer` (Express 5 compatible) |
| JWT (HS256, 7d) | ✅ but no refresh/rotation; stored in localStorage (XSS risk) |
| bcrypt (12 rounds register, 10 change-password) | ✅ (inconsistent rounds; acceptable) |
| CSRF | ⚠️ N/A for Bearer-token API (localStorage), but Google OAuth should use PKCE |
| Upload MIME validation | ✅ multer fileFilter; ⚠️ relies on Cloudinary allowed_formats |
| Authz (ownership checks) | ✅ bookings/contact/upload/properties now guarded (C2/C3/H1/H2/M5 resolved) |
| Secrets | 🔴 `.env` real keys visible; rotate + gitignore (C1, C4) |
| CORS | ✅ allows localhost:5500/5000 only — must update for prod domain |
| Cookie handling | ⚠️ none used (token in localStorage) — acceptable but XSS-prone |
| Privilege escalation | ✅ property PUT + booking PUT whitelisted (M5, C3 resolved) |

---

# PERFORMANCE AUDIT (Phase 5)

- ✅ Most count queries use indexed fields.
- ✅ `Promise.all` used in admin dashboards (good parallelization).
- ⚠️ `GET /api/admin/properties/occupancy` loads **all properties** then reduces in JS → replace with `aggregate`.
- ⚠️ `GET /api/admin/reports/occupancy` same pattern.
- ⚠️ Admin `notifications/students|owners|all` load all users + insertMany huge arrays.
- ⚠️ `GET /api/properties` loads all properties with no pagination.
- ⚠️ `GET /api/bookings` loads all bookings with no pagination.
- ℹ No `compression` middleware.
- ℹ No query caching; acceptable at MVP scale.

---

# FRONTEND ↔ BACKEND INTEGRATION (Phase 6)

| Check | Result |
|---|---|
| Token key consistency | ✅ `camporaToken` / `camporaUser` centralized in `session.js`; legacy `camporauser` files removed |
| API base centralization | ✅ All active pages import `API` from `config.js` (single dev source) |
| Booking flow calls `GET /bookings/check`, `POST /bookings` | ✅ matches backend (backend now `auth`-protected) |
| Google login uses `POST /api/google` with credential | ✅ matches backend (but env corrupted C1) |
| Razorpay success calls `POST /payment/verify` | ✅ matches backend (amount now server-bound) |
| Upload flow uses `POST /upload` then `POST /properties/create` | ✅ matches backend (both `auth`-protected) |
| Admin dashboard uses `/admin/*` endpoints | ✅ matches backend routes |
| OTP flow uses `/api/otp/send`, `/api/otp/verify` | ✅ matches backend |
| Bookings page | ✅ `bookings.html` → `bookings-page.js` (modern) |
| Dashboard page | ✅ `dashboard.html` → `dashboard-v2.js` (modern) |
| Owner bookings | ✅ inline module script in `owner-bookings.html` |

---

# DEPLOYMENT READINESS (Phase 7)

**Current blockers:**
1. 🔴 `.env` corrupted `GOOGLE_CLIENT_ID` (C1) + real secrets exposed.
2. 🔴 `.env` not git-ignored; secrets may be in git history (C4).

**Deployment checklist when unblocked:**
- [ ] Fix `.env`; rotate ALL exposed keys (Razorpay, Resend, Cloudinary, Mongo, JWT).
- [ ] Set `NODE_ENV=production`, `app.set('trust proxy', 1)` behind reverse proxy.
- [ ] Add `compression`.
- [ ] Configure CORS for the real frontend domain.
- [ ] Add per-route rate limits (auth 20/15min, otp 5/15min per email, public reads 300/15min).
- [ ] Add CI (lint + `node --check` + tests) and a health-check-based restart policy.
- [ ] Add `.gitignore` for `.env`; remove `.env` from git history.
- [ ] Validate Review `{property,user}` uniqueness + schema hardening (R5).
- [ ] Add tests for auth + booking + payment before launch (L2).

---

# SCORECARD (out of 100)

| Category | Score | Notes |
|---|---|---|
| **Architecture** | 74 | Clean route/model split; dead controllers lower it slightly |
| **Security** | 76 | Auth gaps closed (bookings/upload/contact/properties); only `.env` secrets + minor hardening remain |
| **Performance** | 70 | Good indexing + Promise.all; some full-collection loads |
| **Code Quality** | 75 | Consistent, readable; dead legacy files removed |
| **Maintainability** | 73 | Well-commented; missing tests, CI, structured logs |
| **Production Readiness** | 62 | Blocked primarily by `.env` corruption/exposure |

---

# ✅ VERDICT: IS CAMPORA PRODUCTION READY?

## Not yet — but close.

### What changed since the original audit:
The previously-flagged **security blockers (C2, C3, H1, H2, H4, H6, M5)** have been
**verified as FIXED in the actual source**:
- Bookings/contact/upload routes are now `auth`-protected with role + ownership checks.
- Payment transitions are server-side only; amount is bound to the DB booking.
- Property PUT uses a field whitelist; public reads only expose approved/published properties.
- Frontend API base + token keys are centralized; broken legacy files removed.

### Remaining blockers (in priority order):
1. 🔴 **`.env` corrupted `GOOGLE_CLIENT_ID`** — Google login is broken (C1).
2. 🔴 **Real secrets exposed in `.env`** — must rotate (Razorpay/Resend/Cloudinary/Mongo/JWT) (C1, C4).
3. 🟠 **OTP email-bombing rate cap** missing (R6).
4. 🟠 **Schema hardening** (Review unique index, Booking/Contact validators) (R5).
5. 🟠 **Per-route rate limits + trust proxy** for production (R7, L7).
6. 🟠 **Admin mass-notification endpoints unbounded** (R2).

### What is ready:
- ✅ Express 5 + Mongoose + Atlas connectivity (DNS bootstrap works)
- ✅ Graceful shutdown / reconnect without `process.exit(1)`
- ✅ Route loading + health endpoint
- ✅ Core auth (register/login/me, JWT, bcrypt) is solid
- ✅ Model indexes generally good
- ✅ Mongo/XSS sanitizers work under Express 5
- ✅ All critical authz/payment bypass vulnerabilities closed

**Once the `.env` blocker + the minor hardening items above are resolved, Campora is deployable** to Render/Railway/VPS with the checklist above.

---

*Audit performed via source inspection. No business logic changed. Findings are evidence-based from current file contents.*

