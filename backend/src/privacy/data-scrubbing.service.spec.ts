import { Test, TestingModule } from '@nestjs/testing';
import { DataScrubbingService } from './data-scrubbing.service';

describe('DataScrubbingService', () => {
  let service: DataScrubbingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataScrubbingService],
    }).compile();

    service = module.get<DataScrubbingService>(DataScrubbingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scrubIpAddress', () => {
    it('returns null for null/undefined/empty input', () => {
      expect(service.scrubIpAddress(null)).toBeNull();
      expect(service.scrubIpAddress(undefined)).toBeNull();
      expect(service.scrubIpAddress('')).toBeNull();
    });

    it('zeroes the last octet of an IPv4 address', () => {
      expect(service.scrubIpAddress('203.0.113.5')).toBe('203.0.113.0');
      expect(service.scrubIpAddress('192.168.1.100')).toBe('192.168.1.0');
      expect(service.scrubIpAddress('10.0.0.1')).toBe('10.0.0.0');
    });

    it('zeroes host portion of a full IPv6 address', () => {
      expect(service.scrubIpAddress('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe(
        '2001:db8:85a3:0:0:0:0:0',
      );
    });

    it('returns unrecognized strings unchanged', () => {
      expect(service.scrubIpAddress('not-an-ip')).toBe('not-an-ip');
      expect(service.scrubIpAddress('localhost')).toBe('localhost');
    });

    it('trims whitespace before scrubbing', () => {
      expect(service.scrubIpAddress('  203.0.113.5  ')).toBe('203.0.113.0');
    });
  });

  describe('scrubLoginHistory', () => {
    it('scrubs ip_address on every entry in place', () => {
      const entries = [
        { ip_address: '203.0.113.5', user_agent: 'Mozilla' },
        { ip_address: '192.168.1.100', user_agent: 'Chrome' },
        { ip_address: null },
        {},
      ];

      service.scrubLoginHistory(entries);

      expect(entries[0].ip_address).toBe('203.0.113.0');
      expect(entries[1].ip_address).toBe('192.168.1.0');
      expect(entries[2].ip_address).toBeNull();
      expect(entries[3].ip_address).toBeUndefined();
    });

    it('handles an empty array gracefully', () => {
      expect(() => service.scrubLoginHistory([])).not.toThrow();
    });
  });
});