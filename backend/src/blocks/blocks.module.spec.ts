import { MODULE_METADATA } from '@nestjs/common/constants';
import { AuthModule } from '../auth/auth.module';
import { SafetyModule } from '../safety/safety.module';
import { BlocksController } from './blocks.controller';
import { BlocksModule } from './blocks.module';
import { BlocksService } from './blocks.service';

describe('BlocksModule wiring', () => {
  const metadata = (key: string): unknown[] =>
    Reflect.getMetadata(key, BlocksModule) ?? [];

  it('imports SafetyModule so block mutations share rules, metrics and cache invalidation', () => {
    expect(metadata(MODULE_METADATA.IMPORTS)).toEqual(
      expect.arrayContaining([AuthModule, SafetyModule]),
    );
  });

  it('registers its controller and service', () => {
    expect(metadata(MODULE_METADATA.CONTROLLERS)).toEqual([BlocksController]);
    expect(metadata(MODULE_METADATA.PROVIDERS)).toContain(BlocksService);
  });
});
