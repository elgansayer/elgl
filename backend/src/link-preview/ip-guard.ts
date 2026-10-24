/**
 * Guards the OpenGraph scraper against Server-Side Request Forgery (SSRF)
 * by rejecting connections to private, loopback, link-local and reserved
 * IP addresses before the HTTP request is sent.
 */

const IPV4_OCTET = /^\d{1,3}$/;

function isIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!IPV4_OCTET.test(part)) {
      return false;
    }
    const octet = Number(part);
    return octet >= 0 && octet <= 255;
  });
}

function isPrivateIpv4(ip: string): boolean {
  if (!isIpv4(ip)) {
    return false;
  }
  const [first, second] = ip.split('.').map(Number);
  if (first === 0) {
    // 0.0.0.0/8: "this network" and the unspecified address
    return true;
  }
  if (first === 10) {
    // 10.0.0.0/8: private network
    return true;
  }
  if (first === 127) {
    // 127.0.0.0/8: loopback
    return true;
  }
  if (first === 100 && second >= 64 && second <= 127) {
    // 100.64.0.0/10: carrier-grade NAT
    return true;
  }
  if (first === 169 && second === 254) {
    // 169.254.0.0/16: link-local (including cloud metadata)
    return true;
  }
  if (first === 172 && second >= 16 && second <= 31) {
    // 172.16.0.0/12: private network
    return true;
  }
  if (first === 192 && second === 168) {
    // 192.168.0.0/16: private network
    return true;
  }
  if (first === 192 && second === 0) {
    // 192.0.0.0/24: IETF protocol assignments
    return true;
  }
  if (first === 198 && (second === 18 || second === 19)) {
    // 198.18.0.0/15: network benchmarking
    return true;
  }
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::') {
    // Unspecified address
    return true;
  }
  if (lower === '::1') {
    // Loopback
    return true;
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) {
    // fc00::/7: unique local addresses
    return true;
  }
  if (
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) {
    // fe80::/10: link-local addresses
    return true;
  }
  if (
    lower.startsWith('fec') ||
    lower.startsWith('fed') ||
    lower.startsWith('fee') ||
    lower.startsWith('fef')
  ) {
    // fec0::/10: deprecated site-local addresses, never publicly routable
    return true;
  }
  return false;
}

/**
 * Returns true when the supplied IP address is private, loopback,
 * link-local or otherwise unsafe to connect to from the scraper.
 */
export function isPrivateIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized.includes(':')) {
    if (normalized.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 addresses are evaluated using the embedded IPv4.
      return isPrivateIpv4(normalized.substring(7));
    }
    return isPrivateIpv6(normalized);
  }
  return isPrivateIpv4(normalized);
}
