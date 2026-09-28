import { MetricsModule } from '../metrics/metrics.module';
import { SafetyModule } from '../safety/safety.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { DiscoveryRecommendationsService } from './discovery-recommendations.service';
import { RecommendationsModule } from './recommendations.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

describe('RecommendationsModule', () => {
  it('should be defined', () => {
    expect(RecommendationsModule).toBeDefined();
  });

  it('should register RecommendationsController in its controllers metadata', () => {
    const controllersMetadata =
      (Reflect.getMetadata(
        'controllers',
        RecommendationsModule,
      ) as unknown[]) ?? [];

    expect(controllersMetadata).toContain(RecommendationsController);
  });

  it('should register both recommendation services in its providers metadata', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', RecommendationsModule) as unknown[]) ??
      [];

    expect(providersMetadata).toContain(RecommendationsService);
    expect(providersMetadata).toContain(DiscoveryRecommendationsService);
  });

  it('should declare the data, metrics and safety dependencies used by recommendations', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', RecommendationsModule) as unknown[]) ??
      [];

    expect(importsMetadata).toContain(SupabaseModule);
    expect(importsMetadata).toContain(MetricsModule);
    expect(importsMetadata).toContain(SafetyModule);
  });

  it('should export both recommendation services', () => {
    const exportsMetadata =
      (Reflect.getMetadata('exports', RecommendationsModule) as unknown[]) ??
      [];

    expect(exportsMetadata).toContain(RecommendationsService);
    expect(exportsMetadata).toContain(DiscoveryRecommendationsService);
  });
});
