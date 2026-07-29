import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('config')
export class VersionController {
  constructor(private readonly configService: ConfigService) {}

  @Get('min-version')
  getMinVersion() {
    const version =
      this.configService.get<string>('MIN_APP_VERSION') || '1.0.0';
    return { minAppVersion: version };
  }
}
