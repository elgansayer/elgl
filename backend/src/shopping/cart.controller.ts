import { Body, Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CartService } from './cart.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('cart')
@UseGuards(SupabaseAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: Request) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id ?? 'unknown';
    return this.cartService.getCart(userId);
  }

  @Post('add')
  addItem(
    @Req() req: Request,
    @Body() body: { itemId: string; quantity?: number },
  ) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id ?? 'unknown';
    return this.cartService.addItem(userId, body.itemId, body.quantity ?? 1);
  }

  @Post('remove')
  removeItem(
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
