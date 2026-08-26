import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  RegisterE2eeDeviceDto,
  SendEncryptedMessageDto,
} from './dto/chat-e2ee.dto';
import {
  ChatE2eeService,
  E2eeRoomDirectory,
} from './chat-e2ee.service';
import { ChatMessage } from './interfaces/chat-message.interface';

@Controller('chat/e2ee')
@UseGuards(SupabaseAuthGuard)
export class ChatE2eeController {
  constructor(private readonly chatE2eeService: ChatE2eeService) {}

  @Put('devices/current')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async registerCurrentDevice(
    @CurrentUser() user: User | null,
    @Body() dto: RegisterE2eeDeviceDto,
  ): Promise<{ success: true } | null> {
    if (!user) return null;
    await this.chatE2eeService.registerDevice(user.id, dto);
    return { success: true };
  }

  @Delete('devices/:deviceId')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async removeDevice(
    @CurrentUser() user: User | null,
    @Param('deviceId') deviceId: string,
  ): Promise<{ success: true } | null> {
    if (!user) return null;
    await this.chatE2eeService.removeDevice(user.id, deviceId);
    return { success: true };
  }

  @Get('rooms/:roomId/devices')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getRoomDirectory(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<E2eeRoomDirectory | null> {
    if (!user) return null;
    return await this.chatE2eeService.getRoomDirectory(user.id, roomId);
  }

  @Post('messages')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async sendMessage(
    @CurrentUser() user: User | null,
    @Body() dto: SendEncryptedMessageDto,
  ): Promise<ChatMessage | null> {
    if (!user) return null;
    return await this.chatE2eeService.sendEncryptedMessage(user.id, dto);
  }
}
