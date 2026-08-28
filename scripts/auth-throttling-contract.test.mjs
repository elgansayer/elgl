import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function methodPreamble(source, methodName) {
  const methodPattern = new RegExp(`\\basync\\s+${methodName}\\s*\\(`);
  const match = methodPattern.exec(source);
  assert.ok(match, `Expected async method ${methodName} to exist`);

  const start = source.lastIndexOf('\n\n', match.index);
  return source.slice(start < 0 ? 0 : start, match.index);
}

function assertThrottleConfig(source, { limit, ttl }, context) {
  const match =
    /@Throttle\(\{\s*default:\s*\{([\s\S]*?)\}\s*,?\s*\}\s*\)/.exec(
      source,
    );

  assert.ok(match, `${context} must retain an @Throttle default configuration`);
  assert.match(
    match[1],
    new RegExp(`\\blimit:\\s*${limit}\\b`),
    `${context} must retain a limit of ${limit} requests`,
  );
  assert.match(
    match[1],
    new RegExp(`\\bttl:\\s*${ttl}\\b`),
    `${context} must retain a ${ttl}ms throttle window`,
  );
}

function assertThrottledMethod({ file, method, route, limit, ttl }) {
  const source = read(file);
  const preamble = methodPreamble(source, method);
  const context = `${file}:${method}`;

  assert.ok(preamble.includes(route), `${context} must retain ${route}`);
  assertThrottleConfig(preamble, { limit, ttl }, context);
}

const sensitiveRoutes = [
  {
    file: 'backend/src/auth/auth.controller.ts',
    method: 'changePassword',
    route: "@Post('change-password')",
    limit: 3,
    ttl: 60000,
  },
  {
    file: 'backend/src/auth/auth.controller.ts',
    method: 'enableTwoFactor',
    route: "@Post('two-factor/enable')",
    limit: 5,
    ttl: 300000,
  },
  {
    file: 'backend/src/auth/auth.controller.ts',
    method: 'verifyTwoFactor',
    route: "@Post('two-factor/verify')",
    limit: 5,
    ttl: 60000,
  },
  {
    file: 'backend/src/auth/auth.controller.ts',
    method: 'disableTwoFactor',
    route: "@Post('two-factor/disable')",
    limit: 3,
    ttl: 60000,
  },
  {
    file: 'backend/src/auth/auth.controller.ts',
    method: 'generateTransferLink',
    route: "@Post('transfer/generate')",
    limit: 5,
    ttl: 60000,
  },
  {
    file: 'backend/src/auth/auth.controller.ts',
    method: 'consumeTransferLink',
    route: "@Post('transfer/consume')",
    limit: 5,
    ttl: 60000,
  },
  {
    file: 'backend/src/auth/auth.controller.ts',
    method: 'swapTransferLink',
    route: "@Post('transfer/swap')",
    limit: 5,
    ttl: 60000,
  },
  {
    file: 'backend/src/password-reset/password-reset.controller.ts',
    method: 'requestPasswordReset',
    route: "@Post('request-password-reset')",
    limit: 3,
    ttl: 300000,
  },
  {
    file: 'backend/src/password-reset/password-reset.controller.ts',
    method: 'resetPassword',
    route: "@Post('reset-password')",
    limit: 3,
    ttl: 300000,
  },
  {
    file: 'backend/src/two-factor/two-factor.controller.ts',
    method: 'enable',
    route: "@Post('enable')",
    limit: 3,
    ttl: 60000,
  },
  {
    file: 'backend/src/two-factor/two-factor.controller.ts',
    method: 'verify',
    route: "@Post('verify')",
    limit: 5,
    ttl: 60000,
  },
  {
    file: 'backend/src/two-factor/two-factor.controller.ts',
    method: 'disable',
    route: "@Post('disable')",
    limit: 3,
    ttl: 60000,
  },
  {
    file: 'backend/src/transfer/transfer.controller.ts',
    method: 'generate',
    route: "@Post('generate')",
    limit: 3,
    ttl: 60000,
  },
  {
    file: 'backend/src/transfer/transfer.controller.ts',
    method: 'consume',
    route: "@Get('consume')",
    limit: 10,
    ttl: 60000,
  },
  {
    file: 'backend/src/transfer/transfer.controller.ts',
    method: 'consumePost',
    route: "@Post('consume')",
    limit: 10,
    ttl: 60000,
  },
  {
    file: 'backend/src/transfer/transfer.controller.ts',
    method: 'swap',
    route: "@Post('swap')",
    limit: 5,
    ttl: 60000,
  },
  {
    file: 'backend/src/users/device-link.controller.ts',
    method: 'generate',
    route: '@Post()',
    limit: 3,
    ttl: 60000,
  },
  {
    file: 'backend/src/users/users.controller.ts',
    method: 'deleteMyAccount',
    route: "@Delete('me')",
    limit: 3,
    ttl: 60000,
  },
  {
    file: 'backend/src/users/users.controller.ts',
    method: 'permanentlyDeleteMyAccount',
    route: "@Delete('me/permanent')",
    limit: 2,
    ttl: 300000,
  },
  {
    file: 'backend/src/users/users.controller.ts',
    method: 'restoreMyAccount',
    route: "@Post('me/restore')",
    limit: 3,
    ttl: 60000,
  },
];

test('registers the Nest throttler globally with the repository default', () => {
  const source = read('backend/src/app.module.ts');

  const config = /ThrottlerModule\.forRoot\(\[\s*\{([\s\S]*?)\}\s*,?\s*\]\s*\)/.exec(
    source,
  );
  assert.ok(config, 'AppModule must retain the global ThrottlerModule config');
  assert.match(config[1], /\bttl:\s*60000\b/);
  assert.match(config[1], /\blimit:\s*10\b/);
  assert.match(
    source,
    /provide:\s*APP_GUARD,[\s\S]{0,120}useClass:\s*ThrottlerGuard/,
  );
});

test('keeps endpoint-specific throttles on sensitive authentication and account lifecycle routes', () => {
  for (const contract of sensitiveRoutes) {
    assertThrottledMethod(contract);
  }
});

test('documents the executable throttling verification command', () => {
  const docs = read('docs/api-auth-throttling.md');
  assert.match(
    docs,
    /node --test scripts\/auth-throttling-contract\.test\.mjs/,
  );
  assert.match(docs, /global `APP_GUARD`/);
});
