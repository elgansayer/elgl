import { timingSafeEqual } from 'crypto';

const INSECURE_PASSWORDS = new Set([
  'changeme',
  'changeme_use_a_strong_password',
]);

export function dashboardCredentials(environment = process.env) {
  const user = environment.DASHBOARD_USER?.trim() || 'admin';
  const password = environment.DASHBOARD_PASSWORD || '';
  const normalisedPassword = password.trim().toLowerCase();

  if (password.trim().length < 16 || INSECURE_PASSWORDS.has(normalisedPassword)) {
    throw new Error(
      'DASHBOARD_PASSWORD must be set to a non-placeholder value of at least 16 characters',
    );
  }

  return { user, password };
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function authorisationMatches(header, credentials) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return false;

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon < 0) return false;

  return (
    safeEqual(decoded.slice(0, colon), credentials.user)
    && safeEqual(decoded.slice(colon + 1), credentials.password)
  );
}
