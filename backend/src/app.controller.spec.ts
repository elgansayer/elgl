import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_MOCK_BACKEND_MODE = process.env.MOCK_BACKEND_MODE;

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_BACKEND_MODE = 'test';

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  afterAll(() => {
    if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIGINAL_NODE_ENV;

    if (ORIGINAL_MOCK_BACKEND_MODE === undefined) delete process.env.MOCK_BACKEND_MODE;
    else process.env.MOCK_BACKEND_MODE = ORIGINAL_MOCK_BACKEND_MODE;
  });

  describe('root', () => {
    it('should return "Hey there!"', () => {
      expect(appController.getHello()).toBe('Hey there!');
    });
  });

  describe('mock clock', () => {
    it('starts and resets at the deterministic fixture epoch', () => {
      expect(appController.getMockClock('worker-a')).toMatchObject({
        namespace: 'worker-a',
        now: '2024-01-01T00:00:00.000Z',
        timeZone: 'UTC',
        offsetMs: 0,
      });

      appController.freezeMockClock({
        namespace: 'worker-a',
        now: '2026-08-27T12:30:00Z',
      });

      expect(appController.resetMockClock({ namespace: 'worker-a' })).toMatchObject({
        now: '2024-01-01T00:00:00.000Z',
        offsetMs: 0,
      });
    });

    it('freezes, advances and rewinds deterministic namespace-local time', () => {
      appController.freezeMockClock({
        namespace: 'worker-a',
        now: '2024-01-02T00:00:00Z',
      });
      appController.advanceMockClock({
        namespace: 'worker-a',
        milliseconds: 90_000,
      });
      appController.rewindMockClock({
        namespace: 'worker-a',
        milliseconds: 30_000,
      });

      expect(appController.getMockClock('worker-a').now).toBe(
        '2024-01-02T00:01:00.000Z',
      );
      expect(appController.getMockClock('worker-b').now).toBe(
        '2024-01-01T00:00:00.000Z',
      );
    });

    it('reports IANA timezone and DST transitions deterministically', () => {
      const before = appController.freezeMockClock({
        namespace: 'dst',
        now: '2024-03-10T06:55:00Z',
        timeZone: 'America/New_York',
      });
      const after = appController.advanceMockClock({
        namespace: 'dst',
        milliseconds: 10 * 60_000,
      });

      expect(before).toMatchObject({
        localDateTime: '2024-03-10T01:55:00',
        utcOffsetMinutes: -300,
      });
      expect(after).toMatchObject({
        localDateTime: '2024-03-10T03:05:00',
        utcOffsetMinutes: -240,
      });
    });

    it('rejects malformed namespaces, timestamps, timezones and unsafe shifts', () => {
      expect(() => appService.getMockClock('not allowed!')).toThrow(
        BadRequestException,
      );
      expect(() =>
        appService.freezeMockClock('2024-01-01', 'worker'),
      ).toThrow(BadRequestException);
      expect(() =>
        appService.freezeMockClock(
          '2024-01-01T00:00:00Z',
          'worker',
          'Not/A_Time_Zone',
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        appService.advanceMockClock(Number.MAX_SAFE_INTEGER, 'worker'),
      ).toThrow(BadRequestException);
    });

    it('is unavailable unless the explicit mock backend profile is enabled', () => {
      process.env.MOCK_BACKEND_MODE = 'disabled';
      expect(() => appController.getMockClock()).toThrow(NotFoundException);
    });
  });
});
