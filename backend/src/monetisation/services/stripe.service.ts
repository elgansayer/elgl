import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SubscriptionPlansService } from './subscription-plans.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly plansService: SubscriptionPlansService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createCheckoutSession(
    planId: string,
    userId: string,
    interval: 'month' | 'year',
  ): Promise<{ url: string; sessionId: string }> {
    const plan = this.plansService.getPlanById(planId);
    if (!plan) {
      throw new BadRequestException(`Plan "${planId}" not found`);
    }

    // Determine price based on interval
    let unitAmount: number;
    let priceId: string | undefined;

    if (interval === 'month') {
      unitAmount = plan.price_usd * 100; // Stripe uses cents
      priceId = plan.stripe_price_id;
    } else if (interval === 'year') {
      // Yearly pricing: 50 UKP / $63 USD
      unitAmount = 6300; // $63.00 in cents
      priceId = plan.stripe_price_id_yearly;
    } else {
      throw new BadRequestException(
        'Invalid interval. Must be "month" or "year"',
      );
    }

    // For yearly, we need to create a price or use a fixed one
    // We'll create a price object dynamically for yearly
    let priceData:
      Stripe.Checkout.SessionCreateParams.LineItem.PriceData | undefined;
    if (interval === 'year' || !priceId) {
      priceData = {
        currency: 'usd',
        product_data: {
          name: `${plan.name} - ${interval === 'year' ? 'Yearly' : 'Monthly'}`,
          description: plan.description,
        },
        unit_amount: unitAmount,
        recurring: {
          interval: interval,
        },
      };
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: priceId || undefined,
        price_data: priceId ? undefined : priceData,
        quantity: 1,
      },
    ];

    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: lineItems,
        client_reference_id: userId,
        metadata: {
          userId,
          planId,
          interval,
        },
        success_url: `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200')}/subscription/cancel`,
        subscription_data: {
          metadata: {
            userId,
            planId,
            interval,
          },
        },
      });

      return {
        url: session.url!,
        sessionId: session.id,
      };
    } catch (error) {
      this.logger.error('Failed to create Stripe checkout session', error);
      throw new InternalServerErrorException(
        'Failed to create checkout session',
      );
    }
  }

  async constructWebhookEvent(
    payload: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required');
    }

    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (error) {
      this.logger.error('Stripe webhook signature verification failed', error);
      throw new BadRequestException('Invalid webhook signature');
    }
  }

  async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata;
    const userId = metadata.userId;
    const planId = metadata.planId;
    const interval = metadata.interval;

    this.logger.log(
      `Subscription created for user ${userId}: plan ${planId}, interval ${interval}`,
    );

    // TODO: Update user's subscription status in database
    // This will be handled by the MonetisationService
  }

  async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata;
    const userId = metadata.userId;
    const planId = metadata.planId;

    this.logger.log(
      `Subscription updated for user ${userId}: plan ${planId}, status ${subscription.status}`,
    );
  }

  async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata;
    const userId = metadata.userId;

    this.logger.log(`Subscription cancelled for user ${userId}`);
  }

  async handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string;
    const subscription =
      await this.stripe.subscriptions.retrieve(subscriptionId);
    const metadata = subscription.metadata;
    const userId = metadata.userId;

    this.logger.log(
      `Payment succeeded for user ${userId}, subscription ${subscriptionId}`,
    );
  }

  async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string;
    const subscription =
      await this.stripe.subscriptions.retrieve(subscriptionId);
    const metadata = subscription.metadata;
    const userId = metadata.userId;

    this.logger.warn(
      `Payment failed for user ${userId}, subscription ${subscriptionId}`,
    );
  }
}
