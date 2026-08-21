import { describe, expect, it } from 'vitest';
import { AdminLoginService } from './admin-login.service';

describe('AdminLoginService', () => {
  it('starts signed out and remains signed out after signOut', () => {
    const service = new AdminLoginService();

    expect(service.accessToken()).toBeNull();
    service.signOut();
    expect(service.accessToken()).toBeNull();
  });
});
