# Green Harvest Management System

Responsive React app for Green Harvest Uganda Ltd. The new frontend uses React, Vite, and Tailwind CSS. A Node API handles authentication and business writes; PostgreSQL is hosted on Supabase. Project pictures use private AWS S3 storage with short-lived signed upload and read URLs.

## Current build

- Sign-in and authenticated workspace shell
- Company overview with live transaction, account, project, and phase totals
- Finance screens for transactions, accounts, and exchange rates
- Project register with budget, revenue forecast, status, risk, milestone, and private picture upload
- Mobile navigation and responsive layouts
- Farm operations, purchases/stock, people/assets, and audit screens are represented in navigation and remain planned modules

The current system still needs more Phase 2 work before acceptance: funded-phase targets, import of existing browser data, role administration, correction/reversal and approval flows, database row-level security, automated acceptance tests, and a tested backup/recovery process.

## Run locally

Requirements: Node.js 20.6+, npm, the Supabase CLI, a Supabase PostgreSQL project, and an AWS S3 bucket.

1. Install Node packages with `npm install`.
2. Copy `.env.example` to `.env`. Set `DATABASE_URL`, `OWNER_EMAIL`, `OWNER_PASSWORD`, and the AWS region and bucket. Keep `.env` private.
3. Authenticate and link the Supabase project: `supabase login`, then `supabase link --project-ref YOUR_PROJECT_REF`.
4. Review `supabase/migrations/20261122120000_phase2_foundation.sql` and apply pending migrations with `npm run db:push`. For a database with existing tables or migration history, reconcile its schema first; do not reset data to resolve a migration mismatch.
5. Create a private S3 bucket, keep public access blocked, attach the scoped policy in `aws/iam-policy-template.json` to the API's IAM role, and configure CORS with `aws/s3-cors.json`, replacing the example app origin with the real frontend origin. Consider an object lifecycle rule for abandoned uploads under `organisations/`.
6. In one terminal, run `npm start` to start the API on port 3000. In another, run `npm run dev` for the React app at `http://localhost:5173`.

For a single-origin production build, run `npm run build` and start the Node server with `npm start`; it serves the compiled React app from `dist/` and the API from `/api` on the same host.

The API connects to Supabase through `DATABASE_URL`. For a persistent backend, Supabase recommends the direct database connection when the host supports IPv6, or the session pooler on IPv4-only networks. The API uses TLS by default. Copy the connection string from the Supabase dashboard's **Connect** panel and URL-encode reserved characters in the password.

The API bootstraps the initial owner only when the configured email does not exist. The app uses this API session and does not expose database or AWS credentials to the browser. AWS uses the SDK credential chain; local development can use the credentials in `.env`, while deployed workloads should use an IAM role with access limited to the one bucket and required object prefix.

The previous prototype's browser `localStorage` data is not imported automatically. Export a backup from the old version and retain it until a reviewed import path is prepared.

## Environment variables

See `.env.example`. `DATABASE_URL`, `OWNER_EMAIL`, and `OWNER_PASSWORD` are required to initialize the API and owner. `AWS_REGION` and `AWS_BUCKET` enable picture uploads. `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` can be omitted when the runtime supplies an IAM role.

## Data and security notes

- UGX is the reporting currency; AED values use two minor digits and retain the selected exchange rate and stored UGX value. Conversion rounds to the nearest whole UGX.
- Uploaded pictures are private S3 objects. Only authenticated, authorized users can request signed URLs; uploads accept JPG, PNG, WebP, or AVIF up to 8 MB.
- Keep the API and frontend on the same site in production so the HttpOnly session cookie works with the current settings. Terminate HTTPS at the host.
- Do not deploy this as production software until database row-level security, login throttling, audit access controls, backup and restore, and automated acceptance coverage have been completed.

## Project files

| Path | Purpose |
|---|---|
| `src/` | React application and API client |
| `server/index.mjs` | Node API, session authentication, finance/project endpoints, signed S3 URLs |
| `supabase/migrations/` | Versioned PostgreSQL schema |
| `aws/s3-cors.json` | S3 browser upload CORS example |
| `aws/iam-policy-template.json` | Restricted picture object access policy template |
| `docs/phase-2-gap-assessment.md` | Architecture gap review and remaining sequence |
| `docs/schema.sql` | Earlier draft schema reference |
