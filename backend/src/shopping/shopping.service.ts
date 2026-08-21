import { Injectable } from '@nestjs/common';
import { sanitiseShoppingData } from './sanitise-shopping.helper';

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  price: number; // coin cost
  imageUrl?: string;
  stock: number;
}

@Injectable()
export class ShoppingService {
  private catalog: CatalogItem[] = [
    {
      id: 'rose',
      name: 'Red Rose',
      description: 'A classic virtual rose to show appreciation.',
      price: 10,
      imageUrl: 'https://example.com/rose.png',
      stock: 9999,
    },
    {
      id: 'coffee',
      name: 'Virtual Coffee',
      description: 'Treat your partner to a warm virtual coffee.',
      price: 15,
      imageUrl: 'https://example.com/coffee.png',
      stock: 9999,
    },
    {
      id: 'crown',
      name: 'Golden Crown',
      description: 'Royal treatment for your language star.',
      price: 200,
      imageUrl: 'https://example.com/crown.png',
      stock: 50,
    },
  ];

  getCatalog(): CatalogItem[] {
    return sanitiseShoppingData(this.catalog);
  }

  getItem(id: string): CatalogItem | undefined {
    const item = this.catalog.find((item) => item.id === id);
    return item ? sanitiseShoppingData(item) : undefined;
  }

  /**
   * Decrements the stock of the given item by quantity.
   * Returns false if the item was not found or stock is insufficient.
   */
  decrementStock(itemId: string, quantity: number): boolean {
    const item = this.catalog.find((i) => i.id === itemId);
    if (!item || item.stock < quantity) {
      return false;
    }
    item.stock -= quantity;
    return true;
  }
}
