import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  'supabase/migrations/20260816015400_admin_audit_immutable_trigger.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

const requiredFragments = [
  'create or replace function public.prevent_admin_audit_event_mutation()',
  "raise exception 'admin_audit_events is append-only'",
  "using errcode = '42501'",
  'revoke all on function public.prevent_admin_audit_event_mutation() from public, anon, authenticated',
  'create trigger admin_audit_events_append_only',
  'before update or delete on public.admin_audit_events',
  'for each row',
  'execute function public.prevent_admin_audit_event_mutation()',
];

const missing = requiredFragments.filter((fragment) => !sql.includes(fragment));
if (missing.length > 0) {
  console.error('Admin audit append-only integrity check failed. Missing:');
  for (const fragment of missing) console.error(`- ${fragment}`);
  process.exit(1);
}

if (/\b(after|instead of)\s+update\s+or\s+delete\b/.test(sql)) {
  console.error('Admin audit mutation protection must run BEFORE update/delete.');
  process.exit(1);
}

console.log('Admin audit append-only database invariant is present.');
