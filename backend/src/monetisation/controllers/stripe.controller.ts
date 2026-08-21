import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from '../services/stripe.service';
import { IsString, IsIn, IsNotEmpty } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['monthly', 'yearly'])
  planType!: 'monthly' | 'yearly';
}

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // Get raw body from request
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }

    const event = this.stripeService.constructWebhookEvent(
      Buffer.from(rawBody),
      signature,
    );

    switch (event.type) {
      case 'customer.subscription.created':
        await this.stripeService.handleSubscriptionCreated(event);
        break;
      case 'customer.subscription.updated':
        await this.stripeService.handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await this.stripeService.handleSubscriptionDeleted(event);
        break;
      case 'invoice.payment_succeeded':
        await this.stripeService.handleInvoicePaymentSucceeded(event);
        break;
      case 'invoice.payment_failed':
        await this.stripeService.handleInvoicePaymentFailed(event);
        break;
      default:
        // Unhandled event type
        break;
    }

    return { received: true };
  }
}
