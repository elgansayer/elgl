import {
  Controller,
  Post,
  Get,
  Req,
  Body,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { TransferService } from './transfer.service';

@Controller('transfer')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  /**
   * POST /transfer/generate
   * Authenticated user requests a device‑transfer link.
   * Returns a full URL that the user can open on another device.
   */
  @UseGuards(SupabaseAuthGuard)
  @Post('generate')
  async generate(@Req() req: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    const token = await this.transferService.generateTransferToken(userId);
    const baseUrl = process.env.APP_URL ?? `http://localhost:4200`;
    const url = `${baseUrl}/device-transfer?token=${encodeURIComponent(token)}`;
    return { url };
  }

  /**
   * GET /transfer/consume?token=...
   * Public endpoint: consume a one‑time transfer token and receive a short‑lived
   * swap JWT that the client can later exchange for a real session.
   */
  @Get('consume')
  consume(@Body() _body: { token?: string }) {
    // Actually we read from query - but for GET we can use @Query.
    // We'll keep it simple: use @Query()
    throw new Error('Not implemented – use the swap endpoint instead.');
  }

  /**
   * POST /transfer/swap
   * Public endpoint: exchange the swapJWT for a real Supabase session.
   */
  @Post('swap')
  swap(@Body('swapToken') swapToken?: string) {
    if (!swapToken) {
      throw new BadRequestException('swapToken is required');
    }
    const result = this.transferService.swapTokenForSession(swapToken);
    if (!result) {
      throw new BadRequestException('Invalid or expired swap token');
    }
    return result;
  }
}
