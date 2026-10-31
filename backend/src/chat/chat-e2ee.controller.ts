import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatE2eeService } from './chat-e2ee.service';
import {
  RegisterE2eeKeyDto,
  StoreRoomE2eeKeyDto,
} from './dto/register-e2ee-key.dto';

@ApiTags('Chat E2EE')
@Controller('chat/e2ee')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class ChatE2eeController {
  constructor(private readonly chatE2eeService: ChatE2eeService) {}

  @Post('keys')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a user public key for end-to-end encryption',
  })
  @ApiResponse({
    status: 201,
    description: 'Public key registered successfully.',
  })
  async registerPublicKey(
    @CurrentUser() user: User | null,
    @Body() dto: RegisterE2eeKeyDto,
  ) {
    if (!user) throw new UnauthorizedException('Authentication required');
    return this.chatE2eeService.registerPublicKey(user.id, dto);
  }

  @Get('keys/:userId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get a user public key for end-to-end encryption' })
  @ApiResponse({ status: 200, description: 'User public key returned.' })
  @ApiResponse({ status: 404, description: 'Public key not found.' })
  async getPublicKey(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.chatE2eeService.getPublicKey(userId, deviceId || 'default');
  }

  @Post('rooms/:roomId/key')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Store an encrypted room key for end-to-end encryption',
  })
  @ApiResponse({ status: 201, description: 'Room key stored successfully.' })
  async storeRoomKey(
    @CurrentUser() user: User | null,
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Body() dto: StoreRoomE2eeKeyDto,
  ) {
    if (!user) throw new UnauthorizedException('Authentication required');
    return this.chatE2eeService.storeRoomKey(user.id, roomId, dto);
  }

  @Get('rooms/:roomId/key')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({
    summary: 'Get the encrypted room key for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Room key returned.' })
  @ApiResponse({ status: 404, description: 'Room key not found.' })
  async getRoomKey(
    @CurrentUser() user: User | null,
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
  ) {
    if (!user) throw new UnauthorizedException('Authentication required');
    return this.chatE2eeService.getRoomKey(user.id, roomId);
  }
}
