import { Controller, Get, Param } from '@nestjs/common';
import { SubscriptionPlansService } from '../services/subscription-plans.service';
import { SubscriptionPlan } from '../interfaces/subscription-plan.interface';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Get()
  async findAll(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlansService.findAll();
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
  ): Promise<SubscriptionPlan | undefined> {
    return this.subscriptionPlansService.findById(id);
  }

  @Get(':id/benefits')
  async getHighlightedBenefits(@Param('id') id: string): Promise<string[]> {
    return this.subscriptionPlansService.getHighlightedBenefits(id);
  }
}
