# STUDENT V3 MIGRATION — STATUS

## Phase 1: Migrate Legacy Pages (10 pages)
- [x] dashboard.html ← student-dashboard.html + CSS/JS swap
- [x] properties.html ← student-explore.html + CSS/JS swap
- [x] property-details.html ← student-property-details.html + CSS/JS swap
- [x] booking.html ← student-booking.html + CSS/JS swap
- [x] bookings.html ← student-bookings.html + CSS/JS swap
- [x] saved-properties.html ← student-saved.html + CSS/JS swap
- [x] messages.html ← student-messages.html + CSS/JS swap
- [x] notifications.html ← student-notifications.html + CSS/JS swap
- [x] profile.html ← student-profile.html + CSS/JS swap
- [x] settings.html ← student-settings.html + CSS/JS swap

## Phase 2: Create New Pages (6 pages)
- [x] payments.html ← student-payments.html
- [x] maintenance.html ← student-maintenance.html
- [x] reviews.html ← student-reviews.html
- [x] documents.html ← student-documents.html
- [x] analytics.html ← student-analytics.html
- [x] support.html ← student-support.html

## Phase 3: Update JS Redirects (student-utils.js + all V3 JS files)
- [x] student-utils.js — notificationBell redirect → notifications.html
- [x] student-dashboard.js — all student-* redirects (already correct)
- [x] student-explore.js — all student-* redirects (already correct)
- [x] student-property-details.js — properties.html, booking.html, messages.html, reviews.html
- [x] student-booking.js — properties.html, bookings.html
- [x] student-bookings.js — properties.html
- [x] student-saved.js — properties.html, property-details.html
- [x] student-messages.js — no student- refs
- [x] student-notifications.js — no student- refs
- [x] student-profile.js — no student- refs
- [x] student-settings.js — no student- refs
- [x] student-payments.js — no student- refs
- [x] student-maintenance.js — no student- refs
- [x] student-reviews.js — no student- refs
- [x] student-documents.js — no student- refs
- [x] student-analytics.js — no student- refs
- [x] student-support.js — no student- refs

## Phase 4: Update CSS (swap old stylesheets for student-v3.css)
- [x] dashboard.html — uses student-v3.css
- [x] properties.html — uses student-v3.css
- [x] property-details.html — uses student-v3.css
- [x] booking.html — uses student-v3.css
- [x] saved-properties.html — uses student-v3.css
- [x] messages.html — uses student-v3.css
- [x] notifications.html — uses student-v3.css
- [x] profile.html — uses student-v3.css
- [x] settings.html — uses student-v3.css

## Phase 5: Final Verification
- [x] Verify all sidebar nav items link correctly (all point to plain legacy names)
- [x] Verify all profile dropdown items work (profile/settings/support/login)
- [x] Verify booking → payment → success flow (booking.html → payment.html)
- [x] Verify explore search/filter/pagination (student-explore.js)
- [x] Verify messages.html DOM IDs match student-messages.js (convoList, chatAvatar, chatName, chatMessages, messageInput)
- [x] Verify no console errors (all student-*.js reference live DOM IDs)
- [x] Verify mobile layout (sv3-body responsive classes)
- [x] DELETE all 16 duplicate student-*.html files — DONE (dir finds none, no HTML references remain)
- [x] Verify student-*.js + student-v3.css retained (actively referenced by migrated pages)

## Cleanup Summary
- 16 duplicate `student-*.html` pages deleted (their V3 content now lives in migrated legacy filenames)
- `student-*.js` modules (16 files) retained — referenced by migrated pages via `<script type="module">`
- `css/student-v3.css` retained — shared V3 stylesheet
- `student-utils.js` retained — shared V3 utilities (apiFetch, initShell, toast, esc, inr, etc.)
- Legacy dead JS (`js/bookings.js`, `js/dashboard.js`, `js/properties.js`, `js/property-details.js`, `js/dashboard-v2.js`, `js/legacy/`) can be removed in a separate cleanup since no live pages reference them

## Notes
- messages.html DOM IDs realigned to match student-messages.js expectations.
- Payment flow (payment.html/success.html) preserved as-is per requirements.
