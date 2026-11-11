import { HttpException } from '@nestjs/common';
import { CLIENT_UPGRADE_REQUIRED_CODE } from './client-version.constants';

export const UPGRADE_REQUIRED_STATUS = 426;

/**
 * HTTP 426 raised when a client declares a version below the operator-set
 * minimum. The body deliberately carries only public policy data.
 */
export class UpgradeRequiredException extends HttpException {
  constructor(policy: { minimumSupported: string; updateUrl?: string }) {
    super(
      {
        statusCode: UPGRADE_REQUIRED_STATUS,
        error: 'Upgrade Required',
        code: CLIENT_UPGRADE_REQUIRED_CODE,
        message:
          'This version of the app is no longer supported. Update to continue.',
        minimumSupported: policy.minimumSupported,
        ...(policy.updateUrl ? { updateUrl: policy.updateUrl } : {}),
      },
      UPGRADE_REQUIRED_STATUS,
    );
  }
}
