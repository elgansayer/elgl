import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubscriptionPlansService } from '../services/subscription-plans.service';
import type { SubscriptionPlan } from '../services/subscription-plans.service';

@ApiTags('Monetisation / Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all subscription plans',
    description:
      'Returns all available subscription plan tiers (Free, Consumer VIP, Pro, Developer) with their prices, features, and benefits. Public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all subscription plans',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'consumer_8_ukp_10_usd' },
          name: { type: 'string', example: 'Consumer VIP' },
          description: {
            type: 'string',
            example: 'Unlock premium features for serious learners',
          },
          price_ukp: { type: 'number', example: 8 },
          price_usd: { type: 'number', example: 10 },
          currency: { type: 'string', example: 'USD' },
          interval: { type: 'string', example: 'month' },
          is_popular: { type: 'boolean', example: true },
          badge_text: { type: 'string', example: 'Most Popular' },
          features: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  })
  getAllPlans(): SubscriptionPlan[] {
    return this.subscriptionPlansService.getAllPlans();
  }

  @Get('popular')
  @ApiOperation({
    summary: 'Get the most popular subscription plan',
    description:
      'Returns the plan marked as most popular (Consumer VIP). Public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular subscription plan details',
  })
  getPopularPlan(): SubscriptionPlan | undefined {
    return this.subscriptionPlansService.getPopularPlan();
  }

  @Get('free')
  @ApiOperation({
    summary: 'Get the free subscription plan',
    description:
      'Returns the Free tier plan details with its features and limitations. Public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Free tier plan details',
  })
  getFreePlan(): SubscriptionPlan | undefined {
    return this.subscriptionPlansService.getFreePlan();
  }

  @Get('paid')
  @ApiOperation({
    summary: 'Get all paid subscription plans',
    description:
      'Returns all paid subscription plans (Consumer VIP, Pro, Developer) excluding Free tier. Public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of paid subscription plans',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price_ukp: { type: 'number' },
          price_usd: { type: 'number' },
          interval: { type: 'string' },
        },
      },
    },
  })
  getPaidPlans(): SubscriptionPlan[] {
    return this.subscriptionPlansService.getNonFreePlans();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific subscription plan by ID',
    description:
      'Returns detailed information for a single subscription plan. Plan IDs: free, consumer_8_ukp_10_usd, pro_12_ukp_15_usd, developer_20_ukp_26_usd.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription plan details',
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  getPlanById(@Param('id') id: string): SubscriptionPlan {
    return this.subscriptionPlansService.getPlanById(id);
  }

  @Get(':id/benefits')
  @ApiOperation({
    summary: 'Get highlighted benefits for a plan',
    description:
      'Returns the key highlighted benefits/selling points for a specific subscription plan. Used for marketing display.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of highlighted benefit strings',
    schema: {
      type: 'array',
      items: {
        type: 'string',
        example: 'Unlimited AI translations & corrections',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  getHighlightedBenefits(@Param('id') id: string): string[] {
    return this.subscriptionPlansService.getHighlightedBenefits(id);
  }

  @Get('showcase')
  @ApiOperation({
    summary: 'Get showcase plans with highlighted benefits',
    description:
      'Returns all subscription plans with their highlighted benefits fields populated. Used for plan comparison and showcase pages. Public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of plans with highlighted benefits',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          highlighted_benefits: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  })
  getShowcasePlans(): SubscriptionPlan[] {
    return this.subscriptionPlansService.getShowcasePlans();
  }
}
