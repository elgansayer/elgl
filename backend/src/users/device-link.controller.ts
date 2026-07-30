import {
  Controller,
  Post,
  UseGuards,
  Req,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UsersService } from './users.service';

@Controller('generate-device-link')
export class DeviceLinkController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post()
  async generate(@Req() req: any): Promise<{ url: string }> {
    const userId = req.user?.sub ?? req.user?.id;
    if (!userId) {
      throw new InternalServerErrorException('User not identified');
    }
    const url = await this.usersService.generateDeviceLink(userId);
    return { url };
  }
}
