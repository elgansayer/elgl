import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import Stripe from 'stripe';
import { SubscriptionPlansService } from './subscription-plans.service';
import { MonetisationService } from '../monetisation.service';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;

  constructor(
    @InjectPinoLogger(StripeService.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly plansService: SubscriptionPlansService,
    @Inject(forwardRef(() => MonetisationService))
    private readonly monetisationService: MonetisationService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-07-29.dahlia',
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
      // Monthly: £8 / $10 USD
      unitAmount = 1000; // $10.00 in cents
      priceId = plan.stripe_price_id;
    } else if (interval === 'year') {
      // Yearly: £50 / $63 USD
      unitAmount = 6300; // $63.00 in cents
      priceId = plan.stripe_price_id_yearly;
    } else {
      throw new BadRequestException(
        'Invalid interval. Must be "month" or "year"',
      );
    }

    // For yearly, we need to create a price or use a fixed one
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

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
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

  private getTierForPlan(planId?: string, interval?: string): string {
    if (!planId) {
      return interval === 'year' ? 'developer' : 'consumer';
    }
    if (planId.startsWith('consumer_')) return 'consumer';
    if (planId.startsWith('pro_')) return 'pro';
    if (planId.startsWith('developer_')) return 'developer';
    return interval === 'year' ? 'developer' : 'consumer';
  }

  async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata;
    const userId = metadata.userId;
    const planId = metadata.planId;
    const interval = metadata.interval;

    this.logger.info(
      `Subscription created for user ${userId}: plan ${planId}, interval ${interval}`,
    );

    const tier = this.getTierForPlan(planId, interval);
    const isActive =
      subscription.status === 'active' || subscription.status === 'trialing';

    await this.monetisationService.updateVipStatusFromWebhook(
      userId,
      isActive,
      isActive ? tier : null,
    );
  }

  async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata;
    const userId = metadata.userId;
    const planId = metadata.planId;

    this.logger.info(
      `Subscription updated for user ${userId}: plan ${planId}, status ${subscription.status}`,
    );

    const tier = this.getTierForPlan(planId, metadata.interval);
    const isActive =
      subscription.status === 'active' || subscription.status === 'trialing';

    await this.monetisationService.updateVipStatusFromWebhook(
      userId,
      isActive,
      isActive ? tier : null,
    );
  }

  async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const metadata = subscription.metadata;
    const userId = metadata.userId;

    this.logger.info(`Subscription cancelled for user ${userId}`);
    await this.monetisationService.updateVipStatusFromWebhook(
      userId,
      false,
      null,
    );
  }

  async handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = this.getInvoiceSubscriptionId(invoice);
    if (!subscriptionId) {
      return;
    }

    const subscription =
      await this.stripe.subscriptions.retrieve(subscriptionId);
    const metadata = subscription.metadata;
    const userId = metadata.userId;

    this.logger.info(
      `Payment succeeded for user ${userId}, subscription ${subscriptionId}`,
    );
  }

  async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = this.getInvoiceSubscriptionId(invoice);
    if (!subscriptionId) {
      return;
    }

    const subscription =
      await this.stripe.subscriptions.retrieve(subscriptionId);
    const metadata = subscription.metadata;
    const userId = metadata.userId;

    this.logger.warn(
      `Payment failed for user ${userId}, subscription ${subscriptionId}`,
    );
  }

  private getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const currentSubscription =
      invoice.parent?.subscription_details?.subscription;
    const legacySubscription = (
      invoice as Stripe.Invoice & {
        subscription?: string | { id: string } | null;
      }
    ).subscription;
    const subscription = currentSubscription ?? legacySubscription;

    if (typeof subscription === 'string') {
      return subscription;
    }

    return subscription?.id ?? null;
  }
}
