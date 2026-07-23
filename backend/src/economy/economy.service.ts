import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CentrifugoService } from '../chat/centrifugo.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { PurchaseCoinsDto, SendGiftDto } from './dto/economy.dto';

export interface VirtualGiftRow {
  id: string;
  name: string;
  icon: string;
  cost_coins: number;
  animation_type: string;
}

export interface UserCoinRow {
  id: string;
  coins_balance: number;
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number;
  platform_product_id: {
    ios?: string;
    android?: string;
    web?: string;
  };
}

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'coins_small',
    name: 'Small Coin Pack',
    coins: 100,
    price: 499,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.small',
      android: 'coins_small',
      web: 'coins_small_web',
    },
  },
  {
    id: 'coins_medium',
    name: 'Medium Coin Pack',
    coins: 500,
    price: 1999,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.medium',
      android: 'coins_medium',
      web: 'coins_medium_web',
    },
  },
  {
    id: 'coins_large',
    name: 'Large Coin Pack',
    coins: 1200,
    price: 3999,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.large',
      android: 'coins_large',
      web: 'coins_large_web',
    },
  },
  {
    id: 'coins_mega',
    name: 'Mega Coin Pack',
    coins: 3000,
    price: 7999,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.mega',
      android: 'coins_mega',
      web: 'coins_mega_web',
    },
  },
];

@Injectable()
export class EconomyService {
  private readonly logger = new Logger(EconomyService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
    private readonly centrifugoService: CentrifugoService,
  ) {}

  async getCatalog(): Promise<VirtualGiftRow[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('virtual_gifts')
      .select('*')
      .order('cost_coins', { ascending: true });
    return (response.data ?? []) as VirtualGiftRow[];
  }

  async getPackages(): Promise<CoinPackage[]> {
    return COIN_PACKAGES;
  }

  async getBalance(userId: string): Promise<{ coins_balance: number }> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();
    if (!response.data) {
      return { coins_balance: 50 };
    }
    const row = response.data as UserCoinRow;
    return { coins_balance: row.coins_balance };
  }

  async purchaseCoins(
    userId: string,
    dto: PurchaseCoinsDto,
  ): Promise<{ coins: number; newBalance: number }> {
    // 1. Validate package exists
    const coinPackage = COIN_PACKAGES.find(p => p.id === dto.package_id);
    if (!coinPackage) {
      throw new BadRequestException('Invalid coin package');
    }

    // 2. Validate receipt token format and prevent replay attacks
    await this.validateReceipt(userId, dto.receipt_token, coinPackage, dto.platform);

    // 3. Add coins to user balance
    const supabase = this.supabaseService.getClient();
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      throw new BadRequestException('User not found');
    }

    const currentBalance = user.coins_balance || 0;
    const newBalance = currentBalance + coinPackage.coins;

    const { error: updateError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      throw new BadRequestException('Failed to update coin balance');
    }

    // 4. Log the purchase for audit
    await this.logPurchase(userId, coinPackage, dto.receipt_token, dto.platform);

    this.logger.log(`User ${userId} purchased ${coinPackage.coins} coins (package: ${dto.package_id})`);

    return {
      coins: coinPackage.coins,
      newBalance,
    };
  }

  private async validateReceipt(
    userId: string,
    receiptToken: string,
    coinPackage: CoinPackage,
    platform?: string,
  ): Promise<void> {
    // Basic validation - receipt must be present and have minimum length
    if (!receiptToken || receiptToken.length < 10) {
      throw new BadRequestException('Invalid receipt token');
    }

    // Platform-specific validation
    if (platform === 'ios') {
      // In production: call Apple's /verifyReceipt endpoint
      // For now, validate token format
      if (!receiptToken.startsWith('ios_')) {
        throw new BadRequestException('Invalid iOS receipt format');
      }
    } else if (platform === 'android') {
      // In production: call Google Play's verifyPurchases API
      if (!receiptToken.startsWith('android_')) {
        throw new BadRequestException('Invalid Android receipt format');
      }
    } else {
      // Web purchases via Stripe
      if (!receiptToken.startsWith('stripe_')) {
        throw new BadRequestException('Invalid web receipt format');
      }
    }

    // Check if receipt was already used in the database
    const supabase = this.supabaseService.getClient();
    const { data: existingPurchase } = await supabase
      .from('coin_purchases')
      .select('id')
      .eq('receipt_token', receiptToken)
      .single();

    if (existingPurchase) {
      throw new ForbiddenException('This receipt has already been processed');
    }
  }

  private async logPurchase(
    userId: string,
    coinPackage: CoinPackage,
    receiptToken: string,
    platform?: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    
    const { error } = await supabase
      .from('coin_purchases')
      .insert({
        user_id: userId,
        package_id: coinPackage.id,
        coins_added: coinPackage.coins,
        amount_paid: coinPackage.price,
        currency: 'usd',
        receipt_token: receiptToken,
        platform: platform || 'web',
        status: 'completed',
      });

    if (error) {
      this.logger.error(`Failed to log purchase for user ${userId}: ${error.message}`);
    }
  }

  async sendGift(
    senderId: string,
    dto: SendGiftDto,
  ): Promise<{
    success: boolean;
    coins_remaining: number;
    gift: VirtualGiftRow;
  }> {
    const supabase = this.supabaseService.getClient();

    const giftResponse = await supabase
      .from('virtual_gifts')
      .select('*')
      .eq('id', dto.gift_id)
      .single();
    if (!giftResponse.data) {
      throw new NotFoundException(
        `Gift '${dto.gift_id}' not found in catalog.`,
      );
    }
    const gift = giftResponse.data as VirtualGiftRow;

    const { coins_balance: senderBalance } = await this.getBalance(senderId);
    if (senderBalance < gift.cost_coins) {
      throw new BadRequestException(
        `Insufficient coin balance (${senderBalance} available, ${gift.cost_coins} required). Purchase coins to support your language partners and room hosts!`,
      );
    }

    const { coins_balance: receiverBalance } = await this.getBalance(
      dto.receiver_id,
    );

    // Deduct and credit
    const newSenderBalance = senderBalance - gift.cost_coins;
    const newReceiverBalance = receiverBalance + gift.cost_coins;

    await supabase
      .from('users')
      .update({ coins_balance: newSenderBalance })
      .eq('id', senderId);
    await supabase
      .from('users')
      .update({ coins_balance: newReceiverBalance })
      .eq('id', dto.receiver_id);

    await supabase.from('gift_transactions').insert({
      sender_id: senderId,
      receiver_id: dto.receiver_id,
      gift_id: gift.id,
      room_id: dto.room_id || null,
      coins_spent: gift.cost_coins,
    });

    const senderProfile = await this.usersService.getProfile(senderId);
    const receiverProfile = await this.usersService.getProfile(dto.receiver_id);

    const giftEvent = {
      type: 'virtual_gift',
      gift,
      sender_name: senderProfile?.display_name ?? 'Language Partner',
      receiver_name: receiverProfile?.display_name ?? 'Room Host',
      room_id: dto.room_id,
    };

    if (dto.room_id) {
      void this.centrifugoService.publish(`room_${dto.room_id}`, giftEvent);
    } else {
      void this.centrifugoService.publish(`user_${dto.receiver_id}`, giftEvent);
    }

    return {
      success: true,
      coins_remaining: newSenderBalance,
      gift,
    };
  }
}
