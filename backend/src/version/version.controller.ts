import { Controller, Get } from '@nestjs/common';

@Controller('api/config')
export class VersionController {
  @Get('min-version')
  getMinVersion() {
    const version = process.env.MIN_APP_VERSION || '1.0.0';
    return {
      minAppVersion: version,
    };
  }
}
