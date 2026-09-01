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
7. Run health checks against `/` and `/api/employees`

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
