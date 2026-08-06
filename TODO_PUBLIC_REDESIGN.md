# Public Website Redesign — Task List

Goal: Premium, production-ready public site consistent with Student V3 / Owner V3 dashboards.
Keep ONLY the Campora intro animation from index.html; rebuild everything else.
Preserve ALL backend APIs, auth logic, Google Login, OTP, sessions, IDs, JS behavior.

## Steps
1. [ ] Read full index.html (intro + scripts) and properties API to understand data shape
2. [ ] Rebuild index.html — premium landing, real backend data, keep intro animation
3. [ ] Create role-select.html + js/role-select.js (Student / Owner / Admin premium entry)
4. [ ] Redesign login.html (add forgot-password link, keep all flows)
5. [ ] Redesign register.html (keep role cards + all flows)
6. [ ] Create forgot-password.html + js/forgot-password.js
7. [ ] Fix otp-auth.js endpoint bug (${API}/send -> ${API}/otp/send)
8. [ ] Add minimal additive forgot/reset-password endpoints to routes/auth.js (only if required for feature)
9. [ ] Test flows, verify no regressions
