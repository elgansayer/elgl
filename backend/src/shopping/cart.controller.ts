import { Body, Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { CartService } from './cart.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('cart')
@UseGuards(SupabaseAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Req() req: Request) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id ?? 'unknown';
    return this.cartService.getCart(userId);
  }

  @Post('add')
  async addItem(
    @Req() req: Request,
    @Body() body: { itemId: string; quantity?: number },
  ) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id ?? 'unknown';
    return this.cartService.addItem(userId, body.itemId, body.quantity ?? 1);
  }

  @Post('remove')
  async removeItem(
    @Req() req: Request,
    @Body() body: { itemId: string; quantity?: number },
  ) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id ?? 'unknown';
    return this.cartService.removeItem(userId, body.itemId, body.quantity ?? 1);
  }

  @Post('checkout')
  async checkout(@Req() req: Request) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id ?? 'unknown';
    return this.cartService.checkout(userId);
  }
}
