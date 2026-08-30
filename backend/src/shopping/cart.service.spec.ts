vi.mock('./sanitise-shopping.helper', () => ({
  sanitiseShoppingData: <T>(value: T): T => value,
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MonetisationService } from '../monetisation/monetisation.service';
import { CartService } from './cart.service';
import { CatalogItem, ShoppingService } from './shopping.service';

describe('CartService', () => {
  let service: CartService;
  let shoppingService: ShoppingService;
  let monetisationService: MonetisationService;

  const rose: CatalogItem = {
    id: 'rose',
    name: 'Red Rose',
    description: 'A virtual rose.',
    price: 10,
    stock: 10,
  };

  beforeEach(() => {
    shoppingService = {
      getItem: vi.fn((id: string) =>
        id === rose.id ? { ...rose } : undefined,
      ),
      decrementStock: vi.fn(() => true),
    } as unknown as ShoppingService;
    monetisationService = {
      deductCoins: vi.fn().mockResolvedValue(undefined),
    } as unknown as MonetisationService;

    service = new CartService(shoppingService, monetisationService);
  });

  it('starts each authenticated user with an empty cart', () => {
    expect(service.getCart('user-1')).toEqual([]);
    expect(service.getCart('user-2')).toEqual([]);
  });

  it('adds, increments, and removes cart items', () => {
    expect(service.addItem('user-1', 'rose', 2)).toEqual([
      { itemId: 'rose', name: 'Red Rose', quantity: 2, unitPrice: 10 },
    ]);
    expect(service.addItem('user-1', 'rose', 1)[0]?.quantity).toBe(3);
    expect(service.removeItem('user-1', 'rose', 2)[0]?.quantity).toBe(1);
    expect(service.removeItem('user-1', 'rose', 1)).toEqual([]);
  });

  it('rejects invalid quantities and unknown items', () => {
    expect(() => service.addItem('user-1', 'rose', 0)).toThrow(
      BadRequestException,
    );
    expect(() => service.removeItem('user-1', 'rose', 0)).toThrow(
      BadRequestException,
    );
    expect(() => service.addItem('user-1', 'missing', 1)).toThrow(
      NotFoundException,
    );
  });

  it('rejects quantities greater than available stock', () => {
    expect(() => service.addItem('user-1', 'rose', rose.stock + 1)).toThrow(
      BadRequestException,
    );
  });

  it('does not charge an empty cart', async () => {
    await expect(service.checkout('user-1')).resolves.toEqual({
      success: false,
      message: 'Cart is empty.',
    });
    expect(monetisationService.deductCoins).not.toHaveBeenCalled();
    expect(shoppingService.decrementStock).not.toHaveBeenCalled();
  });

  it('charges once and makes repeated checkout safe', async () => {
    service.addItem('user-1', 'rose', 2);

    await expect(service.checkout('user-1')).resolves.toEqual({
      success: true,
      message: 'Checkout completed successfully.',
    });
    expect(monetisationService.deductCoins).toHaveBeenCalledTimes(1);
    expect(monetisationService.deductCoins).toHaveBeenCalledWith('user-1', 20);
    expect(shoppingService.decrementStock).toHaveBeenCalledWith('rose', 2);

    await expect(service.checkout('user-1')).resolves.toEqual({
      success: false,
      message: 'Cart is empty.',
    });
    expect(monetisationService.deductCoins).toHaveBeenCalledTimes(1);
    expect(shoppingService.decrementStock).toHaveBeenCalledTimes(1);
  });

  it('does not charge when stock becomes insufficient', async () => {
    service.addItem('user-1', 'rose', 2);
    vi.mocked(shoppingService.getItem).mockReturnValue({ ...rose, stock: 1 });

    await expect(service.checkout('user-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(monetisationService.deductCoins).not.toHaveBeenCalled();
    expect(shoppingService.decrementStock).not.toHaveBeenCalled();
  });
});
