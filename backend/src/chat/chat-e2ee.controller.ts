import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatE2eeService, ChatE2eeRoomState } from './chat-e2ee.service';
import {
  RegisterChatE2eeDeviceDto,
  SendEncryptedChatMessageDto,
} from './dto/chat-e2ee.dto';

@Controller('chat/e2ee')
@UseGuards(SupabaseAuthGuard)
export class ChatE2eeController {
  constructor(private readonly chatE2eeService: ChatE2eeService) {}

  @Post('devices')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async registerDevice(
    @CurrentUser() user: User,
    @Body() dto: RegisterChatE2eeDeviceDto,
  ): Promise<{ registered: true }> {
    return this.chatE2eeService.registerDevice(user.id, dto);
  }

  @Delete('devices/:deviceId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async revokeDevice(
    @CurrentUser() user: User,
    @Param('deviceId') deviceId: string,
  ): Promise<{ revoked: true }> {
    return this.chatE2eeService.revokeDevice(user.id, deviceId);
  }

  @Get('rooms/:roomId/devices')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getRoomDevices(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
  ): Promise<ChatE2eeRoomState> {
    return this.chatE2eeService.getRoomState(roomId, user.id);
  }

  @Post('messages')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async sendEncryptedMessage(
    @CurrentUser() user: User,
    @Body() dto: SendEncryptedChatMessageDto,
  ): Promise<Record<string, unknown>> {
    return this.chatE2eeService.sendEncryptedMessage(user.id, dto);
  }
}
