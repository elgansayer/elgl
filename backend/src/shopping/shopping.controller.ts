import { UseGuards } from '@nestjs/common';
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
} from '@nestjs/common';
import { ShoppingService } from './shopping.service';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@supabase/supabase-js';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('shopping')
@UseGuards(SupabaseAuthGuard)
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
  getCart(@CurrentUser() user: User) {
    return this.cartService.getCart(user.id);
  }

  @Post('cart')
  @HttpCode(200)
  addToCart(@CurrentUser() user: User, @Body() dto: AddToCartDto) {
    return this.cartService.addItem(user.id, dto.itemId, dto.quantity);
  }

  @Delete('cart')
  @HttpCode(200)
  removeFromCart(@CurrentUser() user: User, @Body() dto: AddToCartDto) {
    return this.cartService.removeItem(user.id, dto.itemId, dto.quantity);
  }

  @Post('cart/checkout')
  @HttpCode(200)
  async checkout(@CurrentUser() user: User) {
    return this.cartService.checkout(user.id);
  }
}
