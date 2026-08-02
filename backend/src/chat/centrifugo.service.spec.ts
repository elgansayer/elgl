import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CentrifugoService } from './centrifugo.service';
import * as jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
}));

describe('CentrifugoService', () => {
  let service: CentrifugoService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CentrifugoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CENTRIFUGO_URL') return 'http://localhost:8000';
              if (key === 'CENTRIFUGO_API_KEY') return 'test-api-key';
              if (key === 'CENTRIFUGO_SECRET') return 'test-secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CentrifugoService>(CentrifugoService);
    configService = module.get<ConfigService>(ConfigService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialise apiUrl, apiKey, and tokenSecret from config', () => {
      expect(configService.get).toHaveBeenCalledWith('CENTRIFUGO_URL');
      expect(configService.get).toHaveBeenCalledWith('CENTRIFUGO_API_KEY');
      expect(configService.get).toHaveBeenCalledWith('CENTRIFUGO_SECRET');
    });
  });

  describe('generateConnectionToken', () => {
    it('should generate a JWT connection token using secret', () => {
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const result = service.generateConnectionToken('user-123');

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          exp: expect.any(Number),
        }),
        'test-secret',
      );
      expect(result).toEqual({ token: 'mock-jwt-token' });
    });
  });

  describe('publish', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      if (fetchSpy) {
        fetchSpy.mockRestore();
      }
    });

    it('should publish data successfully and return true when response ok', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
      });

      const result = await service.publish('chat:room-1', { text: 'Hello' });

      expect(fetchSpy).toHaveBeenCalledWith('http://localhost:8000/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'apikey test-api-key',
        },
        body: JSON.stringify({
          method: 'publish',
          params: {
            channel: 'chat:room-1',
            data: { text: 'Hello' },
          },
        }),
      });
      expect(result).toBe(true);
    });

    it('should return false when fetch response is not ok', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
      });

      const result = await service.publish('chat:room-1', { text: 'Hello' });
      expect(result).toBe(false);
    });

    it('should catch fetch error, log error, and return false', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      fetchSpy.mockRejectedValue(new Error('Network failure'));

      const result = await service.publish('chat:room-1', { text: 'Hello' });

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Centrifugo publish error:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });
});
