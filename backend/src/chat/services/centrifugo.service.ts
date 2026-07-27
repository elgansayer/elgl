import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class CentrifugoService {
  private readonly logger = new Logger(CentrifugoService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>(
      'CENTRIFUGO_API_URL',
      'http://localhost:8001',
    );
    this.apiKey = this.configService.get<string>('CENTRIFUGO_API_KEY', '');
  }

  async publish(channel: string, data: unknown): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/api/publish`,
        { channel, data },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `apikey ${this.apiKey}`,
          },
        },
      );
      this.logger.log(`Published to Centrifugo channel ${channel}`);
    } catch (error) {
      const stackTrace = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to publish to Centrifugo channel ${channel}`,
        stackTrace,
      );
      throw error;
    }
  }
}
