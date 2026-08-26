import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const source = (path) => readFileSync(resolve(root, path), 'utf8');

test('frontend exposes the password recovery and reset flows through the app client', () => {
  const routes = source('frontend/src/app/routes/auth.routes.ts');
  const component = source('frontend/src/app/components/forgot-password/forgot-password.component.ts');
  const authService = source('frontend/src/app/services/auth.service.ts');

  assert.match(routes, /path: 'forgot-password'/);
  assert.match(routes, /forgot-password\/forgot-password\.component/);
  assert.match(routes, /path: 'reset-password'/);
  assert.match(component, /Validators\.email/);
  assert.match(component, /Validators\.minLength\(8\)/);
  assert.match(component, /size="touch"/);
  assert.match(component, /emailForm\.invalid \|\| isSending\(\)/);
  assert.match(component, /resetForm\.invalid \|\| isResetting\(\)/);
  assert.match(component, /requestPasswordReset\(this\.emailForm\.controls\.email\.value\)/);
  assert.match(component, /resetPassword\(token, this\.resetForm\.controls\.newPassword\.value\)/);
  assert.match(authService, /\/auth\/request-password-reset/);
  assert.match(authService, /\/auth\/reset-password/);
});

test('public request endpoint is rate limited and does not reveal whether an account exists', () => {
  const controller = source('backend/src/password-reset/password-reset.controller.ts');
  const requestDto = source('backend/src/password-reset/dto/request-password-reset.dto.ts');

  assert.match(requestDto, /@IsEmail\(\)/);
  assert.match(controller, /@Post\('request-password-reset'\)/);
  assert.match(controller, /@Throttle\(\{ default: \{ limit: 3, ttl: 300000 \} \}\)/);
  assert.match(controller, /try \{[\s\S]*requestPasswordReset\(dto\)[\s\S]*\} catch \{/);
  assert.match(controller, /If the email address exists, a reset link has been sent\./);
  assert.doesNotMatch(controller, /NotFoundException|email not found|user not found/i);
});

test('reset credentials are bounded, hashed, expiring, single use, and revoked on delivery failure', () => {
  const service = source('backend/src/password-reset/password-reset.service.ts');
  const resetDto = source('backend/src/password-reset/dto/reset-password.dto.ts');

  assert.match(service, /USER_LOOKUP_PAGE_SIZE = 1000/);
  assert.match(service, /MAX_USER_LOOKUP_PAGES = 100/);
  assert.match(service, /crypto\.randomBytes\(32\)\.toString\('hex'\)/);
  assert.match(service, /createHash\('sha256'\)/);
  assert.match(service, /30 \* 60 \* 1000/);
  assert.match(service, /update\(\{ used: true \}\)[\s\S]*\.eq\('user_id', userId\)[\s\S]*\.eq\('used', false\)/);
  assert.match(service, /sendPasswordResetEmail\(dto\.email, token\)/);
  assert.match(service, /Failed to dispatch password reset email/);
  assert.match(service, /\.eq\('token', tokenHash\)/);
  assert.match(service, /\.eq\('used', false\)/);
  assert.match(service, /\.gt\('expires_at', new Date\(\)\.toISOString\(\)\)/);
  assert.match(service, /auth\.admin\.updateUserById/);
  assert.match(resetDto, /@MinLength\(8\)/);
});

test('email dispatch uses configured SMTP metadata and privacy-safe logging', () => {
  const emailService = source('backend/src/email/email.service.ts');

  assert.match(emailService, /nodemailer\.createTransport/);
  assert.match(emailService, /MAIL_HOST/);
  assert.match(emailService, /MAIL_PORT/);
  assert.match(emailService, /MAIL_USER/);
  assert.match(emailService, /MAIL_PASS/);
  assert.match(emailService, /FRONTEND_URL/);
  assert.match(emailService, /\/forgot-password\?token=\$\{token\}/);
  assert.match(emailService, /await this\.transporter\.sendMail/);
  assert.match(emailService, /this\.logger\.log\('Password reset email dispatched'\)/);
  assert.doesNotMatch(emailService, /logger\.(?:log|warn|error)\(`[^`]*\$\{(?:to|token|resetUrl)/i);
  assert.doesNotMatch(emailService, /logger\.(?:log|warn|error)\([^)]*,\s*(?:to|token|resetUrl)/i);
});
