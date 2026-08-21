import {
  Controller,
  Post,
  Get,
  Req,
  Body,
  Query,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
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
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async generate(@Req() req: { user?: { id?: string } }) {
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async consume(@Query('token') token?: string) {
    if (!token) {
      throw new BadRequestException('token query parameter is required');
    }
    const swapToken = await this.transferService.consumeTransferToken(token);
    if (!swapToken) {
      throw new BadRequestException('Invalid or expired transfer token');
    }
    return { swapToken };
  }

  /**
   * POST /transfer/consume
   * Public endpoint: consume a one‑time transfer token using a request body.
   * Returns the same shape as the GET variant, for compatibility with clients
   * that send the token in the JSON body.
   */
  @Post('consume')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async consumePost(@Body('token') token?: string) {
    if (!token) {
      throw new BadRequestException('token is required');
    }
    const swapToken = await this.transferService.consumeTransferToken(token);
    if (!swapToken) {
      throw new BadRequestException('Invalid or expired transfer token');
    }
    return { swapToken };
  }

  /**
   * POST /transfer/swap
   * Public endpoint: exchange the swapJWT for a real Supabase session.
   */
  @Post('swap')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async swap(@Body('swapToken') swapToken?: string) {
    if (!swapToken) {
      throw new BadRequestException('swapToken is required');
    }
    const result = await this.transferService.swapTokenForSession(swapToken);
    if (!result) {
      throw new BadRequestException('Invalid or expired swap token');
    }
    return result;
  }
}
