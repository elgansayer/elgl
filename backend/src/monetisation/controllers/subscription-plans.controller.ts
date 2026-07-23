import { Controller, Get, Param } from '@nestjs/common';
import { SubscriptionPlansService } from '../services/subscription-plans.service';
import { SubscriptionPlan } from '../interfaces/subscription-plan.interface';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Get()
  findAll(): SubscriptionPlan[] {
    return this.subscriptionPlansService.findAll();
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
  ): SubscriptionPlan | undefined {
    return this.subscriptionPlansService.findById(id);
  }

  @Get(':id/benefits')
  getHighlightedBenefits(@Param('id') id: string): string[] {
    return this.subscriptionPlansService.getHighlightedBenefits(id);
  }
}
