import { Injectable } from '@nestjs/common';

export interface Scenario {
  id: string;
  name: string;
}

@Injectable()
export class AiService {
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
