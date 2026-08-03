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
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
    const item = this.shoppingService.getItem(itemId);
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    if (item.stock < quantity) {
      throw new BadRequestException('Insufficient stock');
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
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
    const items = this.carts.get(userId) ?? [];
    const existing = items.find((i) => i.itemId === itemId);
    if (!existing) {
      return items; // nothing to remove
    }
    if (quantity >= existing.quantity) {
      const idx = items.indexOf(existing);
      if (idx !== -1) items.splice(idx, 1);
    } else {
      existing.quantity -= quantity;
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

    // Validate stock availability before any deduction
    for (const item of items) {
      const catalogItem = this.shoppingService.getItem(item.itemId);
      if (!catalogItem || catalogItem.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for item ${item.name}`,
        );
      }
    }

    const total = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
    await this.monetisationService.deductCoins(userId, total);

    // Decrement stock after successful coin deduction
    for (const item of items) {
      const ok = this.shoppingService.decrementStock(
        item.itemId,
        item.quantity,
      );
      if (!ok) {
        // This should not happen because we validated earlier,
        // but keep guard for safety.
        throw new BadRequestException(
          `Insufficient stock for item ${item.name}`,
        );
      }
    }

    this.carts.delete(userId);
    return { success: true, message: 'Checkout completed successfully.' };
  }
}
