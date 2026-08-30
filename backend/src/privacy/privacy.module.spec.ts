import { SafetyModule } from '../safety/safety.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { DataRetentionService } from './data-retention.service';
import { DataScrubbingService } from './data-scrubbing.service';
import { PrivacyArchiveCron } from './privacy-archive.cron';
import { PrivacyController } from './privacy.controller';
import { PrivacyModule } from './privacy.module';
import { PrivacyService } from './privacy.service';

describe('PrivacyModule', () => {
  it('registers the privacy controller and dependencies', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', PrivacyModule) as unknown[]) ?? [];
    const controllersMetadata =
      (Reflect.getMetadata('controllers', PrivacyModule) as unknown[]) ?? [];

    expect(importsMetadata).toContain(SupabaseModule);
    expect(importsMetadata).toContain(SafetyModule);
    expect(controllersMetadata).toContain(PrivacyController);
  });

  it('registers both scheduled privacy providers', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', PrivacyModule) as unknown[]) ?? [];

    expect(providersMetadata).toContain(PrivacyArchiveCron);
    expect(providersMetadata).toContain(DataRetentionService);
  });

  it('keeps the existing privacy services registered and exported', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', PrivacyModule) as unknown[]) ?? [];
    const exportsMetadata =
      (Reflect.getMetadata('exports', PrivacyModule) as unknown[]) ?? [];

    expect(providersMetadata).toContain(PrivacyService);
    expect(providersMetadata).toContain(DataScrubbingService);
    expect(exportsMetadata).toContain(PrivacyService);
    expect(exportsMetadata).toContain(DataScrubbingService);
  });
});
