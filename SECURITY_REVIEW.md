# VAAIRO / KenyaLux ERP — Review & Fixes

Scope: static review of auth, API surface, Firestore rules, secrets, M-Pesa and crypto code.
Not done: running the app or `npm test` (no dependencies/network in the review sandbox). Syntax of every edited file was verified; **please run `npm install && npm run lint && npm test` before deploying.**

## Fixed (critical)

| # | Problem | Fix |
|---|---------|-----|
| 1 | `POST /api/auth/terminal-session` was unauthenticated and trusted `role`/`email` from the request body. Anyone could mint a SUPER_ADMIN token (admin email is hard-coded in source). | Endpoint now only re-issues an already-verified session; roles never come from the body. |
| 2 | Login screen had **"Direct Sign-In as System Administrator"**: a credential-free admin login. | Both buttons and the handler removed. |
| 3 | TOTP endpoints (`setup-init`, `setup-verify`, `disable`) were unauthenticated and trusted body email/userId: anyone could disable or hijack admin MFA (and overwrite the global secret). | Require a session; bound to the session's identity; global secret no longer overwritten. |
| 4 | `resolveOptionalCallerIdentity` trusted body/query identity. | Identity comes only from a verified token. |
| 5 | Unauthenticated read/write of business data: `/api/erp/unified-state` (+sync), `/api/users/sync`, `/api/products/sync-*`, `/api/documents/sync`, `/api/audit/*`, `/api/customers/live-sessions`, and the SSE `/api/erp/live-stream` (dumped staff + all state on connect). | All require a session (SSE accepts `?token=`). Clients updated to send tokens. |
| 6 | `/api/users/sync` let callers write any role/branch for any user. | Forced to the caller's own record and session role. |
| 7 | Staff directory GET exposed PIN hashes, salts and plaintext `loginPin`. `sync-batch` had no role check. | Auth required, PIN material stripped, management role required for batch sync. |
| 8 | **Firestore rules:** `canAccessBranchData()` ended in `|| request.auth == null || ...`, so it was always true (18 rules). `organizationMemberships` create/update was open to anyone with a well-formed doc, enabling self-granted admin. | Branch check is now `isAdmin() || isAssignedToBranch()`; membership writes require admin. |

## Fixed (high / medium)
- Server PIN salts and TOTP secrets used `Math.random()` (the `window` check failed on Node). Now always CSPRNG, throws if unavailable.
- `X-Forwarded-For` was trusted blindly, so the brute-force lockout was bypassable. Now only honoured with `TRUST_PROXY=1`.
- M-Pesa: the receipt number stored on the unauthenticated `/api/mpesa/query` came from the client. Now only from the server record. Callback URL now prefers `APP_URL` instead of the Host header.
- Seeded staff with no PIN all got `000000`. Now a random PIN (admin must set one).
- `google-login` persisted the user record *after* `return` (dead code). Moved before.
- `npm start` ran `node server.ts` with no `NODE_ENV`, so the production secrets check never ran. Now `NODE_ENV=production tsx server.ts`; `tsx` moved to dependencies.
- `.erp-dev-secrets.json` was not git-ignored. `.env.example` now lists every required variable.

## Still needs your decision (not changed)
1. **Role-switching in `ErpContext.loginAsRole`** is client-side. The server now enforces real roles, but the UI can still *display* a role the token doesn't have. Expect 403s there; the UI flow should be reworked.
2. **Rotate anything exposed**: the Firebase web `apiKey` is public by design, but confirm Authorized domains + App Check, and rotate `.erp-dev-secrets.json` values if it was ever committed or shared.
3. Hard-coded super-admin emails (`urbaninteriorkenya@gmail.com` in server, rules and client; plus extra ones in `LoginGateway.tsx`). Move to `ADMIN_EMAILS` / custom claims.
4. `MPESA_ENV` defaults to **production** and shortcode defaults to `4082211`. Default to sandbox.
5. `setup-init` still accepts a client-chosen `customSecret`; the server should generate it.
6. `webhookSecret` falls back to the session secret; set `MPESA_WEBHOOK_SECRET` separately. The `?sig=` query token can leak into logs.
7. Several files are huge (`ErpContext.tsx` 10k lines, `InventoryManager.tsx` 335 KB, `server.ts` 3.7k lines) and `src/types.ts` duplicates `src/types/index.ts`. Worth splitting.
8. Rate limiting only covers PIN/MFA; add it to public endpoints (checkout token, STK push, location lookup).
9. Dependency versions in `package.json` (e.g. TypeScript 7, Vite 8) should be confirmed against what `bun.lock` resolves.
