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
- [x] Verify no horizontal overflow at 320px (body overflow-x:hidden + absolute decorative elements disabled on mobile).
- [x] Verify desktop (1024/1280/1440/1920) preserved (all mobile rules scoped to <=768px).
- [x] Confirm existing logout/session redirect behavior is untouched.

## Mobile Responsiveness — Comprehensive Fix (applied)
- [x] Mobile navbar: hide .nav-links/.nav-actions <=768px; only logo + hamburger; hamburger opens overlay dropdown (no space when closed); z-index on header/navbar.
- [x] Hero: normal flex/grid flow on mobile; explicit order badge → heading → description → search → trust → stats; absolute hero-ring/cards/student-online removed.
- [x] Search card: one-column, width 100% (contained), full-height fields, visible button, no horizontal overflow.
- [x] Section spacing: proper padding/margins between hero/stats/how/why/properties; grids collapsed to 1 col; no headings inside other sections; no negative margins.
- [x] Typography: hero clamp(2.3rem,10vw,4rem); section headings clamp(1.8rem,7vw,3rem); body 1rem–1.1rem; overflow-wrap on headings.
- [x] Overflow: body{overflow-x:hidden}; decorative blobs/orbs hidden on mobile; images constrained.
- [x] Absolute audit: decorative/layout absolute elements converted to hidden/static on mobile.
- [x] Breakpoints: max-width:768px + max-width:480px.
- [x] Test targets covered: 360/375/390/412/768 widths.
