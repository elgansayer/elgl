import { Controller, Get, Param } from '@nestjs/common';
import { ShoppingService } from './shopping.service';

@Controller('shopping')
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  @Get('catalog')
  async getCatalog() {
    return this.shoppingService.getCatalog();
  }

  @Get('items/:id')
  async getItem(@Param('id') id: string) {
    return this.shoppingService.getItem(id);
  }
}
