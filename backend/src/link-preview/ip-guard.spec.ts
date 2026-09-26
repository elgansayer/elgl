import { isPrivateIp } from './ip-guard';

describe('isPrivateIp', () => {
  it('flags private IPv4 ranges', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.255.255.255')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('192.168.255.255')).toBe(true);
  });

  it('flags loopback, link-local and reserved IPv4 addresses', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.255.255.255')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('0.0.0.0')).toBe(true);
    expect(isPrivateIp('100.64.0.1')).toBe(true);
    expect(isPrivateIp('192.0.0.1')).toBe(true);
    expect(isPrivateIp('198.18.0.1')).toBe(true);
  });

  it('flags documentation, multicast and reserved IPv4 addresses', () => {
    expect(isPrivateIp('192.0.2.10')).toBe(true);
    expect(isPrivateIp('198.51.100.10')).toBe(true);
    expect(isPrivateIp('203.0.113.10')).toBe(true);
    expect(isPrivateIp('192.88.99.1')).toBe(true);
    expect(isPrivateIp('224.0.0.1')).toBe(true);
    expect(isPrivateIp('239.255.255.250')).toBe(true);
    expect(isPrivateIp('240.0.0.1')).toBe(true);
    expect(isPrivateIp('255.255.255.255')).toBe(true);
  });

  it('allows public IPv4 addresses', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
    expect(isPrivateIp('192.169.0.1')).toBe(false);
    expect(isPrivateIp('100.63.0.1')).toBe(false);
    expect(isPrivateIp('223.255.255.255')).toBe(false);
  });

  it('only blocks the IETF protocol assignment block inside 192.0.0.0/16', () => {
    // 192.0.0.0/24 is reserved but public space such as ICANN's 192.0.32.0/20
    // must stay reachable.
    expect(isPrivateIp('192.0.0.170')).toBe(true);
    expect(isPrivateIp('192.0.43.8')).toBe(false);
    expect(isPrivateIp('192.0.1.1')).toBe(false);
  });

  it('flags private and special IPv6 addresses', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('::')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd12:3456:789a::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('febf::1')).toBe(true);
    expect(isPrivateIp('fec0::1')).toBe(true);
    expect(isPrivateIp('feff::1')).toBe(true);
  });

  it('flags IPv4-mapped IPv6 addresses when the mapped address is private', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:7f00:1')).toBe(true);
    expect(isPrivateIp('0:0:0:0:0:ffff:7f00:1')).toBe(true);
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:a00:1')).toBe(true);
    expect(isPrivateIp('::ffff:192.168.1.1')).toBe(true);
    expect(isPrivateIp('::ffff:169.254.169.254')).toBe(true);
  });

  it('flags IPv6 multicast, Teredo and discard-only prefixes', () => {
    expect(isPrivateIp('ff02::1')).toBe(true);
    expect(isPrivateIp('ff0e::1234')).toBe(true);
    expect(isPrivateIp('2001:0:4136:e378:8000:63bf:3fff:fdd2')).toBe(true);
    expect(isPrivateIp('100::1')).toBe(true);
  });

  it('flags NAT64 addresses that embed a private IPv4 address', () => {
    expect(isPrivateIp('64:ff9b::7f00:1')).toBe(true);
    expect(isPrivateIp('64:ff9b::a9fe:a9fe')).toBe(true);
    expect(isPrivateIp('64:ff9b::10.0.0.1')).toBe(true);
    expect(isPrivateIp('64:ff9b::808:808')).toBe(false);
  });

  it('flags the local-use NAT64 prefix regardless of the embedded address', () => {
    expect(isPrivateIp('64:ff9b:1::808:808')).toBe(true);
  });

  it('flags 6to4 addresses that embed a private IPv4 address', () => {
    expect(isPrivateIp('2002:7f00:1::1')).toBe(true);
    expect(isPrivateIp('2002:c0a8:101::1')).toBe(true);
    expect(isPrivateIp('2002:a9fe:a9fe::1')).toBe(true);
    expect(isPrivateIp('2002:808:808::1')).toBe(false);
  });

  it('flags SIIT IPv4-translated addresses that embed a private address', () => {
    expect(isPrivateIp('::ffff:0:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:0:808:808')).toBe(false);
  });

  it('allows public IPv6 addresses', () => {
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
    expect(isPrivateIp('2001:db8::1')).toBe(false);
  });

  it('allows IPv4-mapped IPv6 addresses when the mapped address is public', () => {
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
    expect(isPrivateIp('::ffff:808:808')).toBe(false);
  });

  it('returns false for values that are not IP addresses', () => {
    expect(isPrivateIp('example.com')).toBe(false);
    expect(isPrivateIp('')).toBe(false);
    expect(isPrivateIp('10.0.0')).toBe(false);
    expect(isPrivateIp('10.0.0.999')).toBe(false);
    expect(isPrivateIp('999.999.999.999')).toBe(false);
  });
});
