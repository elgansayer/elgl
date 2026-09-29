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
import { Request } from 'express';
import { ShoppingService } from './shopping.service';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

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
  getCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.getCart(req.user.id);
  }

  @Post('cart')
  @HttpCode(200)
  addToCart(@Req() req: AuthenticatedRequest, @Body() dto: AddToCartDto) {
    return this.cartService.addItem(req.user.id, dto.itemId, dto.quantity);
  }

  @Delete('cart')
  @HttpCode(200)
  removeFromCart(@Req() req: AuthenticatedRequest, @Body() dto: AddToCartDto) {
    return this.cartService.removeItem(req.user.id, dto.itemId, dto.quantity);
  }

  @Post('cart/checkout')
  @HttpCode(200)
  async checkout(@Req() req: AuthenticatedRequest) {
    return this.cartService.checkout(req.user.id);
  }
}
