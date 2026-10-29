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
  if (first === 192 && second === 88 && third === 99) {
    // 192.88.99.0/24: 6to4 anycast relay
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
  if (first >= 224) {
    // 224.0.0.0/4: multicast; 240.0.0.0/4: reserved; 255.255.255.255: broadcast
    return true;
  }
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const words = parseIpv6Words(ip);
  if (!words) {
    return false;
  }

  // ::/128: unspecified address
  if (words.every((word) => word === 0)) {
    return true;
  }

  // ::1/128: loopback address
  if (words.slice(0, 7).every((word) => word === 0) && words[7] === 1) {
    return true;
  }

  // ::ffff:0:0/96: IPv4-mapped addresses
  const isIpv4Mapped =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  // ::/96: deprecated IPv4-compatible addresses
  const isIpv4Compatible = words.slice(0, 6).every((word) => word === 0);
  // ::ffff:0:0:0/96: IPv4-translated addresses (RFC 2765)
  const isIpv4Translated =
    words.slice(0, 4).every((word) => word === 0) &&
    words[4] === 0xffff &&
    words[5] === 0;

  if (isIpv4Mapped || isIpv4Compatible || isIpv4Translated) {
    const high = words[6] ?? 0;
    const low = words[7] ?? 0;
    return isPrivateIpv4(
      `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`,
    );
  }

  // 64:ff9b::/96: IPv4-IPv6 translation well-known prefix (RFC 6052)
  if (
    words[0] === 0x0064 &&
    words[1] === 0xff9b &&
    words.slice(2, 6).every((word) => word === 0)
  ) {
    const high = words[6] ?? 0;
    const low = words[7] ?? 0;
    return isPrivateIpv4(
      `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`,
    );
  }

  // 64:ff9b:1::/48: local-use IPv4-IPv6 translation prefix (RFC 8215)
  if (words[0] === 0x0064 && words[1] === 0xff9b && words[2] === 1) {
    return true;
  }

  // 2002::/16: 6to4 addresses (RFC 3056)
  if (words[0] === 0x2002) {
    const high = words[1] ?? 0;
    const low = words[2] ?? 0;
    return isPrivateIpv4(
      `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`,
    );
  }

  // 2001:0000::/32: Teredo tunneling (RFC 4380)
  if (words[0] === 0x2001 && words[1] === 0) {
    const high = (words[6] ?? 0) ^ 0xffff;
    const low = (words[7] ?? 0) ^ 0xffff;
    return isPrivateIpv4(
      `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`,
    );
  }

  // 100::/64: discard-only prefix (RFC 6666)
  if (words[0] === 0x0100 && words.slice(1, 4).every((word) => word === 0)) {
    return true;
  }

  const first = words[0] ?? 0;
  if ((first & 0xff00) === 0xff00) {
    // ff00::/8: multicast addresses
    return true;
  }
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

  // Non-global unicast addresses (not in 2000::/3, RFC 4291)
  if ((first & 0xe000) !== 0x2000) {
    return true;
  }

  return false;
}

/**
 * Returns true when the supplied IP address is private, loopback,
 * link-local or otherwise unsafe to connect to from the scraper.
 */
export function isPrivateIp(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (normalized.includes(':')) {
    return isPrivateIpv6(normalized);
  }
  return isPrivateIpv4(normalized);
}
