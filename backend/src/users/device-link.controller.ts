import {
  Controller,
  Post,
  UseGuards,
  InternalServerErrorException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/current-user.decorator';

interface DeviceLinkUser {
  id: string;
}

@Controller('generate-device-link')
export class DeviceLinkController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(SupabaseAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post()
  async generate(
    @CurrentUser() user: DeviceLinkUser | null,
  ): Promise<{ url: string }> {
    if (!user) {
      throw new InternalServerErrorException('User not identified');
    }
    const url = await this.usersService.generateDeviceLink(user.id);
    return { url };
  }
}
