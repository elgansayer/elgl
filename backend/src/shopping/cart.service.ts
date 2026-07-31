import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ShoppingService } from './shopping.service';
import { MonetisationService } from '../monetisation/monetisation.service';

export interface CartItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

@Injectable()
export class CartService {
  private carts: Map<string, CartItem[]> = new Map();

  constructor(
    private readonly shoppingService: ShoppingService,
    private readonly monetisationService: MonetisationService,
  ) {}

  getCart(userId: string): CartItem[] {
    return this.carts.get(userId) ?? [];
  }

  addItem(userId: string, itemId: string, quantity: number): CartItem[] {
    const item = this.shoppingService.getItem(itemId);
    if (!item) {
      throw new NotFoundException(`Item ${itemId} not found`);
    }
    if (item.stock < quantity) {
      throw new BadRequestException(`Insufficient stock for item ${itemId}`);
    }

    const items = this.carts.get(userId) ?? [];
    const existing = items.find((i) => i.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        itemId,
        name: item.name,
        quantity,
        unitPrice: item.price,
      });
    }
    this.carts.set(userId, items);
    return items;
  }

  removeItem(userId: string, itemId: string, quantity: number): CartItem[] {
    const items = this.carts.get(userId) ?? [];
    const existing = items.find((i) => i.itemId === itemId);
    if (existing) {
      existing.quantity -= quantity;
      if (existing.quantity <= 0) {
        const idx = items.indexOf(existing);
        if (idx !== -1) items.splice(idx, 1);
      }
    }
    return items;
  }

  async checkout(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const items = this.carts.get(userId) ?? [];
    if (items.length === 0) {
      return { success: false, message: 'Cart is empty.' };
    }

    const total = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    await this.monetisationService.deductCoins(userId, total);

    // Decrement stock for each purchased item
    for (const item of items) {
      const ok = this.shoppingService.decrementStock(
        item.itemId,
        item.quantity,
      );
      if (!ok) {
        throw new BadRequestException(
          `Insufficient stock for item ${item.name}`,
        );
      }
    }

    this.carts.delete(userId);
    return { success: true, message: 'Checkout completed successfully.' };
  }
}
