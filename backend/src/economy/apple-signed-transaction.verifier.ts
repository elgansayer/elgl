import { BadRequestException } from '@nestjs/common';
import { X509Certificate, verify as verifySignature } from 'crypto';

/**
 * Apple Root CA - G3, the trust anchor for App Store Server API signed
 * transactions. Verified fingerprint (SHA-256):
 * 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
 */
export const APPLE_ROOT_CA_G3_PEM = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

const MAX_SIGNED_TRANSACTION_LENGTH = 64 * 1024;
const MAX_CERTIFICATE_BYTES = 16 * 1024;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const APPLE_EPOCH_MS = Date.UTC(2010, 0, 1);
const IOS_PLATFORM = 'ios' as const;

export interface AppleSignedTransactionOptions {
  bundleId?: string;
  nodeEnv?: string;
  trustAnchors?: string[];
  now?: Date;
}

export interface VerifiedAppleSignedTransaction {
  valid: true;
  productId: string;
  transactionId: string;
  platform: typeof IOS_PLATFORM;
  quantity: number;
}

interface AppleSignedTransactionHeader {
  alg?: unknown;
  x5c?: unknown;
}

interface AppleSignedTransactionPayload {
  bundleId?: unknown;
  productId?: unknown;
  transactionId?: unknown;
  quantity?: unknown;
  purchaseDate?: unknown;
  signedDate?: unknown;
  environment?: unknown;
  type?: unknown;
  inAppOwnershipType?: unknown;
  revocationDate?: unknown;
}

/**
 * Signed transactions produced by StoreKit 2 are compact JWS values
 * (`header.payload.signature`). Legacy App Store receipts are base64 blobs, so
 * the three-segment shape is a safe discriminator before any parsing.
 */
export function isAppleSignedTransaction(token: string): boolean {
  return (
    token.length > 0 &&
    token.length <= MAX_SIGNED_TRANSACTION_LENGTH &&
    token.split('.').length === 3
  );
}

/**
 * Verifies an App Store Server API signed transaction end to end:
 * certificate chain to the pinned Apple root, ES256 JWS signature, certificate
 * validity window, bundle ID, environment, consumable type and purchase claims.
 *
 * `trustAnchors` exists so the verifier can be tested with a generated chain;
 * production callers must omit it and use the pinned Apple root.
 */
export function verifyAppleSignedTransaction(
  signedTransaction: string,
  options: AppleSignedTransactionOptions = {},
): VerifiedAppleSignedTransaction {
  const segments = signedTransaction.split('.');
  if (segments.length !== 3) {
    throw new BadRequestException(
      'Apple signed transaction is not compact JWS',
    );
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = parseJson<AppleSignedTransactionHeader>(
    decodeBase64Url(encodedHeader, 'header'),
    'header',
  );
  if (header.alg !== 'ES256') {
    throw new BadRequestException('Apple signed transaction must use ES256');
  }

  const certificateChain = readCertificateChain(header.x5c);
  const now = options.now ?? new Date();
  validateCertificateChain(certificateChain, options.trustAnchors, now);

  const signature = decodeBase64Url(encodedSignature, 'signature');
  if (signature.length !== 64) {
    throw new BadRequestException(
      'Apple signed transaction signature has an invalid length',
    );
  }

  const signingInput = Buffer.from(
    `${encodedHeader}.${encodedPayload}`,
    'ascii',
  );
  let signatureValid: boolean;
  try {
    signatureValid = verifySignature(
      'sha256',
      signingInput,
      { key: certificateChain[0].publicKey, dsaEncoding: 'ieee-p1363' },
      signature,
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    throw new BadRequestException(
      'Apple signed transaction signature is invalid',
    );
  }

  const payload = parseJson<AppleSignedTransactionPayload>(
    decodeBase64Url(encodedPayload, 'payload'),
    'payload',
  );

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const nowMs = now.getTime();

  if (payload.revocationDate !== undefined && payload.revocationDate !== null) {
    throw new BadRequestException('Apple signed transaction has been revoked');
  }

  const environment = payload.environment;
  if (environment !== 'Production' && environment !== 'Sandbox') {
    throw new BadRequestException(
      'Apple signed transaction has an unknown environment',
    );
  }
  if (isProduction && environment === 'Sandbox') {
    throw new BadRequestException(
      'Apple sandbox transactions are not accepted in production',
    );
  }

  if (payload.type !== undefined && payload.type !== 'Consumable') {
    throw new BadRequestException(
      'Apple signed transaction is not a consumable purchase',
    );
  }
  if (
    payload.inAppOwnershipType !== undefined &&
    payload.inAppOwnershipType !== 'PURCHASED'
  ) {
    throw new BadRequestException(
      'Apple signed transaction is not owned by the purchaser',
    );
  }

  const bundleId = payload.bundleId;
  if (typeof bundleId !== 'string' || bundleId.length === 0) {
    throw new BadRequestException(
      'Apple signed transaction is missing its bundle ID',
    );
  }
  if (!options.bundleId) {
    if (isProduction) {
      throw new BadRequestException('Apple bundle ID not configured');
    }
  } else if (bundleId !== options.bundleId) {
    throw new BadRequestException('Apple bundle ID mismatch');
  }

  const productId = readBoundedIdentifier(payload.productId, 'product');
  const transactionId = readBoundedIdentifier(
    payload.transactionId,
    'transaction',
  );

  const quantity = payload.quantity;
  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100
  ) {
    throw new BadRequestException(
      'Apple signed transaction has an invalid quantity',
    );
  }

  const purchaseDate = readTimestamp(payload.purchaseDate, 'purchase date');
  if (purchaseDate < APPLE_EPOCH_MS || purchaseDate > nowMs + CLOCK_SKEW_MS) {
    throw new BadRequestException(
      'Apple signed transaction has an invalid purchase date',
    );
  }
  if (payload.signedDate !== undefined) {
    const signedDate = readTimestamp(payload.signedDate, 'signed date');
    if (signedDate > nowMs + CLOCK_SKEW_MS) {
      throw new BadRequestException(
        'Apple signed transaction was signed in the future',
      );
    }
  }

  return {
    valid: true,
    productId,
    transactionId,
    platform: IOS_PLATFORM,
    quantity,
  };
}

function decodeBase64Url(segment: string, label: string): Buffer {
  if (!segment || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new BadRequestException(
      `Apple signed transaction ${label} is not base64url`,
    );
  }
  return Buffer.from(segment, 'base64url');
}

function parseJson<T>(buffer: Buffer, label: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new BadRequestException(
      `Apple signed transaction ${label} is not valid JSON`,
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestException(
      `Apple signed transaction ${label} is not an object`,
    );
  }
  return parsed as T;
}

function readCertificateChain(value: unknown): X509Certificate[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 4) {
    throw new BadRequestException(
      'Apple signed transaction has an invalid certificate chain',
    );
  }
  return value.map((entry) => {
    if (typeof entry !== 'string' || entry.length === 0) {
      throw new BadRequestException(
        'Apple signed transaction has an invalid certificate chain',
      );
    }
    const der = Buffer.from(entry, 'base64');
    if (der.length === 0 || der.length > MAX_CERTIFICATE_BYTES) {
      throw new BadRequestException(
        'Apple signed transaction has an invalid certificate chain',
      );
    }
    try {
      return new X509Certificate(der);
    } catch {
      throw new BadRequestException(
        'Apple signed transaction has an invalid certificate chain',
      );
    }
  });
}

function validateCertificateChain(
  chain: X509Certificate[],
  trustAnchors: string[] | undefined,
  now: Date,
): void {
  const nowMs = now.getTime();
  for (const certificate of chain) {
    if (
      nowMs < Date.parse(certificate.validFrom) ||
      nowMs > Date.parse(certificate.validTo)
    ) {
      throw new BadRequestException(
        'Apple signed transaction certificate is not currently valid',
      );
    }
  }

  if (chain[0].ca) {
    throw new BadRequestException(
      'Apple signed transaction leaf certificate must not be a CA',
    );
  }

  for (let index = 0; index < chain.length - 1; index += 1) {
    const certificate = chain[index];
    const issuer = chain[index + 1];
    if (!issuer.ca || !certificate.checkIssued(issuer)) {
      throw new BadRequestException(
        'Apple signed transaction certificate chain is not contiguous',
      );
    }
    let issuedByChain: boolean;
    try {
      issuedByChain = certificate.verify(issuer.publicKey);
    } catch {
      issuedByChain = false;
    }
    if (!issuedByChain) {
      throw new BadRequestException(
        'Apple signed transaction certificate chain signature is invalid',
      );
    }
  }

  const anchors = trustAnchors?.length ? trustAnchors : [APPLE_ROOT_CA_G3_PEM];
  const last = chain[chain.length - 1];
  const anchored = anchors.some((anchor) => {
    let anchorCertificate: X509Certificate;
    try {
      anchorCertificate = new X509Certificate(anchor);
    } catch {
      return false;
    }
    if (last.fingerprint256 === anchorCertificate.fingerprint256) {
      return true;
    }
    if (!last.checkIssued(anchorCertificate)) {
      return false;
    }
    try {
      return last.verify(anchorCertificate.publicKey);
    } catch {
      return false;
    }
  });
  if (!anchored) {
    throw new BadRequestException(
      'Apple signed transaction is not chained to a trusted Apple root',
    );
  }
}

function readBoundedIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) {
    throw new BadRequestException(
      `Apple signed transaction ${label} ID is invalid`,
    );
  }
  return value;
}

function readTimestamp(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(
      `Apple signed transaction ${label} is invalid`,
    );
  }
  return value;
}
