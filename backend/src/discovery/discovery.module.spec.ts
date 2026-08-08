// Mock jsdom and dompurify to avoid ESM import failures in Jest (transitively imported through audio-rooms -> chat -> link-preview)
jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      document: { createElement: jest.fn(), createDocumentFragment: jest.fn() },
    },
  })),
}));
jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sanitize: jest.fn((d: string) => d.replace(/<[^>]*>/g, '')),
    setConfig: jest.fn(),
  })),
}));

jest.mock('./sanitise-discovery.helper', () => ({
  sanitiseDiscoveryData: (x: unknown) => x,
}));

import { DiscoveryModule } from './discovery.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryRateLimiterGuard } from './discovery-rate-limiter.guard';
import { AudioRoomsModule } from '../audio-rooms/audio-rooms.module';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { SupabaseModule } from '../supabase/supabase.module';

describe('DiscoveryModule', () => {
  it('should be defined', () => {
    expect(DiscoveryModule).toBeDefined();
  });

  it('should import the modules it depends on', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', DiscoveryModule) as unknown[]) ?? [];

    expect(importsMetadata).toContain(AudioRoomsModule);
    expect(importsMetadata).toContain(UsersModule);
    expect(importsMetadata).toContain(SafetyModule);
    expect(importsMetadata).toContain(SupabaseModule);
  });

  it('should register DiscoveryController in its controllers metadata', () => {
    const controllersMetadata =
      (Reflect.getMetadata('controllers', DiscoveryModule) as unknown[]) ?? [];

    expect(controllersMetadata).toContain(DiscoveryController);
  });

  it('should register DiscoveryService and DiscoveryRateLimiterGuard in its providers metadata', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', DiscoveryModule) as unknown[]) ?? [];

    expect(providersMetadata).toContain(DiscoveryService);
    expect(providersMetadata).toContain(DiscoveryRateLimiterGuard);
  });

  it('should export DiscoveryService', () => {
    const exportsMetadata =
      (Reflect.getMetadata('exports', DiscoveryModule) as unknown[]) ?? [];

    expect(exportsMetadata).toContain(DiscoveryService);
  });
});
