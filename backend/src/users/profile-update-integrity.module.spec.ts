import { APP_INTERCEPTOR } from '@nestjs/core';
import { ProfileUpdateIntegrityInterceptor } from './interceptors/profile-update-integrity.interceptor';
import { UsersModule } from './users.module';

describe('UsersModule profile update integrity contract', () => {
  it('registers ProfileUpdateIntegrityInterceptor as an application interceptor', () => {
    const providers =
      (Reflect.getMetadata('providers', UsersModule) as unknown[]) ?? [];

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: APP_INTERCEPTOR,
          useClass: ProfileUpdateIntegrityInterceptor,
        }),
      ]),
    );
  });
});
