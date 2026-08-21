import { MetricsModule } from '../metrics/metrics.module';
import { SupabaseModule } from '../supabase/supabase.module';
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

  it('should register RecommendationsService in its providers metadata', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', RecommendationsModule) as unknown[]) ??
      [];

    expect(providersMetadata).toContain(RecommendationsService);
  });

  it('should declare the data and metrics dependencies used by the daily cron job', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', RecommendationsModule) as unknown[]) ??
      [];

    expect(importsMetadata).toContain(SupabaseModule);
    expect(importsMetadata).toContain(MetricsModule);
  });

  it('should export RecommendationsService', () => {
    const exportsMetadata =
      (Reflect.getMetadata('exports', RecommendationsModule) as unknown[]) ??
      [];

    expect(exportsMetadata).toContain(RecommendationsService);
  });
});
