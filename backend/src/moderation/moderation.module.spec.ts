import { MODULE_METADATA } from '@nestjs/common/constants';
import { AdminModule } from '../admin/admin.module';
import { SafetyModule } from '../safety/safety.module';
import { ModerationController } from './moderation.controller';
import { ModerationModule } from './moderation.module';
import { ModerationService } from './moderation.service';

describe('ModerationModule wiring', () => {
  const metadata = (key: string): unknown[] =>
    Reflect.getMetadata(key, ModerationModule) ?? [];

  it('imports the admin guards so queue routes can require capabilities', () => {
    expect(metadata(MODULE_METADATA.IMPORTS)).toContain(AdminModule);
  });

  it('imports SafetyModule so report submission shares one validated boundary', () => {
    expect(metadata(MODULE_METADATA.IMPORTS)).toContain(SafetyModule);
  });

  it('registers its controller and service', () => {
    expect(metadata(MODULE_METADATA.CONTROLLERS)).toEqual([
      ModerationController,
    ]);
    expect(metadata(MODULE_METADATA.PROVIDERS)).toContain(ModerationService);
  });
});
