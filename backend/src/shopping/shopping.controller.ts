import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@supabase/supabase-js';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ShoppingService } from './shopping.service';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

@Controller('shopping')
export class ShoppingController {
  constructor(
    private readonly shoppingService: ShoppingService,
    private readonly cartService: CartService,
  ) {}

  @Get('catalog')
  getCatalog() {
    return this.shoppingService.getCatalog();
  }

  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return this.shoppingService.getItem(id);
  }

  @Get('cart')
  @UseGuards(SupabaseAuthGuard)
  getCart(@CurrentUser() user: User | null) {
    if (!user?.id) throw new UnauthorizedException();
    return this.cartService.getCart(user.id);
  }

  @Post('cart')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(200)
  addToCart(@CurrentUser() user: User | null, @Body() dto: AddToCartDto) {
    if (!user?.id) throw new UnauthorizedException();
    return this.cartService.addItem(user.id, dto.itemId, dto.quantity);
  }

  @Delete('cart')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(200)
  removeFromCart(@CurrentUser() user: User | null, @Body() dto: AddToCartDto) {
    if (!user?.id) throw new UnauthorizedException();
    return this.cartService.removeItem(user.id, dto.itemId, dto.quantity);
  }

  @Post('cart/checkout')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(200)
  async checkout(@CurrentUser() user: User | null) {
    if (!user?.id) throw new UnauthorizedException();
    return this.cartService.checkout(user.id);
  }
}
