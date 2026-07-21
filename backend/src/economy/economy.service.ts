import {
  BadRequestException,
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
  ): Promise<{ coins_balance: number; package_id: string }> {
    const supabase = this.supabaseService.getClient();
    const { coins_balance } = await this.getBalance(userId);
    const newBalance = coins_balance + dto.amount;

    await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);
    return { coins_balance: newBalance, package_id: dto.package_id };
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
