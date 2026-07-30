import { Injectable, BadRequestException } from '@nestjs/common';
import { MonetisationService } from '../monetisation/monetisation.service';

export interface Scenario {
  id: string;
  name: string;
}

@Injectable()
export class AiService {
  private readonly COIN_COST_PER_ANALYSIS = 100;

  constructor(private readonly monetisationService: MonetisationService) {}

  async getConversationAnalysisReport(
    userId: string,
    conversationText: string,
  ): Promise<{ report: string; coinsRemaining?: number }> {
    // Deduct coins
    const coinsRemaining = await this.monetisationService.deductCoins(
      userId,
      this.COIN_COST_PER_ANALYSIS,
    );

    // Mock conversation analysis report
    const report = `**Conversation Analysis Report**

- **Total Messages:** ${conversationText.split(/\s+/).length} words
- **Language Proficiency:** Intermediate (estimated)
- **Vocabulary Usage:** Basic everyday vocabulary dominates.
- **Grammar Issues:** Subject-verb agreement errors detected in 3 turns.
- **Suggested Focus Areas:** Past tense irregular verbs, modal auxiliary usage.

*Report generated using AI. Cost: ${this.COIN_COST_PER_ANALYSIS} coins.*`;

    return {
      report,
      coinsRemaining,
    };
  }

  private readonly scenarios: Scenario[] = [
    { id: 'coffee-order', name: 'Ordering Coffee' },
    { id: 'job-interview', name: 'Job Interview' },
    { id: 'hotel-booking', name: 'Hotel Booking' },
    { id: 'doctor-appointment', name: 'Doctor Appointment' },
  ];

  getScenarios(): Scenario[] {
    return this.scenarios;
  }

  async handleMessage(
    text: string,
    scenarioId?: string,
  ): Promise<{ reply: string; scenarioId?: string }> {
    // For now, return mock reply based on scenario
    let reply = `You said: "${text}"`;
    if (scenarioId) {
      const scenario = this.scenarios.find((s) => s.id === scenarioId);
      if (scenario) {
        reply = `[${scenario.name} scenario] ${reply}`;
      }
    }
    return {
      reply,
      scenarioId: scenarioId ?? undefined,
    };
  }
}
