import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ShoppingController } from './shopping.controller';
import { ShoppingService } from './shopping.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { MonetisationModule } from '../monetisation/monetisation.module';

@Module({
  imports: [HttpModule, MonetisationModule],
  controllers: [ShoppingController, CartController],
  providers: [ShoppingService, CartService],
  exports: [ShoppingService, CartService],
})
export class ShoppingModule {}
