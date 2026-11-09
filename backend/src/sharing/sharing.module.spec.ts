import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { SupabaseModule } from '../supabase/supabase.module';
import { SharingController } from './sharing.controller';
import { SharingModule } from './sharing.module';
import { SharingService } from './sharing.service';

describe('SharingModule', () => {
  it('imports the Supabase dependency used by the resolver', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      SharingModule,
    ) as unknown[];

    expect(imports).toContain(SupabaseModule);
  });

  it('registers and exports the sharing service', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      SharingModule,
    ) as unknown[];
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      SharingModule,
    ) as unknown[];
    const exports = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      SharingModule,
    ) as unknown[];

    expect(controllers).toContain(SharingController);
    expect(providers).toContain(SharingService);
    expect(exports).toContain(SharingService);
  });
});
