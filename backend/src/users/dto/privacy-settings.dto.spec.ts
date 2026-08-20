import { validate } from 'class-validator';
import { PrivacySettingsDto } from './privacy-settings.dto';

describe('PrivacySettingsDto', () => {
  it('accepts a boolean hide-VIP-status setting', async () => {
    const dto = Object.assign(new PrivacySettingsDto(), {
      privacy_hide_vip_status: true,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a non-boolean hide-VIP-status setting', async () => {
    const dto = Object.assign(new PrivacySettingsDto(), {
      privacy_hide_vip_status: 'yes',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'privacy_hide_vip_status')).toBe(true);
  });
});
