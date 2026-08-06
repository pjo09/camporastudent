# CAMPORA STUDENT DASHBOARD V3 — COMPLETE REBUILD

## Status: IN PROGRESS

## Architecture
- Independent `student-v3-*` CSS namespace (no owner-v3 conflicts)
- Reuse existing backend models (User, Property, Booking, Review, Notification, Message, Maintenance, Invoice)
- Reuse existing auth (session.js, JWT middleware)
- ES modules, shared `student-utils.js`, central API helper
- No alert(), no inline JS, no console.log

## Backend (student sub-routes following owner pattern)
- [x] student-messaging.js — list conversations, get messages, send, unread count
- [x] student-maintenance.js — create, list, view, add comment
- [x] student-finance.js — invoices, payments, summary
- [x] Extend student.js — dashboard aggregate, cancel booking, documents, analytics
- [x] Mount sub-routes in server.js

## Frontend Shared
- [x] css/student-v3.css — shared premium theme
- [x] js/student-utils.js — apiFetch, toast, session, sidebar, topbar helpers

## Frontend Pages
- [x] student-dashboard.html + js/student-dashboard.js
- [x] student-explore.html + js/student-explore.js
- [x] student-property-details.html + js/student-property-details.js
- [x] student-saved.html + js/student-saved.js
- [x] student-bookings.html + js/student-bookings.js
- [x] student-payments.html + js/student-payments.js
- [x] student-messages.html + js/student-messages.js
- [x] student-notifications.html + js/student-notifications.js
- [x] student-maintenance.html + js/student-maintenance.js
- [x] student-reviews.html + js/student-reviews.js
- [x] student-profile.html + js/student-profile.js
- [x] student-documents.html + js/student-documents.js
- [x] student-analytics.html + js/student-analytics.js
- [x] student-support.html + js/student-support.js
- [x] student-settings.html + js/student-settings.js

## Booking Flow
- [x] Verify search → details → booking → payment → success → dashboard sync

## Verification
- [x] node --check all backend files
- [x] No broken imports / missing DOM IDs / API mismatches
- [x] All pages responsive, accessible, no CSS conflicts
