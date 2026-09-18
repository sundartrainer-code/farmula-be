# Farmula technical handover report

Prepared: 18 September 2026

## Delivery status

Migration is prepared locally but NOT pushed or completed. Both destination repositories are publicly readable. GitHub rejects write access for the authenticated SSH account `vickymadhav1` to both destinations. The destination owner must grant that account collaborator/write access and any invitation must be accepted, or authenticate an account that already has write access.

| Component | Destination | Source commit | Prepared commit |
| --- | --- | --- | --- |
| Backend | https://github.com/sundartrainer-code/farmula-be | 2763bc4be9de143429963a32774dda255898a805 | 2278c6f5d5a0aabaff0cf59c663a0edd4a9021b7 |
| Frontend | https://github.com/sundartrainer-code/farmula-fe | 780553d5110ed528c08c2cf39a4088bded10b87e | a1c565d7c1e771f556cc7883e9158bb17067eda2 |

Scope: backend and frontend only. Design mockups are excluded. Repository migration does not transfer hosting accounts, database records, Firebase users, video files, domains, billing, issues, repository settings, or service ownership.

## Prepared delivery

`farmula-be.bundle` and `farmula-fe.bundle` contain the prepared main-branch histories. `manifest.json` records source and prepared commit identifiers. The current tracked file trees match their original repositories exactly. Historical `.env` files were removed from both prepared histories; this changes commit identifiers. Original working repositories were not rewritten or repointed. Untracked macOS `.DS_Store` files were excluded.

The destinations are not empty: backend main is `e3986b10511954cf0845307c3812bf48304df05e` with README, .gitignore and LICENSE; frontend main is `348cf60f6a4e4ec25455a45caa59f59ddd0b8813` with README and .gitignore. Before pushing, fetch the current destination heads and reconcile these initial commits without overwriting remote history. Inspect the destination license before combining it with the application.

To inspect an offline delivery, from this directory:

```sh
git clone farmula-be.bundle backend-review
git clone farmula-fe.bundle frontend-review
```

These bundles exclude destination initial commits and do not prove a successful remote migration. They should be shared privately pending a complete credential review.

## Architecture and local setup

Backend: Node.js >=20, Express, Prisma 6, PostgreSQL, Firebase Admin authentication, Razorpay payments and Google Drive media storage. Code is organized into routes, controllers, services, repositories and middleware. Database schema is in `prisma/schema.prisma`; seven migration directories are present.

Frontend: Vue 3, Vite 6, Pinia, Vue Router, Tailwind CSS, Firebase client authentication and HLS playback. Views cover courses, lessons, subscriptions, profile and administration.

Backend setup in its repository:

```sh
npm ci
cp .env.example .env
# Fill configuration using the company's secret manager.
npm run prisma:generate
# After confirming the database target and taking a backup:
npm run prisma:migrate
npm run dev
```

Backend production start: `npm start`; default port: 8081. Frontend setup: `npm ci`, configure environment, then `npm run dev`. Build with `npm run build`; output directory is `dist`.

## Configuration to transfer securely

Backend configuration is defined in `src/config/env.js`. Required integrations include DATABASE_URL; RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET; Firebase service account credentials; and a separate Google Drive service account. Firebase supports FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_JSON, or individual FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY fields. Drive supports GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY. Configure GOOGLE_DRIVE_FOLDER_ID, FRONTEND_ORIGIN, NODE_ENV, PORT and RAZORPAY_WEBHOOK_SECRET for the target environment as applicable. See `docs/google-drive-storage.md` for storage setup.

Frontend variables include VITE_API_URL for development, VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID and VITE_RAZORPAY_KEY_ID. VITE variables are browser-visible; never put private service credentials in them.

Production API requests use `/backend` regardless of VITE_API_URL. `netlify.toml` proxies this and other API routes to the existing Render hostname `farmula-bend-d8p6.onrender.com`. Update those proxy targets if the backend moves. Preserve the SPA fallback. Firebase client defaults and the Razorpay public key in configuration point to existing integrations and need review during service handover.

## Hosting and operational handover

The repository configuration references Netlify, Render, the domain formulaiq.co.in, Firebase, PostgreSQL, Google Drive and Razorpay. Their live ownership, billing and availability have not been verified or changed.

The current owner and receiving company must arrange:

- Repository access, branch protection and required reviewers after the push.
- Netlify/Render project ownership or new deployments, environment secrets and repository deployment connections.
- PostgreSQL backup/restore or ownership transfer, connection settings and migration status.
- Firebase project access, authentication users, authorized domains and service account provisioning.
- Google Cloud/Drive permissions and continued access to course videos, thumbnails and documents.
- Razorpay account access, key configuration and webhook URL `/api/razorpay/webhook` with its signing secret.
- Domain registrar/DNS, certificates, billing and support ownership.

## Credential remediation

An old backend `.env` commit contains configured database credentials and a JWT secret. Those files were removed from the prepared history, but removal does not revoke credentials or clean existing clones and old repositories. Rotate affected credentials through the relevant services. A GitHub access token was also embedded in the original frontend remote URL; revoke/replace it and remove credentials from that URL when configuring the final remotes. No secret values are included in this report.

Removal of `.env` is not a comprehensive security audit. Review all history and artifacts before public publication. Keep environment files and service account JSON out of Git.

## Validation and acceptance

Completed locally: frontend production build passed; JavaScript syntax checks passed for 62 backend source/script files; prepared current file trees match their source repositories; `.env` has no history on the prepared main branches.

Not performed: production deployment, database migration, live authentication/payment/media tests, service ownership transfers, or remote commit verification. Package scripts do not define an automated test suite.

Before operational acceptance, verify `/health` reports database connected; login and logout work; course and lesson content loads; subscription access restrictions work; payment and webhook activation work in an appropriate test environment; videos seek/play; progress persists; and admin operations enforce permissions. Verify production redirects, CORS and authorized domains.

After write access is fixed, reconcile destination initialization commits, finish the credential review, push main without force, compare remote and local heads, reconnect deployment projects and record deployment results. Keep existing deployments available until the receiving company verifies the replacement. Database rollback requires a validated backup and a separate migration plan.

## Sign-off

Receiving company/contact: pending. GitHub push and remote verification: pending. Hosting and service ownership acceptance: pending. Production smoke-test acceptance: pending. No report or credentials have been sent to another company.
