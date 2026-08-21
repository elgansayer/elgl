import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminRoot = path.join(root, 'backend/src/admin');
const moduleSource = fs.readFileSync(path.join(adminRoot, 'admin.module.ts'), 'utf8');
const auditSource = fs.readFileSync(path.join(adminRoot, 'admin-audit.service.ts'), 'utf8');
const errors = [];

for (const required of [
  'APP_INTERCEPTOR',
  'AdminMutationAuditInterceptor',
  'AdminCapabilityGuard',
  'AdminGuard',
]) {
  if (!moduleSource.includes(required)) {
    errors.push(`admin.module.ts is missing security provider ${required}`);
  }
}

for (const required of [
  "from('admin_audit_events').insert",
  'sanitizeMetadata',
  'normalizeAdminOperatorNote',
  'correlation_id',
]) {
  if (!auditSource.includes(required)) {
    errors.push(`admin audit service is missing immutable/bounded audit contract ${required}`);
  }
}

const controllerFiles = fs
  .readdirSync(adminRoot)
  .filter((name) => name.endsWith('.controller.ts'));

for (const name of controllerFiles) {
  const source = fs.readFileSync(path.join(adminRoot, name), 'utf8');
  const guardDecorators = [...source.matchAll(/@UseGuards\(([^)]*)\)/gs)].map((match) => match[1]);
  const controllerGuardSet = guardDecorators.find(
    (guards) => guards.includes('SupabaseAuthGuard') && guards.includes('AdminGuard'),
  );
  if (!controllerGuardSet) {
    errors.push(`${name}: every admin controller must require SupabaseAuthGuard + AdminGuard`);
  }

  const classHasCapabilityGuard = guardDecorators.some((guards) =>
    guards.includes('AdminCapabilityGuard'),
  );
  const classCapabilityIndex = source.indexOf('@RequireAdminCapabilities(');
  const classDeclarationIndex = source.indexOf('export class ');
  const classHasCapabilityRequirement =
    classCapabilityIndex >= 0 &&
    classDeclarationIndex >= 0 &&
    classCapabilityIndex < classDeclarationIndex;

  const mutationDecorator = /@(Post|Patch|Put|Delete)\([^\n]*\)/g;
  for (const match of source.matchAll(mutationDecorator)) {
    const start = match.index ?? 0;
    const block = source.slice(start, start + 1200);
    if (!classHasCapabilityGuard && !block.includes('@UseGuards(AdminCapabilityGuard)')) {
      errors.push(`${name}: ${match[0]} is missing AdminCapabilityGuard`);
    }
    if (!classHasCapabilityRequirement && !block.includes('@RequireAdminCapabilities(')) {
      errors.push(`${name}: ${match[0]} is missing an explicit capability requirement`);
    }
    if (!block.includes('@Throttle(')) {
      errors.push(`${name}: ${match[0]} is missing a mutation rate limit`);
    }
  }
}

const interceptor = fs.readFileSync(
  path.join(adminRoot, 'admin-mutation-audit.interceptor.ts'),
  'utf8',
);
for (const required of [
  'SAFE_METHODS',
  "requestPath.includes('/admin')",
  "record('success')",
  "record('failed')",
  'capabilityKey',
  'targetId',
  'correlationId',
]) {
  if (!interceptor.includes(required)) {
    errors.push(`admin mutation audit interceptor is missing ${required}`);
  }
}
if (/request\.body|JSON\.stringify\(request/.test(interceptor)) {
  errors.push('admin mutation audit interceptor must not persist request bodies');
}

if (errors.length) {
  console.error('Admin security contract failed:\n' + errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Admin security contract passed for ${controllerFiles.length} controllers.`);
