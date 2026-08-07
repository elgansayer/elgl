import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EscrowPayment } from './interfaces/escrow-payment.interface';
import { CreateEscrowPaymentDto } from './dto/create-escrow-payment.dto';
import { UpdateEscrowPaymentDto } from './dto/update-escrow-payment.dto';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async createPayment(
    payerId: string,
    dto: CreateEscrowPaymentDto,
  ): Promise<EscrowPayment> {
    if (payerId === dto.payee_id) {
      throw new BadRequestException('Payer and payee must be different users');
    }

    const { data, error } = await this.supabase.client
      .from('escrow_payments')
      .insert({
        payer_id: payerId,
        payee_id: dto.payee_id,
        amount_coins: dto.amount_coins,
        description: dto.description,
        status: 'pending',
        terms_locked: false,
        payer_approved: false,
        payee_approved: false,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create escrow payment', error);
      throw new BadRequestException('Failed to create escrow payment');
    }

    this.logger.log(`Escrow payment created: ${data.id}`);
    return data as EscrowPayment;
  }

  async getPayment(paymentId: string, userId: string): Promise<EscrowPayment> {
    const { data, error } = await this.supabase.client
      .from('escrow_payments')
      .select()
      .eq('id', paymentId)
      .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
      .single();

    if (error || !data) {
      throw new NotFoundException('Escrow payment not found');
    }

    return data as EscrowPayment;
  }

  async getUserPayments(userId: string): Promise<EscrowPayment[]> {
    const { data, error } = await this.supabase.client
      .from('escrow_payments')
      .select()
      .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Failed to fetch escrow payments', error);
      return [];
    }

    return (data ?? []) as EscrowPayment[];
  }

  async fundPayment(paymentId: string, userId: string): Promise<EscrowPayment> {
    const payment = await this.getPayment(paymentId, userId);

    if (payment.payer_id !== userId) {
      throw new BadRequestException('Only the payer can fund this payment');
    }
    if (payment.status !== 'pending') {
      throw new BadRequestException('Payment can only be funded when pending');
    }

    const { data, error } = await this.supabase.client
      .from('escrow_payments')
      .update({ status: 'funded', terms_locked: true, updated_at: new Date().toISOString() })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to fund escrow payment', error);
      throw new BadRequestException('Failed to fund escrow payment');
    }

    this.logger.log(`Escrow payment funded: ${paymentId}`);
    return data as EscrowPayment;
  }

  async approveDelivery(paymentId: string, userId: string): Promise<EscrowPayment> {
    const payment = await this.getPayment(paymentId, userId);

    if (payment.status !== 'funded') {
      throw new BadRequestException('Payment must be funded to approve delivery');
    }

    if (payment.payer_id === userId) {
      const { data, error } = await this.supabase.client
        .from('escrow_payments')
        .update({ payer_approved: true, updated_at: new Date().toISOString() })
        .eq('id', paymentId)
        .select()
        .single();
      if (error) throw new BadRequestException('Failed to approve delivery');
      this.logger.log(`Payer approved delivery for escrow: ${paymentId}`);
      return data as EscrowPayment;
    }

    if (payment.payee_id === userId) {
      const { data, error } = await this.supabase.client
        .from('escrow_payments')
        .update({ payee_approved: true, status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', paymentId)
        .select()
        .single();
      if (error) throw new BadRequestException('Failed to approve delivery');
      this.logger.log(`Payee marked delivered for escrow: ${paymentId}`);
      return data as EscrowPayment;
    }

    throw new BadRequestException('You are not a party to this payment');
  }

  async completePayment(paymentId: string, userId: string): Promise<EscrowPayment> {
    const payment = await this.getPayment(paymentId, userId);

    if (payment.payer_id !== userId) {
      throw new BadRequestException('Only the payer can complete this payment');
    }
    if (payment.status !== 'delivered') {
      throw new BadRequestException('Payment must be delivered before completion');
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase.client
      .from('escrow_payments')
      .update({ status: 'completed', payer_approved: true, completed_at: now, updated_at: now })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to complete escrow payment', error);
      throw new BadRequestException('Failed to complete escrow payment');
    }

    this.logger.log(`Escrow payment completed: ${paymentId}`);
    return data as EscrowPayment;
  }

  async raiseDispute(
    paymentId: string,
    userId: string,
    reason: string,
  ): Promise<EscrowPayment> {
    const payment = await this.getPayment(paymentId, userId);

    if (!['funded', 'delivered'].includes(payment.status)) {
      throw new BadRequestException('Can only dispute funded or delivered payments');
    }

    const { data, error } = await this.supabase.client
      .from('escrow_payments')
      .update({
        status: 'disputed',
        dispute_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to raise dispute', error);
      throw new BadRequestException('Failed to raise dispute');
    }

    this.logger.log(`Escrow payment disputed: ${paymentId}`);
    return data as EscrowPayment;
  }

  async cancelPayment(paymentId: string, userId: string): Promise<EscrowPayment> {
    const payment = await this.getPayment(paymentId, userId);

    if (!['pending', 'funded'].includes(payment.status)) {
      throw new BadRequestException('Can only cancel pending or funded payments');
    }
    if (payment.payer_id !== userId && payment.payee_id !== userId) {
      throw new BadRequestException('You are not a party to this payment');
    }

    const { data, error } = await this.supabase.client
      .from('escrow_payments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to cancel escrow payment', error);
      throw new BadRequestException('Failed to cancel escrow payment');
    }

    this.logger.log(`Escrow payment cancelled: ${paymentId}`);
    return data as EscrowPayment;
  }
}