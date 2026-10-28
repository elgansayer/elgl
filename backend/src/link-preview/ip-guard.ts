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

function parseIpv6Words(value: string): number[] | null {
  let normalized = value.toLowerCase();
  const zoneIndex = normalized.indexOf('%');
  if (zoneIndex >= 0) {
    normalized = normalized.slice(0, zoneIndex);
  }

  const lastColon = normalized.lastIndexOf(':');
  const ipv4Tail = normalized.slice(lastColon + 1);
  if (ipv4Tail.includes('.')) {
    if (!isIpv4(ipv4Tail)) {
      return null;
    }
    const octets = ipv4Tail.split('.').map(Number);
    const high = ((octets[0] ?? 0) << 8) | (octets[1] ?? 0);
    const low = ((octets[2] ?? 0) << 8) | (octets[3] ?? 0);
    normalized = `${normalized.slice(0, lastColon)}:${high.toString(16)}:${low.toString(16)}`;
  }

  const halves = normalized.split('::');
  if (halves.length > 2) {
    return null;
  }

  const parseHalf = (half: string): number[] | null => {
    if (!half) {
      return [];
    }
    const parts = half.split(':');
    if (parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) {
      return null;
    }
    return parts.map((part) => Number.parseInt(part, 16));
  };

  const left = parseHalf(halves[0] ?? '');
  const right = parseHalf(halves[1] ?? '');
  if (!left || !right) {
    return null;
  }

  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }

  const missingWords = 8 - left.length - right.length;
  if (missingWords < 1) {
    return null;
  }
  return [...left, ...Array<number>(missingWords).fill(0), ...right];
}

function isPrivateIpv4(ip: string): boolean {
  if (!isIpv4(ip)) {
    return false;
  }
  const [first, second, third] = ip.split('.').map(Number);
  if (first >= 224) {
    // 224.0.0.0/4 multicast and 240.0.0.0/4 reserved (including the
    // 255.255.255.255 limited broadcast address)
    return true;
  }
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
  if (first === 192 && second === 0 && (third === 0 || third === 2)) {
    // 192.0.0.0/24: IETF protocol assignments; 192.0.2.0/24: TEST-NET-1.
    // The rest of 192.0.0.0/16 is ordinary public space (for example
    // WordPress.com in 192.0.64.0/18) and must stay reachable.
    return true;
  }
  if (first === 198 && (second === 18 || second === 19)) {
    // 198.18.0.0/15: network benchmarking
    return true;
  }
  if (first === 198 && second === 51 && third === 100) {
    // 198.51.100.0/24: TEST-NET-2
    return true;
  }
  if (first === 203 && second === 0 && third === 113) {
    // 203.0.113.0/24: TEST-NET-3
    return true;
  }
  return false;
}

/**
 * Checks an IPv4 address that an IPv6 prefix embeds as two 16-bit words, so
 * address-translation prefixes cannot smuggle a private IPv4 destination past
 * the guard.
 */
function isEmbeddedIpv4Private(high: number, low: number): boolean {
  return isPrivateIpv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
}

function isPrivateIpv6(ip: string): boolean {
  const words = parseIpv6Words(ip);
  if (!words) {
    return false;
  }

  const isIpv4Mapped =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  const isIpv4Compatible = words.slice(0, 6).every((word) => word === 0);
  // ::ffff:0:0/96 (SIIT): IPv4-translated addresses, e.g. ::ffff:0:7f00:1
  const isIpv4Translated =
    words.slice(0, 4).every((word) => word === 0) &&
    words[4] === 0xffff &&
    words[5] === 0;
  if (isIpv4Mapped || isIpv4Compatible || isIpv4Translated) {
    return isEmbeddedIpv4Private(words[6] ?? 0, words[7] ?? 0);
  }

  const first = words[0] ?? 0;
  const second = words[1] ?? 0;
  if ((first & 0xfe00) === 0xfc00) {
    // fc00::/7: unique local addresses
    return true;
  }
  if ((first & 0xffc0) === 0xfe80) {
    // fe80::/10: link-local addresses
    return true;
  }
  if ((first & 0xffc0) === 0xfec0) {
    // fec0::/10: deprecated site-local addresses, never publicly routable
    return true;
  }
  if ((first & 0xff00) === 0xff00) {
    // ff00::/8: multicast
    return true;
  }
  if (first === 0x64 && second === 0xff9b) {
    // 64:ff9b:1::/48 is local-use NAT64; the well-known 64:ff9b::/96 prefix
    // translates to the IPv4 address in its last 32 bits, so a private IPv4
    // destination stays private when reached through a NAT64 gateway.
    if (words[2] === 1) {
      return true;
    }
    if (words.slice(2, 6).every((word) => word === 0)) {
      return isEmbeddedIpv4Private(words[6] ?? 0, words[7] ?? 0);
    }
  }
  if (first === 0x2002) {
    // 2002::/16: 6to4 embeds the IPv4 address in the next 32 bits
    return isEmbeddedIpv4Private(second, words[2] ?? 0);
  }
  if (first === 0x2001 && second === 0) {
    // 2001::/32: Teredo tunnelling, whose embedded addresses are obfuscated
    return true;
  }
  if (first === 0x100 && words.slice(1, 4).every((word) => word === 0)) {
    // 100::/64: discard-only prefix
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
    return isPrivateIpv6(normalized);
  }
  return isPrivateIpv4(normalized);
}
