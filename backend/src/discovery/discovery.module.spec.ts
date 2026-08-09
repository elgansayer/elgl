jest.mock('./sanitise-discovery.helper', () => ({
  sanitiseDiscoveryData: (x: unknown) => x,
}));

// Mock jsdom and dompurify to avoid ESM import failures in Jest
jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation((_html: string) => ({
    window: {
      document: {
        createElement: jest.fn(),
        createDocumentFragment: jest.fn(),
      },
      Node: {
        ELEMENT_NODE: 1,
        TEXT_NODE: 3,
        DOCUMENT_FRAGMENT_NODE: 11,
      },
      NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    },
  })),
}));

jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sanitize: (dirty: string): string => {
      if (typeof dirty !== 'string') return dirty;
      return dirty
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
    },
    setConfig: jest.fn(),
  })),
}));

import { DiscoveryModule } from './discovery.module';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryRateLimiterGuard } from './discovery-rate-limiter.guard';
import { AudioRoomsModule } from '../audio-rooms/audio-rooms.module';
import { UsersModule } from '../users/users.module';
import { SafetyModule } from '../safety/safety.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { CorrectorScoreModule } from '../corrector-score/corrector-score.module';

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
    expect(importsMetadata).toContain(CorrectorScoreModule);
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
