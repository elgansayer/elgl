import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ShoppingService } from './shopping.service';
import { MonetisationService } from '../monetisation/monetisation.service';
import { sanitiseShoppingData } from './sanitise-shopping.helper';

export interface CartItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface CartEntry {
  items: CartItem[];
  lastAccessedAt: number;
}

const CART_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CART_ITEMS = 50;

@Injectable()
export class CartService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CartService.name);
  private carts: Map<string, CartEntry> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly shoppingService: ShoppingService,
    private readonly monetisationService: MonetisationService,
  ) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      void this.evictStaleCarts();
    }, CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private touchCart(userId: string): CartEntry {
    let entry = this.carts.get(userId);
    if (!entry) {
      entry = { items: [], lastAccessedAt: Date.now() };
      this.carts.set(userId, entry);
    } else {
      entry.lastAccessedAt = Date.now();
    }
    return entry;
  }

  private async evictStaleCarts(): Promise<void> {
    const now = Date.now();
    let evicted = 0;
    for (const [userId, entry] of this.carts.entries()) {
      if (now - entry.lastAccessedAt > CART_TTL_MS) {
        this.carts.delete(userId);
        evicted++;
      }
    }
    if (evicted > 0) {
      this.logger.log(`Evicted ${evicted} stale carts (TTL: ${CART_TTL_MS}ms)`);
    }
  }

  getCart(userId: string): CartItem[] {
    const entry = this.touchCart(userId);
    return sanitiseShoppingData(entry.items);
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

    const entry = this.touchCart(userId);
    const items = entry.items;

    if (items.length >= MAX_CART_ITEMS) {
      throw new BadRequestException(
        `Cart is full (max ${MAX_CART_ITEMS} unique items).`,
      );
    }

    const existing = items.find((i) => i.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        itemId,
        name: sanitiseShoppingData(item.name),
        quantity,
        unitPrice: item.price,
      });
    }
    return sanitiseShoppingData(items);
  }

  removeItem(userId: string, itemId: string, quantity: number): CartItem[] {
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new BadRequestException('Quantity must be a positive integer');
    }
    const entry = this.touchCart(userId);
    const items = entry.items;
    const existing = items.find((i) => i.itemId === itemId);
    if (!existing) {
      return sanitiseShoppingData(items);
    }
    if (quantity >= existing.quantity) {
      const idx = items.indexOf(existing);
      if (idx !== -1) items.splice(idx, 1);
    } else {
      existing.quantity -= quantity;
    }
    return sanitiseShoppingData(items);
  }

  async checkout(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const entry = this.touchCart(userId);
    const items = entry.items;
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
        throw new BadRequestException(
          `Insufficient stock for item ${item.name}`,
        );
      }
    }

    this.carts.delete(userId);
    return { success: true, message: 'Checkout completed successfully.' };
  }
}
