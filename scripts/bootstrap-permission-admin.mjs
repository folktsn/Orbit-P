import { parseArgs } from 'node:util';
import { randomBytes } from 'node:crypto';
import { appendFile, chmod, mkdir } from 'node:fs/promises';
import path from 'node:path';
import nextEnv from '@next/env';
import Database from 'better-sqlite3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const { values } = parseArgs({
  options: {
    'staff-id': { type: 'string' },
    'line-user-id': { type: 'string' },
    'line-channel-id': { type: 'string' },
    'configure-only': { type: 'boolean', default: false },
    apply: { type: 'boolean', default: false },
  },
});
const staffId = values['staff-id'];
const lineUserId = values['line-user-id'];
const channelId = values['line-channel-id'];
if (!/^\d{5}$/.test(staffId || '') || !/^U[0-9a-f]{32}$/.test(lineUserId || '') || !/^\d+$/.test(channelId || '')) {
  throw new Error('Provide --staff-id, --line-user-id and --line-channel-id. Use --apply only after reviewing the identity.');
}

nextEnv.loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
if (!databaseUrl.startsWith('file:')) throw new Error('This bootstrap supports the configured SQLite database only.');
const databasePath = path.resolve(databaseUrl.slice(5));
const database = new Database(databasePath, { readonly: true });
const mapping = database.prepare('SELECT staffId, status FROM LineWebhook WHERE lineUserId = ?').get(lineUserId);
if (mapping?.staffId !== staffId || mapping.status !== 'Linked') throw new Error('LINE mapping does not match the requested active staff link.');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-southeast-7',
}));
const { Item: employee } = await client.send(new GetCommand({
  TableName: 'fullstaff',
  Key: { staff_id: staffId },
  ConsistentRead: true,
}));
const meaningful = (value) => !['', '-', 'null', 'undefined'].includes(String(value ?? '').trim().toLowerCase());
if (!employee || employee.line_user_id !== lineUserId || String(employee.status).toLowerCase() !== 'active' ||
    [employee.resign_date, employee.last_working_date, employee.last_work_date, employee.separation_date].some(meaningful)) {
  throw new Error('Employee record does not match the requested active LINE identity. No permissions changed.');
}
const displayName = [employee.first_name_en, employee.last_name_en].filter(Boolean).join(' ');
const existingChannel = process.env.LINE_LOGIN_CHANNEL_ID || process.env.LINE_CHANNEL_ID;
if (existingChannel && existingChannel !== channelId) throw new Error('Configured LINE channel differs from the requested channel.');
console.log(JSON.stringify({ verified: true, staffId, displayName, configureOnly: values['configure-only'], apply: values.apply }));

if (values.apply) {
  const additions = [];
  if (!process.env.AUTH_SESSION_SECRET) additions.push(`AUTH_SESSION_SECRET=${randomBytes(48).toString('base64url')}`);
  if (!process.env.LINE_LOGIN_CHANNEL_ID) additions.push(`LINE_LOGIN_CHANNEL_ID=${channelId}`);
  if (additions.length) {
    const configPath = path.resolve('.env.local');
    await appendFile(configPath, `\n${additions.join('\n')}\n`, { mode: 0o600 });
    await chmod(configPath, 0o600);
    console.log('Authentication configuration saved; secret values are not printed.');
  }
  if (!values['configure-only']) {
    const backupDir = path.resolve('.backups');
    await mkdir(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `before-admin-${Date.now()}.db`);
    await database.backup(backupPath);
    await chmod(backupPath, 0o600);

    const { PrismaClient } = await import('@prisma/client');
    const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
    try {
      const permissions = { accessPermission: true, viewPermission: true, editPermission: true, adminPermission: true };
      const grant = await prisma.permissionGrant.upsert({
        where: { staffId },
        create: { staffId, ...permissions, updatedById: 'bootstrap', updatedByName: 'Authorized administrator bootstrap' },
        update: { ...permissions, updatedById: 'bootstrap', updatedByName: 'Authorized administrator bootstrap' },
      });
      console.log(JSON.stringify({ staffId: grant.staffId, permissions, updatedAt: grant.updatedAt, backupPath }));
    } finally {
      await prisma.$disconnect();
    }
  }
}
database.close();
client.destroy();
