import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LivekitService, LivekitTokenResponse } from './livekit.service';

class TokenRequestDto {
  room_name!: string;
  participant_identity!: string;
  can_publish?: boolean;
  can_subscribe?: boolean;
}

@ApiTags('LiveKit')
@Controller('livekit')
@ApiBearerAuth()
export class LivekitController {
  constructor(private readonly livekitService: LivekitService) {}

  @Post('token')
  @ApiOperation({
    summary: 'Generate a LiveKit access token with ICE server configuration',
    description:
      'Generates a LiveKit JWT access token for the specified participant and room, ' +
      'along with STUN/TURN ICE server configuration for NAT traversal. ' +
      'This endpoint is essential for strict corporate NAT networks where TURN relay is required.',
  })
  @ApiResponse({
    status: 201,
    description: 'Token and ICE configuration generated successfully.',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'LiveKit JWT access token',
          example: 'eyJhbGciOi...',
        },
        ice_servers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              urls: {
                type: 'string',
                description: 'STUN or TURN server URL',
                example: 'stun:stun.l.google.com:19302',
              },
              username: {
                type: 'string',
                description: 'TURN username (only for TURN servers)',
                example: 'guest',
              },
              credential: {
                type: 'string',
                description: 'TURN credential (only for TURN servers)',
                example: 'somepassword',
              },
            },
          },
        },
        livekit_url: {
          type: 'string',
          description: 'LiveKit WebSocket URL',
          example: 'ws://localhost:7880',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - missing required fields.' })
  async generateToken(@Body() dto: TokenRequestDto): Promise<LivekitTokenResponse> {
    return this.livekitService.generateToken(
      dto.room_name,
      dto.participant_identity,
      dto.can_publish ?? true,
      dto.can_subscribe ?? true,
    );
  }
}