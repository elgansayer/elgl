import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOkResponse({
    description: 'Version information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        current: { type: 'string', example: '2.0.0' },
        latest: { type: 'string', example: '2.1.0' },
        updateUrl: {
          type: 'string',
          example: 'https://github.com/elgansayer/elgl/releases/tag/v2.1.0',
          nullable: true,
        },
        minimumSupported: { type: 'string', example: '1.0.0' },
      },
    },
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
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get minimum supported app version',
    description:
      'Returns the minimum supported app version. Clients below this version should be blocked from using the app.',
  })
  @ApiOkResponse({
    description: 'Minimum supported version retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        minimumSupported: { type: 'string', example: '1.0.0' },
      },
    },
  })
  getMinimumSupportedVersion(): { minimumSupported: string } {
    return this.versionService.getMinimumSupportedVersion();
  }
}
