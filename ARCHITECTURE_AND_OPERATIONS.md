# LIQUOR ERP (VAAIRO ERP) — Production Architecture, Security & Operations Guide

## 1. Functional Inventory & Existing Codebase Audit

| Module | Frontend Component(s) | Authoritative Backend / Firestore Collections | Roles Allowed | Key Production Upgrades Applied |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & MFA** | `LoginGateway.tsx`, `SessionSecurityMonitor.tsx` | `/api/auth/login-pin`, `/api/auth/verify-google-mfa`, `/staffDirectory`, `/userSessionMonitors` | All Authenticated Roles | Salted SHA-256 PIN verification, 5-attempt IP+user brute-force lockout (15m), disabled account rejection, RFC 6238 TOTP MFA. |
| **POS Terminal** | `PosTerminal.tsx`, `EtimsReceiptModal.tsx` | `/api/pos/checkout`, `/api/pos/refund`, `/sales`, `/inventoryTransactions`, `/journalEntries` | `SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`, `MANAGER`, `CASHIER` | Idempotency keys (`idempotencyKey`), server-side price lookup, role discount ceilings, stock concurrency lock, Credit Note refunds. |
| **Inventory & Barcode** | `InventoryManager.tsx`, `StockAuditSessionPanel.tsx`, `BarcodeScannerModal.tsx` | `/api/inventory/transact`, `/api/inventory/ledger`, `/api/transfers/workflow`, `/branchInventoryLedgers`, `/inventoryTransactions`, `/stockAuditSessions` | `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `INVENTORY_STAFF`, `PROCUREMENT_STAFF` | Immutable inventory movement ledger (`beforeQuantity`, `afterQuantity`, `reason`), formal Stock Transfer state machine (`DRAFT` → `RECEIVED`), automated low-stock alerts. |
| **Accounting & Finance** | `AccountingHub.tsx`, `CommercialInvoicingManager.tsx`, `QuotesManager.tsx`, `SupplyInvoicesManager.tsx` | `/api/accounting/post`, `/api/accounting/period/close`, `/api/accounting/period/reopen`, `/journalEntries`, `/accountingPeriods` | `SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT` | Strict `Total Debits === Total Credits` enforcement, automated COGS + Inventory asset entries, Accounting Period closing & Super Admin audited reopening. |
| **Tax & KRA eTIMS** | `src/config/erpConfig.ts`, `src/utils/kenyaTax.ts` | `/api/etims/sign`, `/api/etims/reconcile`, `/fiscalTransactions` | `SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`, `MANAGER` | Configurable Tax Engine (Inclusive, Exclusive, Zero-Rated, Exempt), honest Fiscal Lifecycle (`PENDING`, `SUBMITTING`, `SUCCESS`, `RETRY_PENDING`, `FAILED`) with reconciliation queue. |
| **Transactional Email** | `AdminSettingsHub.tsx` | `/api/email/send`, `/api/email/status` | Authenticated Staff / Admins | Server-side dispatch from `support@urbantechdev.com` (`urbantechdev.com`) via Zoho Mail & Cloudflare DNS (SPF/DKIM/DMARC). |

---

## 2. Granular Role-Based Access Control (RBAC) & Branch Isolation

Defined in `src/utils/rbac.ts`:
- **Roles**: `SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`, `MANAGER`, `CASHIER`, `INVENTORY_STAFF`, `PROCUREMENT_STAFF`, `REPORTING_USER`.
- **Granular Permissions**:
  - `sales.view`, `sales.create`, `sales.edit`, `sales.refund`
  - `inventory.view`, `inventory.receive`, `inventory.adjust`, `inventory.transfer`
  - `invoice.view`, `invoice.create`, `invoice.cancel`
  - `accounting.view`, `accounting.post`, `accounting.adjust`
  - `users.view`, `users.create`, `users.edit`
  - `settings.view`, `settings.edit`, `reports.view`, `tax.configure`
  - `period.close`, `period.reopen`
- **Branch Isolation (`canAccessBranch`)**:
  - `SUPER_ADMIN`, `ADMIN`, and `ACCOUNTANT` hold `allBranchesAccess: true`.
  - Branch staff (`MANAGER`, `CASHIER`, `INVENTORY_STAFF`, `PROCUREMENT_STAFF`, `DELIVERY_MANAGER`) are strictly scoped to their assigned `branchId`. Cross-branch API mutations return `403 Forbidden` and write a security alert to `auditLogs`.

---

## 3. Transactional Email System (`support@urbantechdev.com` — Zoho Free Plan One-Way Outbound)

- **Sender Identity**: `support@urbantechdev.com`
- **Domain**: `urbantechdev.com` (Zoho Mail Free Plan + Cloudflare DNS)
- **Communication Model (One-Way System Outbound)**:
  - **Outbound (System → Recipient)**: The ERP backend automatically sends Invoices, Quotations, Fiscal Receipts, Low-Stock Alerts, and Supplier Notifications from `support@urbantechdev.com` with `Reply-To: support@urbantechdev.com`.
  - **Inbound (Recipient → Zoho Webmail Mailbox)**: Because Zoho Mail Free Plan is webmail-only and does not provide inbound IMAP/POP/webhook ingestion into external apps, all incoming customer and supplier emails/replies go directly to the **`support@urbantechdev.com` Zoho Webmail Inbox (`https://mail.zoho.com`)**.
- **Required Cloudflare DNS Records for `urbantechdev.com`**:
  - **MX (`MX`)**: `mx.zoho.com` (Priority 10), `mx2.zoho.com` (Priority 20), `mx3.zoho.com` (Priority 50)
  - **SPF (`TXT`)**: `v=spf1 include:zoho.com ~all`
  - **DKIM (`TXT`)**: `zmail._domainkey.urbantechdev.com`
  - **DMARC (`TXT`)**: `v=DMARC1; p=quarantine; rua=mailto:support@urbantechdev.com`
- **Security**: Outbound API credentials (`ZOHO_MAIL_API_TOKEN`) reside exclusively in server environment variables and are never exposed to the browser bundle.

---

## 4. Backup, Restore & Data Migration Procedures

1. **Automated Firestore & Server State Backups**:
   - Run scheduled GCP Firestore export (`gcloud firestore export gs://<backup-bucket>/vaairo-erp-$(date +%F)`) daily at 01:00 EAT.
   - Retain daily backups for 30 days and monthly snapshots for 12 months.
2. **Safe Data Migration Protocol**:
   - Step 1: Export full production Firestore snapshot and verify checksums.
   - Step 2: Execute migration script against staging database first.
   - Step 3: Verify document counts, inventory balances (`sum(inventoryTransactions) == branchInventoryLedgers.quantity`), and trial balance (`sum(debits) == sum(credits)`).
   - Step 4: Promote migration to production during maintenance window.

---

## 5. Vercel & Cloudflare Production Deployment Checklist

- **Environment Variables**: Configure all variables listed in `.env.example` inside Vercel Production & Preview Environment settings.
- **Cloudflare Caching**: Ensure `/api/*` routes bypass edge caching (`Cache-Control: no-store, no-cache, must-revalidate, private` enforced in `server.ts`).
- **Pre-Deployment Verification**:
  - Run `npm run lint` (TypeScript type verification)
  - Run `npm test` (7-part Production Security & Integrity Suite)
  - Run `npm run build` (Production bundle verification)
