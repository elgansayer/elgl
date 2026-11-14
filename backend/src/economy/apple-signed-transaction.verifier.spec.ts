import { readFileSync } from 'fs';
import { join } from 'path';
import { X509Certificate, createPrivateKey, sign } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  APPLE_ROOT_CA_G3_PEM,
  isAppleSignedTransaction,
  verifyAppleSignedTransaction,
} from './apple-signed-transaction.verifier';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, '__fixtures__/apple-jws', name), 'utf8');

const leafCertificate = new X509Certificate(fixture('leaf.pem'));
const intermediateCertificate = new X509Certificate(
  fixture('intermediate.pem'),
);
const rootCertificate = new X509Certificate(fixture('root.pem'));
const leafKey = createPrivateKey(fixture('leaf.key'));
const testTrustAnchors = [fixture('root.pem')];
const x5c = [
  leafCertificate.raw.toString('base64'),
  intermediateCertificate.raw.toString('base64'),
  rootCertificate.raw.toString('base64'),
];

const basePayload = {
  bundleId: 'com.hellotalk.app',
  productId: 'com.linguaexchange.coins.small',
  transactionId: '2000000123456789',
  originalTransactionId: '2000000123456789',
  quantity: 1,
  purchaseDate: Date.UTC(2026, 10, 14, 15, 0, 0),
  signedDate: Date.UTC(2026, 10, 14, 15, 0, 1),
  environment: 'Production',
  type: 'Consumable',
  inAppOwnershipType: 'PURCHASED',
};

function signedTransaction(
  payload: Record<string, unknown> = basePayload,
  header: Record<string, unknown> = { alg: 'ES256', x5c },
): string {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    'base64url',
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );
  const signature = sign(
    'sha256',
    Buffer.from(`${encodedHeader}.${encodedPayload}`, 'ascii'),
    { key: leafKey, dsaEncoding: 'ieee-p1363' },
  );
  return `${encodedHeader}.${encodedPayload}.${signature.toString('base64url')}`;
}

const options = {
  bundleId: 'com.hellotalk.app',
  nodeEnv: 'production',
  trustAnchors: testTrustAnchors,
  now: new Date(Date.UTC(2026, 10, 14, 15, 5, 0)),
};

describe('verifyAppleSignedTransaction', () => {
  it('accepts a correctly signed consumable transaction', () => {
    expect(verifyAppleSignedTransaction(signedTransaction(), options)).toEqual({
      valid: true,
      productId: 'com.linguaexchange.coins.small',
      transactionId: '2000000123456789',
      platform: 'ios',
      quantity: 1,
    });
  });

  it('rejects a tampered payload', () => {
    const token = signedTransaction();
    const [header, , signature] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...basePayload,
        productId: 'com.linguaexchange.coins.large',
      }),
    ).toString('base64url');

    expect(() =>
      verifyAppleSignedTransaction(
        `${header}.${tamperedPayload}.${signature}`,
        options,
      ),
    ).toThrow('Apple signed transaction signature is invalid');
  });

  it('rejects a chain that does not anchor in the trusted root', () => {
    expect(() =>
      verifyAppleSignedTransaction(signedTransaction(), {
        ...options,
        trustAnchors: [APPLE_ROOT_CA_G3_PEM],
      }),
    ).toThrow('not chained to a trusted Apple root');
  });

  it('rejects a mismatched bundle ID', () => {
    expect(() =>
      verifyAppleSignedTransaction(signedTransaction(), {
        ...options,
        bundleId: 'com.example.other',
      }),
    ).toThrow('Apple bundle ID mismatch');
  });

  it('rejects a sandbox transaction in production but accepts it in development', () => {
    const token = signedTransaction({ ...basePayload, environment: 'Sandbox' });

    expect(() => verifyAppleSignedTransaction(token, options)).toThrow(
      'Apple sandbox transactions are not accepted in production',
    );
    expect(
      verifyAppleSignedTransaction(token, {
        ...options,
        nodeEnv: 'development',
      }).valid,
    ).toBe(true);
  });

  it('rejects revoked transactions', () => {
    expect(() =>
      verifyAppleSignedTransaction(
        signedTransaction({
          ...basePayload,
          revocationDate: Date.UTC(2026, 10, 14, 15, 1, 0),
        }),
        options,
      ),
    ).toThrow('has been revoked');
  });

  it('rejects non-consumable and family-shared transactions', () => {
    expect(() =>
      verifyAppleSignedTransaction(
        signedTransaction({
          ...basePayload,
          type: 'Auto-Renewable Subscription',
        }),
        options,
      ),
    ).toThrow('not a consumable purchase');

    expect(() =>
      verifyAppleSignedTransaction(
        signedTransaction({
          ...basePayload,
          inAppOwnershipType: 'FAMILY_SHARED',
        }),
        options,
      ),
    ).toThrow('not owned by the purchaser');
  });

  it('rejects a header without an ES256 algorithm or certificate chain', () => {
    expect(() =>
      verifyAppleSignedTransaction(
        signedTransaction(basePayload, { alg: 'HS256', x5c }),
        options,
      ),
    ).toThrow('must use ES256');

    expect(() =>
      verifyAppleSignedTransaction(
        signedTransaction(basePayload, { alg: 'ES256' }),
        options,
      ),
    ).toThrow('invalid certificate chain');
  });

  it('rejects future purchase timestamps outside the clock skew', () => {
    expect(() =>
      verifyAppleSignedTransaction(
        signedTransaction({
          ...basePayload,
          purchaseDate: options.now.getTime() + 10 * 60 * 1000,
        }),
        options,
      ),
    ).toThrow('invalid purchase date');
  });

  it('detects compact JWS receipt tokens', () => {
    expect(isAppleSignedTransaction(signedTransaction())).toBe(true);
    expect(isAppleSignedTransaction('base64receiptdata')).toBe(false);
    expect(isAppleSignedTransaction('a.b')).toBe(false);
  });
});
