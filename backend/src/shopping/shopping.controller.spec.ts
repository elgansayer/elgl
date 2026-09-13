import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CartService } from './cart.service';
import { ShoppingController } from './shopping.controller';
import { ShoppingService } from './shopping.service';

describe('ShoppingController', () => {
  let controller: ShoppingController;
  let shoppingService: ShoppingService;
  let cartService: CartService;

  beforeEach(() => {
    shoppingService = {
      getCatalog: vi.fn(),
      getItem: vi.fn(),
    } as unknown as ShoppingService;
    cartService = {
      getCart: vi.fn(),
      addItem: vi.fn(),
      removeItem: vi.fn(),
      checkout: vi.fn(),
    } as unknown as CartService;

    controller = new ShoppingController(shoppingService, cartService);
  });

  const guardsFor = (handler: object) =>
    Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined;

  it('keeps catalogue endpoints public', () => {
    expect(guardsFor(ShoppingController.prototype.getCatalog)).toBeUndefined();
    expect(guardsFor(ShoppingController.prototype.getItem)).toBeUndefined();
  });

  it('protects every cart endpoint with Supabase authentication', () => {
    expect(guardsFor(ShoppingController.prototype.getCart)).toContain(
      SupabaseAuthGuard,
    );
    expect(guardsFor(ShoppingController.prototype.addToCart)).toContain(
      SupabaseAuthGuard,
    );
    expect(guardsFor(ShoppingController.prototype.removeFromCart)).toContain(
      SupabaseAuthGuard,
    );
    expect(guardsFor(ShoppingController.prototype.checkout)).toContain(
      SupabaseAuthGuard,
    );
  });

  it('reads the authenticated user id for cart retrieval', () => {
    const expected = [
      { itemId: 'rose', name: 'Rose', quantity: 1, unitPrice: 10 },
    ];
    vi.mocked(cartService.getCart).mockReturnValue(expected);
    const req = { user: { id: 'user-1' } } as Parameters<
      ShoppingController['getCart']
    >[0];

    expect(controller.getCart(req)).toEqual(expected);
    expect(cartService.getCart).toHaveBeenCalledWith('user-1');
  });

  it('uses the authenticated user id for cart mutations', async () => {
    const req = { user: { id: 'user-1' } } as Parameters<
      ShoppingController['addToCart']
    >[0];
    const dto = { itemId: 'rose', quantity: 2 };

    controller.addToCart(req, dto);
    controller.removeFromCart(req, dto);
    await controller.checkout(req);

    expect(cartService.addItem).toHaveBeenCalledWith('user-1', 'rose', 2);
    expect(cartService.removeItem).toHaveBeenCalledWith('user-1', 'rose', 2);
    expect(cartService.checkout).toHaveBeenCalledWith('user-1');
  });
});
