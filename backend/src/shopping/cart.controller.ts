import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CartService } from './cart.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('cart')
@UseGuards(SupabaseAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: User | null) {
    if (!user?.id) throw new UnauthorizedException();
    return this.cartService.getCart(user.id);
  }

  @Post('add')
  addItem(
    @CurrentUser() user: User | null,
    @Body() body: { itemId: string; quantity?: number },
  ) {
    if (!user?.id) throw new UnauthorizedException();
    return this.cartService.addItem(user.id, body.itemId, body.quantity ?? 1);
  }

  @Post('remove')
  removeItem(
    @CurrentUser() user: User | null,
    @Body() body: { itemId: string; quantity?: number },
  ) {
    if (!user?.id) throw new UnauthorizedException();
    return this.cartService.removeItem(
      user.id,
      body.itemId,
      body.quantity ?? 1,
    );
  }

  @Post('checkout')
  async checkout(@CurrentUser() user: User | null) {
    if (!user?.id) throw new UnauthorizedException();
    return this.cartService.checkout(user.id);
  }
}
