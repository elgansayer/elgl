import { Controller, Get, Req } from '@nestjs/common';
import { XpService } from './xp.service';

@Controller('xp')
export class XpController {
  constructor(private readonly xpService: XpService) {}

  @Get()
  async getXp(
    @Req() req: { user?: { sub?: string; id?: string } },
  ): Promise<{ total: number; level: number }> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    const total = await this.xpService.getXpTotal(userId);
    const level = await this.xpService.getLevel(userId);
    return { total, level };
  }
}
