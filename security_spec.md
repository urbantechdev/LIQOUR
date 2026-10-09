# LIQUOR ERP — Zero-Trust Security Specification (`security_spec.md`)

## 1. Core Data Invariants
1. **Default-Deny Safety Net**: Every unmatched Firestore path (`/{document=**}`) is strictly denied (`allow read, write: if false;`).
2. **No Plaintext Credentials**: `staffDirectory/{staffId}` stores only salted SHA-256 hashes (`pinHash` + `pinSalt`) and never exposes staff credentials to non-admin users (`allow get: if isAdmin() || request.auth.uid == staffId; allow list: if isAdmin();`).
3. **Immutable Financial & Inventory Ledgers**:
   - `/inventoryTransactions/{txId}`: `allow update, delete: if false;`
   - `/journalEntries/{entryId}`: `allow update, delete: if false;` and `totalDebitKes == totalCreditKes`
   - `/stockAdjustmentLogs/{logId}`: `allow update, delete: if false;`
   - `/auditLogs/{auditId}` & `/userActivityLogs/{logId}`: `allow update, delete: if false;`
   - `/sales/{saleId}`: `allow delete: if false;` and `totalAmountKes`, `orderNumber`, and `createdAt` are immutable once created.
4. **Branch-Level Isolation**: `canAccessBranchData(branchId)` verifies that non-admin users can only access documents belonging to their assigned `branchId` with `active == true`.
5. **Terminal State Locking**:
   - `stockAuditSessions` in `APPROVED` or `CANCELLED` state cannot be modified by non-admins.
   - `stockTransfers` in `RECEIVED` or `CANCELLED` state are locked against further state transitions.

## 2. The "Dirty Dozen" Attack Payloads (Verified Denied)
1. **Unauthenticated Direct Read (`PERMISSION_DENIED`)**: Unauthenticated `get` on `/sales/ORD-2026-001001`.
2. **Cross-Branch Snooping (`PERMISSION_DENIED`)**: Cashier assigned to `branch-1` querying `/stockAuditSessions` or `/branchInventoryLedgers` belonging to `branch-2`.
3. **Client-Side Inventory Tampering (`PERMISSION_DENIED`)**: Cashier calling `updateDoc` directly on `/branchInventoryLedgers/branch-1_prod-1` to set `quantity: 999`.
4. **Historical Sale Total Tampering (`PERMISSION_DENIED`)**: Attempting to update `totalAmountKes` from `50000` to `10000` on `/sales/ORD-2026-001001`.
5. **Unbalanced Journal Injection (`PERMISSION_DENIED`)**: Creating a document in `/journalEntries` where `totalDebitKes (10000) != totalCreditKes (5000)`.
6. **Audit Log Deletion (`PERMISSION_DENIED`)**: Calling `deleteDoc` or `updateDoc` on `/auditLogs/{id}` or `/userActivityLogs/{id}`.
7. **Inventory Ledger Rewriting (`PERMISSION_DENIED`)**: Attempting to `update` or `delete` a historical `/inventoryTransactions/{txId}` document.
8. **Staff Directory Enumeration (`PERMISSION_DENIED`)**: Non-admin user executing `getDocs(collection(db, 'staffDirectory'))`.
9. **Unauthorized Stock Audit Approval (`PERMISSION_DENIED`)**: Non-admin staff updating `/stockAuditSessions/{id}` with `status: 'APPROVED'`.
10. **ID Poisoning / Oversized Payload (`PERMISSION_DENIED`)**: Submitting a 2KB document ID or string field exceeding schema boundary limits.
11. **Self-Privilege Escalation (`PERMISSION_DENIED`)**: Staff member attempting to update their own `department` or `role` in `/staffDirectory/{uid}`.
12. **Terminal Transfer Mutation (`PERMISSION_DENIED`)**: Attempting to modify a `/stockTransfers/{id}` document after `status == 'RECEIVED'`.
