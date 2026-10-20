import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { LivekitService } from './livekit.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CacheControlInterceptor,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import { LivekitTokenDto } from './dto/livekit-token.dto';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@ApiTags('LiveKit')
@Controller('livekit')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class LivekitController {
  constructor(private readonly livekitService: LivekitService) {}

  @Post('token')
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Generate a LiveKit access token with ICE server configuration',
    description:
      'Generates a LiveKit access token for the authenticated user to join ' +
      'the specified room. Returns the token along with the configured STUN ' +
      'and TURN server credentials for ICE candidate gathering. This enables ' +
      'connectivity through strict corporate NAT networks.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['room_name'],
      properties: {
        room_name: {
          type: 'string',
          description: 'LiveKit room name to join',
          example: 'video_a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Token and ICE servers returned successfully.',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'LiveKit access token',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        iceServers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              urls: { type: 'string', example: 'stun:stun.l.google.com:19302' },
              username: { type: 'string', example: 'guest' },
              credential: { type: 'string', example: 'somepassword' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getToken(
    @Req() req: AuthenticatedRequest,
    @Body() dto: LivekitTokenDto,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not identified');
    }
    return this.livekitService.generateToken(req.user.id, dto.room_name);
  }
}
