import { Controller, Get, Param } from '@nestjs/common';
import { SubscriptionPlansService } from '../services/subscription-plans.service';
import type { SubscriptionPlan } from '../services/subscription-plans.service';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Get()
  getAllPlans(): SubscriptionPlan[] {
    return this.subscriptionPlansService.getAllPlans();
  }

  @Get('popular')
  getPopularPlan(): SubscriptionPlan | undefined {
    return this.subscriptionPlansService.getPopularPlan();
  }

  @Get('free')
  getFreePlan(): SubscriptionPlan | undefined {
    return this.subscriptionPlansService.getFreePlan();
  }

  @Get('paid')
  getPaidPlans(): SubscriptionPlan[] {
    return this.subscriptionPlansService.getNonFreePlans();
  }

  @Get(':id')
  getPlanById(@Param('id') id: string): SubscriptionPlan {
    return this.subscriptionPlansService.getPlanById(id);
  }

  @Get(':id/benefits')
  getHighlightedBenefits(@Param('id') id: string): string[] {
    return this.subscriptionPlansService.getHighlightedBenefits(id);
  }

  @Get('showcase')
  getShowcasePlans(): SubscriptionPlan[] {
    return this.subscriptionPlansService.getShowcasePlans();
  }
}
