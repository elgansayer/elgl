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
  if (first === 192 && second === 0 && third === 0) {
    // 192.0.0.0/24: IETF protocol assignments
    return true;
  }
  if (first === 198 && (second === 18 || second === 19)) {
    // 198.18.0.0/15: network benchmarking
    return true;
  }
  if (first === 192 && second === 88 && third === 99) {
    // 192.88.99.0/24: deprecated 6to4 relay anycast
    return true;
  }
  if (
    (first === 192 && second === 0 && third === 2) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  ) {
    // 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24: documentation ranges
    return true;
  }
  if (first >= 224) {
    // 224.0.0.0/4 multicast and 240.0.0.0/4 reserved (including broadcast)
    return true;
  }
  return false;
}

/** Dotted-quad text for the IPv4 address held in two consecutive IPv6 words. */
function ipv4FromWords(high: number, low: number): string {
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isPrivateIpv6(ip: string): boolean {
  const words = parseIpv6Words(ip);
  if (!words) {
    return false;
  }

  const isZero = (from: number, to: number): boolean =>
    words.slice(from, to).every((word) => word === 0);
  const embeddedIpv4IsPrivate = (highIndex: number): boolean =>
    isPrivateIpv4(
      ipv4FromWords(words[highIndex] ?? 0, words[highIndex + 1] ?? 0),
    );

  const first = words[0] ?? 0;
  const second = words[1] ?? 0;
  const third = words[2] ?? 0;

  if (isZero(0, 5) && words[5] === 0xffff) {
    // ::ffff:0:0/96: IPv4-mapped addresses
    return embeddedIpv4IsPrivate(6);
  }
  if (isZero(0, 6)) {
    // ::/96: IPv4-compatible addresses, including :: and ::1
    return embeddedIpv4IsPrivate(6);
  }
  if (isZero(0, 4) && words[4] === 0xffff && words[5] === 0) {
    // ::ffff:0:0:0/96: SIIT IPv4-translated addresses
    return embeddedIpv4IsPrivate(6);
  }
  if (first === 0x64 && second === 0xff9b) {
    // 64:ff9b::/96 NAT64 embeds a routable IPv4 address; 64:ff9b:1::/48 is
    // local-use only and never a public web destination.
    return third === 1 || (isZero(2, 6) && embeddedIpv4IsPrivate(6));
  }
  if (first === 0x2002) {
    // 2002::/16: 6to4 embeds the IPv4 address in words 1 and 2
    return embeddedIpv4IsPrivate(1);
  }
  if (first === 0x2001 && second === 0) {
    // 2001::/32: Teredo tunnelling, never a public web destination
    return true;
  }
  if (first === 0x100 && isZero(1, 4)) {
    // 100::/64: discard-only prefix
    return true;
  }
  if ((first & 0xff00) === 0xff00) {
    // ff00::/8: multicast
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
