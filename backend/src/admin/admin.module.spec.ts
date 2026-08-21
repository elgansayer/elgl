import { AdminModule } from './admin.module';
import { PrivacyModule } from '../privacy/privacy.module';

describe('AdminModule', () => {
  it('imports the module that exports DataScrubbingService', () => {
    const imports = Reflect.getMetadata('imports', AdminModule) as unknown[];

    expect(imports).toContain(PrivacyModule);
  });
});
