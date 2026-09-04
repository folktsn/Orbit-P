# HO-Recruitment

HO-Recruitment is the HR, employee document, organization chart, manpower, recruitment, and probation management system for Pattaya Aviation.

Production URL: https://orbithire.pattayaaviation.com/

GitHub repository: https://github.com/folktsn/Orbit-P

## Source Of Truth

- The only production source repository is `https://github.com/folktsn/Orbit-P`.
- Production deploys only from the `main` branch of this repository.
- `PattayaAviation/Orbit-P` is a legacy reference and must not deploy to production.
- Runtime credentials, uploaded files, build output, PM2 state, and local SQLite changes must never be committed.

## Current Production Setup

- Production app name: `orbit-p`
- Production server user: `ubuntu`
- Production app directory: `/home/ubuntu/orbit-p-folktsn`
- Production process manager: PM2
- Production branch: `main`
- Node.js runtime on server: Node 22
- Next.js version: 16.2.6
- Production build command: `next build --webpack`

> Next.js 16 uses Turbopack by default. This project builds production with Webpack because the current server deployment is more stable with `next build --webpack`.

## Main Modules

### Dashboard

Control tower overview for HR and recruitment metrics.

### Organization

Interactive organization structure view with department, division, section, unit, station, and position data.

Key capabilities:

- Organization chart view
- Search and filters
- Pan and zoom canvas
- Edit structure controls
- DynamoDB-backed organization data

### Manpower

Headcount Budget Control for HR planning.

Current MVP behavior:

- Loads organization structure first
- Counts current headcount from active employees who are still working as of today
- Excludes non-manpower groups such as Internship and other configured exclusions
- Supports department sheets by code, such as `BG`, `BH`, `BI`, `BE`
- Shows Budget, Current, Vacancy, and Over
- Allows budget values to be entered through the UI
- Stores manpower budget data separately from employee master data

Current headcount rule:

- Count employees who are still working today
- Employees with future resignation or last working dates are still counted until their last working date arrives
- Employees whose last working date has passed are excluded from current manpower

### Employees

Employee directory and profile side sheet.

Key capabilities:

- Active, Probation, and Resigning tabs
- Department, division, section, unit, station, date, and keyword filters
- Employee profile side sheet
- Refresh button for individual profile data
- Personal information, contact and address, employment details, emergency contact, extended info, documents, and system data
- Position adjustment
- Transfer
- Resign action
- Probation evaluation action

### Login Experience

The `/login` page uses a continuous full-viewport studio background with the glass sculpture kept at the far right and the OrbitHire sign-in flow layered in a rounded white card. On phones, the card begins below a compact visual header so the artwork remains visible while the LINE sign-in action stays in the first viewport. The generated artwork is stored locally at `public/login-glass-background.png` and rendered through `next/image`.

The production authentication flow is unchanged: users sign in through LINE LIFF, the server verifies the LINE access token, and the resulting session is limited by the employee's current permissions. Staff Login and demo accounts remain available only on localhost for development.

### Permissions

Permissions are stored per employee code and enforced by both the UI and API routes.

- `Access Permission`: allows the employee to sign in to the system
- `Edit Permission`: allows changes to employee, organization, manpower, recruitment, probation, and data-quality workflow data
- `View Permission`: allows protected HR data to be viewed
- `Admin Permission`: allows permission grants to be changed and includes every other permission

Permission dependencies are normalized automatically: Admin includes Edit, View, and Access; Edit includes View and Access; View includes Access. Employees without an explicit grant receive Access and View only.

Administrators can open `/admin` from the shield icon in the header or **Admin / จัดการสิทธิ์** in their profile menu. Search by employee code, name, position, or department; filter by permission and employment status; select an employee, adjust the four permissions, and save. The directory displays 20 employees per page, LINE-link status, and the latest saved permissions. Changes record the acting administrator and update time. The same permission editor remains available in the employee side sheet's `System Data` tab.

Both the admin directory API and permission updates require a current Admin grant on the server. Non-admin users cannot access the directory or save grants. The last Admin cannot be demoted, and the editor prevents saving when the initial permission load fails. Directory responses exclude personal identifiers, bank details, and LINE user IDs. Employee directory fields are cached for 60 seconds; permission grants are always read fresh.

The same editor also provides **สิทธิ์เข้าถึงแต่ละหน้า** for Dashboard, Organization, Manpower, Employees, Quality, Recruitment, and Probation. Page access is saved atomically with the four global permissions. It cannot grant View or Edit by itself. Admin users always have access to every page, including `/admin`; their page preferences apply if they are later demoted. **Quality is denied by default for all non-Admin users**, including existing users without a page grant and users with global View or Edit permission. An Admin must explicitly enable **เข้าถึง Quality** for that employee and save. Revocation applies on the next API request; navigation and window focus refresh the client session. A missing grant or null `PermissionGrant.pageAccess` retains the defaults for the other regular pages but does not allow Quality; malformed explicit values fail closed. Existing explicit Admin-approved page selections are preserved.

Navigation hides denied pages, and direct page navigation is checked before mounting the page. Sessions refresh on navigation and tab focus; the server reloads both global and page permissions for every protected API request, including mutations. Login opens the first permitted page. Users with no allowed pages see an access-denied screen. A forged URL parameter, Referer, or page header cannot authorize a module API.

Quality opens from the clipboard-check icon beside the light/dark theme toggle in the header, rather than the primary navigation bar. The icon has a Quality tooltip and an active-page highlight, and is shown only to Admin users or employees explicitly granted Quality access. On narrower screens the primary navigation uses a separate row so it does not overlap the header actions.

Page access controls workflows, not employee-level record scope. Employee profiles, attachments, profile updates, and the minimal operator directory are shared by Employees, Probation, and Quality. Organization read data is also shared by those pages and Manpower for filters and position selection; organization mutations still require Organization access. The full employee-list API requires Employees access. Dedicated Recruitment, Probation, Quality, and Manpower APIs require their corresponding page. Protected API responses use no-store while existing server-side caches remain active, so permission checks occur before returning cached data.

Run `node scripts/permissions.test.cjs` for isolated permission and page-access regression tests. Before deploying the additive nullable `PermissionGrant.pageAccess` column, back up SQLite; do not reset grants or the production database. No existing employee's permission selection is changed by the schema update.

Production LINE sessions use a server-verified LINE access token and a signed, HTTP-only session cookie. Direct LINE User ID login is restricted to local development.

### Employee Documents

Employee document management supports upload, view, download, and delete actions.

Standard document categories:

1. Resume
2. National ID Card
3. House Registration
4. Educational Certificates
5. Criminal Record Check
6. Pre-Employment Medical Examination
7. Military Service Documents
8. Name Change Documents
9. Employment Certificates
10. TOEIC Certificate
11. Driver's License
12. Bank Account
13. Probation Evaluation

Storage behavior:

- Files are stored in Amazon S3, not directly inside DynamoDB
- DynamoDB stores the metadata and S3 object keys
- View and download use short-lived presigned URLs
- Uploading documents must not change unrelated employee fields such as status, resignation status, position, or personal data

S3 folder policy:

- Root folder already exists: `Employees/`
- Employee folders use employee code only
- Standard subfolders are created idempotently
- Existing files must not be deleted, moved, or overwritten automatically

### Recruitment

Applicant Tracking System for candidate management.

The recruitment module uses Prisma and local SQLite data for ATS-related workflow data.

### Probation

Probation tracking and evaluation system.

Key behavior:

- Shows probation employees
- Calculates probation countdowns
- Supports Pass, Fail, and Extend outcomes
- Stores probation evaluation documents
- Scheduled/background logic processes status changes when dates are reached

Follow-up records have three independent rounds with a date, an automatically resolved evaluator employee code/name/position, and an optional **Comment** (up to 2,000 characters). Comment replaces the image-upload control in the follow-up dialog. Existing images remain stored and can still be opened from the legacy-image icon; saving a comment does not upload, delete, or overwrite attachments. Probation evaluation documents are unchanged.

Comments are stored as `probation_follow_up_1_comment`, `probation_follow_up_2_comment`, and `probation_follow_up_3_comment` on the DynamoDB `fullstaff` record. Blank comments are allowed and can clear an existing note; older clients that omit `comment` preserve it. Saves require Edit and Probation page access, and invalidate both employee and probation caches. Bulk follow-up applies the selected round's comment to the selected employees without an existing follow-up date for that round; completed records are skipped. The bulk dialog keeps a separate draft comment for each round.

Run `node scripts/probation-follow-up.test.cjs` for isolated follow-up persistence, validation, cache, and authorization regression tests. No migration or attachment removal is required.

### Data Quality

Read-only employee master data monitoring for HR operations.

Key behavior:

- Checks current employees for duplicate identities and duplicate name/date-of-birth combinations
- Finds missing employee, contact, emergency contact, position, department, and station fields
- Validates birth, start, probation, and separation dates
- Compares employee departments and positions with `PA_OrgStructure`
- Supports severity/category filters, employee search, CSV export, and direct links to employee records
- Supports issue workflow states, assignee lookup, due dates, notes, and a compact change history
- Stores workflow state and history separately in the local Prisma database
- Never changes employee master data automatically

## Data Stores

### Amazon DynamoDB

Used for primary HR data.

Tables used by the app:

- `fullstaff`
- `PA_OrgStructure`

Common data areas:

- Employee master data
- Employee status
- Employment data
- Contact and address data
- Organization chart data
- Document metadata and S3 keys
- Scheduled position adjustment and transfer data

### Amazon S3

Used for employee attachment storage.

Default bucket:

- `pa-hr-attachments`

Main areas:

- Employee document files
- Probation evaluation files
- Manpower budget data

### SQLite / Prisma

Used for local app data such as:

- ATS candidate workflow data
- LINE webhook mapping data
- Data quality workflow state and history
- Employee permission grants and permission audit metadata
- Local development database files

Do not treat SQLite as the primary employee master database.

## Environment Variables

Create a local `.env` or `.env.local` file. Do not commit environment files.

Required AWS values:

```bash
AWS_REGION=ap-southeast-7
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_ATTACHMENTS_BUCKET=pa-hr-attachments
```

Production should prefer an EC2 instance role. When an instance role is not
available, static keys may be supplied through the server environment only.
The application automatically uses the AWS SDK default credential chain when
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are absent.

The production IAM identity requires these permissions:

- DynamoDB read/write for `fullstaff` and `PA_OrgStructure`
- S3 list/read/write/delete for the application-owned prefixes in `pa-hr-attachments`
- S3 object access for `Employees/*`, `attachments/*`, and `evaluation/*`

Other environment values may be needed depending on the module being tested locally.

Authentication and permission values:

```bash
AUTH_SESSION_SECRET=replace-with-a-long-random-secret
LINE_LOGIN_CHANNEL_ID=your-line-login-channel-id
AUTH_APP_ORIGIN=https://your-public-app-domain
```

`AUTH_SESSION_SECRET` signs the HTTP-only session cookie. If omitted, the existing `LINE_CHANNEL_SECRET` is used. `LINE_LOGIN_CHANNEL_ID` is the LINE Login channel used by LIFF, not the Messaging API channel. Login validates the access token with LINE and resolves only an exact LINE User ID link, never a matching display name.

`AUTH_APP_ORIGIN` must be the public HTTPS origin, not the internal localhost address behind Nginx or another reverse proxy. Login checks the browser's Origin against this configured value.

After the permission schema is applied, an authorized server operator can bootstrap the first Admin using `scripts/bootstrap-permission-admin.mjs --staff-id <staffId> --line-user-id <lineUserId> --line-channel-id <channelId> --app-origin <publicOrigin>`. Run with `node`; the default is a read-only identity check. Add `--apply` only after verifying the requested identity. The script verifies both SQLite and DynamoDB links, creates missing session configuration without printing secrets, backs up SQLite into ignored `.backups/`, and grants all four permissions only to that employee. `--configure-only --apply` prepares authentication configuration without granting permissions before a first deployment.

Admin grants live in SQLite and are not overridden by environment variables. The permission API prevents removing the last Admin. Only Admin users may change LINE account links. Other linked employees start with Access and View permissions; Edit and Admin must be granted explicitly. Existing users must sign in through LINE again after the first permission deployment.

Security rules:

- Never commit `.env`, `.env.local`, access keys, private keys, or downloaded server keys
- Never commit uploaded documents
- Never commit local scratch scripts containing credentials
- Rotate AWS keys immediately if a key is accidentally committed or exposed

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run a production build locally:

```bash
npm run build -- --webpack
```

## Production Deployment

The production server is deployed only from the `folktsn/Orbit-P` repository.

Recommended deploy command on the server:

```bash
cd /home/ubuntu/orbit-p-folktsn
./scripts/deploy-production.sh
```

The deploy script performs:

1. Fetch latest `origin/main`
2. Fast-forward pull
3. Install dependencies only when `package-lock.json` changes
4. Build with Webpack
5. Remove `.next/cache` to save disk space
6. Restart PM2 app `orbit-p`
7. Check `/` responds and `/api/employees` rejects unauthenticated requests with HTTP 401

Manual PM2 checks:

```bash
pm2 list
pm2 describe orbit-p
pm2 logs orbit-p --lines 100
```

Manual health checks:

```bash
curl -I http://127.0.0.1:3000/
curl -I https://orbithire.pattayaaviation.com/
curl -sS http://127.0.0.1:3000/api/employees >/dev/null
```

## GitHub Actions

The repository contains a GitHub Actions deployment workflow in:

```text
.github/workflows/deploy.yml
```

The workflow expects SSH secrets to be configured in GitHub:

- `SSH_HOST`
- `SSH_USERNAME`
- `SSH_PRIVATE_KEY`
- `SSH_PORT` optional

The workflow deploys by running the production deploy script on the server. Do
not enable a production workflow in the legacy repository.

## Server Disk Notes

The production EC2/EBS disk is small and has previously reached high usage.

Current recommended improvement:

- Increase the EC2/EBS volume to at least `20GB`

Important:

- The app can currently run after cache cleanup
- Build cache is removed automatically after deployment
- Uploaded employee documents are stored in S3 and must not be deleted from the server manually
- Do not remove `.env`, `.env.local`, `node_modules`, `.next/server`, `.next/static`, or PM2 files unless you know the deployment impact

## Useful Paths

Local workspace:

```text
C:\New folder\Project
```

Production app:

```text
/home/ubuntu/orbit-p-folktsn
```

Legacy production folder kept for rollback/reference:

```text
/home/ubuntu/orbit-p
```

Deploy script:

```text
scripts/deploy-production.sh
```

## Troubleshooting

### Website opens but data is missing

Check the employee API:

```bash
curl -sS http://127.0.0.1:3000/api/employees >/dev/null
```

Then check AWS environment values on the server.

### Build fails on the server

Check disk first:

```bash
df -h /
```

Then run:

```bash
cd /home/ubuntu/orbit-p-folktsn
npm run build -- --webpack
```

### PM2 is online but the site does not respond

Check logs:

```bash
pm2 logs orbit-p --lines 100
```

Restart:

```bash
pm2 restart orbit-p --update-env
```

### Document view/download fails

Check:

- The DynamoDB employee record has the correct S3 key
- The S3 object exists in the configured bucket
- The key is under an allowed attachment prefix
- AWS credentials on the server have S3 read/write permission

## Repository Notes

This project was migrated from the previous Pattaya Aviation GitHub remote to:

```text
https://github.com/folktsn/Orbit-P
```

The current `origin` should be:

```bash
git remote -v
```

Expected:

```text
origin  https://github.com/folktsn/Orbit-P.git (fetch)
origin  https://github.com/folktsn/Orbit-P.git (push)
```
