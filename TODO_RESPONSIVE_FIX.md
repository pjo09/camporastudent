# Responsive Stabilization Fix — Campora

## Goal
Fix severe mobile/tablet text & component overlap on the landing page (index.html + index.css) without redesigning, removing features, or touching backend/auth/API/logout logic. Fix the actual overflow sources, not just `overflow-x:hidden`.

## Scope
- Landing page (index.html + index.css) — PRIMARY (matches screenshot).
- Do NOT modify the logout/session redirect system — it is already implemented and verified.

## Steps

### Landing page (index.html + index.css) — PRIMARY
- [x] Fix fixed header/hero spacing so hero content never sits under header.
- [x] Collapse `.hero-wrapper` from 2-col to 1-col reliably at tablet (992px) and ensure hero text/heading never overlap.
- [x] Add clamp() to hero title; prevent heading overlap at all breakpoints.
- [x] Fix `.hero-search` to stack cleanly on mobile/tablet; keep 44px+ touch targets.
- [x] Fix `.hero-trustpoints` negative margin overlap.
- [x] Contain/disable floating hero cards outside viewport at tablet/mobile.
- [x] Ensure nav-links + mobile-menu never overlap hero content; proper mobile menu layer.
- [x] Additive responsive layer appended at end of index.css (preserve desktop).
- [x] Make all landing grids collapse cleanly (existing @media blocks verified for featured/why/steps/statistics/testimonials/showcase/waitlist/vision/cta/faq/contact/footer).

### Validation
- [ ] Verify no horizontal overflow at 320px.
- [ ] Verify desktop (1024/1280/1440/1920) preserved.
- [ ] Confirm existing logout/session redirect behavior is untouched.
