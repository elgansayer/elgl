import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminCapabilityGuard } from '../admin/guards/admin-capability.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { AdminModule } from '../admin/admin.module';
import { CloudflareR2Module } from '../cloudflare-r2/r2.module';
import { R2ObjectService } from '../cloudflare-r2/r2-object.service';
import { EmailService } from '../email/email.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminDmcaV1Controller } from './admin-dmca-v1.controller';
import { DmcaMaintenanceService } from './dmca-maintenance.service';
import { DmcaMediaService } from './dmca-media.service';
import { DmcaOperatorService } from './dmca-operator.service';
import { DmcaController } from './dmca.controller';
import { DmcaModule } from './dmca.module';
import { DmcaService } from './dmca.service';

describe('DmcaModule', () => {
  it('declares both controllers and every service the flow needs', () => {
    expect(Reflect.getMetadata('controllers', DmcaModule)).toEqual([
      DmcaController,
      AdminDmcaV1Controller,
    ]);
    expect(Reflect.getMetadata('providers', DmcaModule)).toEqual(
      expect.arrayContaining([
        DmcaService,
        DmcaOperatorService,
        DmcaMaintenanceService,
        DmcaMediaService,
      ]),
    );
  });

  it('imports the modules that supply the admin guards and the file store', () => {
    const imports = Reflect.getMetadata('imports', DmcaModule) as unknown[];
    expect(imports).toContain(AdminModule);
    expect(imports).toContain(CloudflareR2Module);
  });

  it('resolves every constructor dependency from the collaborators the module imports', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DmcaController, AdminDmcaV1Controller],
      providers: [
        DmcaService,
        DmcaOperatorService,
        DmcaMaintenanceService,
        DmcaMediaService,
        { provide: SupabaseService, useValue: { getClient: () => ({}) } },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: EmailService, useValue: { sendPlainTextEmail: vi.fn() } },
        { provide: R2ObjectService, useValue: {} },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminCapabilityGuard)
      .useValue({ canActivate: () => true })
      .compile();

    expect(moduleRef.get(DmcaController)).toBeInstanceOf(DmcaController);
    expect(moduleRef.get(AdminDmcaV1Controller)).toBeInstanceOf(
      AdminDmcaV1Controller,
    );
    expect(moduleRef.get(DmcaMaintenanceService)).toBeInstanceOf(
      DmcaMaintenanceService,
    );
  });
});
