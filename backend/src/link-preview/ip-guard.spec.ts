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

  it('allows public IPv4 addresses', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
    expect(isPrivateIp('192.169.0.1')).toBe(false);
    expect(isPrivateIp('100.63.0.1')).toBe(false);
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
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:192.168.1.1')).toBe(true);
    expect(isPrivateIp('::ffff:169.254.169.254')).toBe(true);
  });

  it('allows public IPv6 addresses', () => {
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
    expect(isPrivateIp('2001:db8::1')).toBe(false);
  });

  it('allows IPv4-mapped IPv6 addresses when the mapped address is public', () => {
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });

  it('returns false for values that are not IP addresses', () => {
    expect(isPrivateIp('example.com')).toBe(false);
    expect(isPrivateIp('')).toBe(false);
    expect(isPrivateIp('10.0.0')).toBe(false);
    expect(isPrivateIp('10.0.0.999')).toBe(false);
    expect(isPrivateIp('999.999.999.999')).toBe(false);
  });
});
