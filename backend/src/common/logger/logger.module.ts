import { Module, Global } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        formatters: {
          level(label: string): { level: string } {
            return { level: label.toUpperCase() };
          },
        },
        timestamp: () => `,"time":"${new Date().toISOString()}"`,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        serializers: {
          req(req: Record<string, unknown>) {
            return {
              method: req.method,
              url: req.url,
              query: req.query,
            };
          },
          res(res: Record<string, unknown>) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class SharedLoggerModule {}