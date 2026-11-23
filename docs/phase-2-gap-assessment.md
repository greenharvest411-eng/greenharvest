# Phase 2 foundation: gap assessment

**Reference:** *Green Harvest Uganda Ltd — Integrated Company Management System*, Architecture Document (Phase 1), draft v0.1.  
**Reviewed:** current `index.html`, `js/app.js`, `js/store.js`, `docs/schema.sql`, and `README.md`.

## Conclusion

The current app is a useful single-user prototype of the investment register and foundation screens. It is **not yet an accepted Phase 2 foundation** under the architecture document. The biggest issue is the storage boundary: all data and apparent permissions live in one browser's `localStorage`, so users, roles, organisation scoping, audit integrity, and shared records cannot be enforced. The SQL file is a starting sketch, not a deployable secure schema.

Keep the prototype as a reference for the forms and workflows. Before expanding into Phase 3 farm operations, establish the authenticated server and database foundation, then move the finance flows onto it and verify them against explicit acceptance tests.

## Current state against Phase 2

| Area | What exists | Gap / acceptance status |
|---|---|---|
| Company and settings | Departments, locations, accounts, projects, phase targets are represented in the UI. | Stored as generic entries/settings without a company record or consistent organisation ownership. No financial year or company profile. **Partial prototype only.** |
| Projects | Budget, forecast, department, location, status, risk, milestone. | No feasibility assessment or budget lines; project records can be hard-deleted; links are not protected by organisation-scoped constraints. **Partial.** |
| Finance | Manual income/outflow, founder contributions, accounts, UGX/AED amount and captured rate, phase summaries. | No backend calculations, categories, debts/loans, budgets, or account reconciliation. Balances are recomputed in browser JavaScript. Overspend checks are browser confirmation prompts and can be bypassed. **Not accepted.** |
| Currency | AED entries store original amount, rate and rounded UGX amount in the browser. Rate history is displayed. | No immutable rate reference on contributions; rate selection is manually editable per entry; money is represented inconsistently (decimal original amount and whole UGX) and no documented rounding policy exists. **Partial.** |
| Login and permissions | UI labels the local user as owner. | No authentication, password handling, roles, permission list, scope enforcement, or server authorization. **Missing.** |
| Audit | Browser collection logs adds/deletes with a label, time and a short description. | Edits are absent; delete removes source data before/independent of audit; audit write is a second client request and can fail silently; no old/new values, actor assurance, IP/device, approval/export/login events, append-only protection, or server/database enforcement. **Missing for acceptance.** |
| Data integrity | Basic form checks and confirmation dialogs. | No server validation, database constraints for most relationships, atomic transaction + audit writes, amendment/reversal model, or protection from direct browser data changes. **Missing.** |
| Backups | Manual JSON export/import from the current browser. | No scheduled backup, independent copy, status/alert, restore test, or recovery procedure. Import replaces all local data. **Prototype convenience only.** |
| Mobile / low bandwidth | Responsive page shell and local persistence. | No demonstrated offline synchronization or conflict handling. Browser local storage is device-specific and fragile as the system of record. **Partial.** |
| Tests / acceptance | README describes intended future tests. | No automated tests or recorded acceptance evidence are present. Exact balance, AED history, permission denial and audit behavior remain unverified. **Missing.** |

## Important implementation findings

- `js/store.js` writes directly to `localStorage`; its `user` adapter always returns `local-owner`. It performs no authorization.
- `js/app.js` calls `delete()` for records, which physically removes them. The displayed audit log is written separately and only after the data operation; failures are swallowed.
- UI checks for overspending and project budget overruns use `confirm()`. They are prompts, not approval workflows or enforceable rules.
- The transaction and contribution forms calculate UGX in the browser. There is no shared server-side calculation path, and historical exchange-rate references are not consistently retained.
- `docs/schema.sql` has useful starting entities, but it lacks an authentication/session design and row-level security policies. The `REVOKE` statement alone does not make the audit log append-only. Several foreign keys are nullable or do not ensure that linked records share the same organisation. Users/roles are not seeded with a permission catalogue or owner assignment. The schema also mixes `numeric(18,2)` original amounts with a document requirement to store money in whole smallest units; currency precision and rounding need an explicit decision.
- `README.md` correctly identifies the local-only limitation and says the schema is untested.

## Recommended order of work

### 1. Agree the foundation decisions

Before implementation, choose the backend/API and authentication approach, identify the first account types to support, confirm who may enter exchange rates, and choose the financial year start. Keep statutory payroll rules out of scope until confirmed by an accountant. Hosting can remain a later decision as the architecture document states.

### 2. Define and harden the data model

Revise `docs/schema.sql` into a migration-ready schema. Add the organisation profile and financial year; establish organisation-consistent foreign keys; settle money units and rounding; retain exchange-rate IDs on every converted record; model corrections as reversals/amendments; and add the indexes, constraints, and initial Owner role/permissions needed by Phase 2. Add database-enforced audit append-only behavior and scoped access policies after the chosen authentication model is known.

### 3. Implement the server boundary

Add authenticated API routes and server-side validation/authorization. Make every read and write scoped to the user's organisation and applicable department/project/location. Make data mutation and its audit entry one atomic operation. Add soft-delete or reversal endpoints for financial records; do not expose generic hard deletion for them.

### 4. Move the existing finance flows behind the API

Implement accounts, income, expenses, founder contributions, phase funding, projects and exchange rates first. Move totals and budget/funding checks to server-side functions. Refactor `js/store.js` to call the API while retaining a narrow interface for the current UI where that remains useful.

### 5. Prove Phase 2 acceptance

Automate and record these minimum checks before calling Phase 2 ready:

1. Sample UGX transactions produce exact account, phase and overall balances.
2. AED transactions retain original amount, rate record, applied rate and UGX value after later rates change; rounding matches the agreed rule.
3. A user without a required permission cannot read or change the protected record through the API.
4. Every create, amendment/reversal, deletion request, approval, and permission change creates a durable audit event with actor, time, record, and before/after values where applicable.
5. A failed transaction leaves neither a partial finance change nor a misleading audit event.

### 6. Prepare operations after development

Once development is accepted, configure managed hosting, HTTPS, private file storage, daily backups and a second copy; perform and record a restore test; document recovery targets and procedures. These are go-live requirements, but the architecture document places hosting/deployment after development.

## Suggested first implementation slice

Start with a **backend and database vertical slice for Owner login + organisation + accounts + income/expense transactions + exchange rates + audit**. It directly addresses the highest-risk gaps and exercises the Phase 2 acceptance rules with real data. Keep contributions and project integration next within Phase 2, before starting crop and livestock records.

## Decisions to capture from the owner

The architecture document lists these as open decisions: initial staff roles; which cash/bank/mobile-money accounts to record; exchange-rate source and who can enter rates; financial year start; payroll rules (accountant confirmation required); recovery time and acceptable data loss; and which module follows the foundation. For the first backend slice, the account list, rate-entry authority, and financial year are the most immediate inputs. Staff roles and recovery targets can be finalized before staff rollout and go-live respectively.
