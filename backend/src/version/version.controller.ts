import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VersionService } from './version.service';

@ApiTags('Version')
@Controller('version')
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Get()
  @ApiOperation({
    summary: 'Get version information',
    description:
      'Returns the current app version, latest available version, optional update URL, and the minimum supported app version.',
  })
  getVersion(): {
    current: string;
    latest: string;
    updateUrl?: string;
    minimumSupported: string;
  } {
    return this.versionService.getVersion();
  }

  @Get('minimum')
  @ApiOperation({
    summary: 'Get minimum supported app version',
    description:
      'Returns the minimum supported app version. Clients below this version should be blocked from using the app.',
  })
  getMinimumSupportedVersion(): { minimumSupported: string } {
    return this.versionService.getMinimumSupportedVersion();
  }
}
