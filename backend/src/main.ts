import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded, Request, Response } from 'express';
import helmet from 'helmet';
import { SanitiseHtmlPipe } from './common/pipes/sanitise-html.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet());
  app.setGlobalPrefix('api');

  // Ensure raw body is preserved for Stripe webhook
  app.use(
    json({
      verify: (
        req: Request & { rawBody?: Buffer },
        _res: Response,
        buf: Buffer,
      ) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      verify: (
        req: Request & { rawBody?: Buffer },
        _res: Response,
        buf: Buffer,
      ) => {
        req.rawBody = buf;
      },
    }),
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });
  app.useGlobalPipes(
    new SanitiseHtmlPipe(),
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('HelloTalk Clone API')
    .setDescription(
      `The HelloTalk Clone API provides endpoints for language exchange, social networking, real-time messaging, and administrative operations.

## Admin Moderation Dashboard
The Admin Moderation Dashboard exposes REST endpoints under \`/api/admin\` and \`/api/moderation\` for managing users, blocks, reports, and content moderation workflows. All admin endpoints require **Bearer** authentication with an admin role.

### Key Capabilities
- **User Management**: List, search, ban, warn users; manage VIP status; view login history.
- **Block Management**: List and remove user blocks across the platform.
- **Moderation Queue**: Fetch pending reports (moment and profile types), approve or reject flagged content.
- **Behaviour Analysis**: Analyse user profiles and moment content for dating-behaviour risk scoring.

### Authentication
Include a Supabase-issued JWT in the \`Authorization\` header:
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

### Pagination
Paginated endpoints accept \`page\` (default 1) and \`pageSize\` (default 20, max 100) query parameters.

### Rate Limiting
All endpoints are rate-limited via \`@nestjs/throttler\`. Check individual endpoint documentation for specific limits.`,
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addTag('Virtual Coin Economy', 'Virtual coin economy: gift catalogue, coin packages, purchasing, daily check-in, gift sending, and sticker pack unlocking')
    .addTag('Admin - Users', 'Administrative user management operations')
    .addTag('Admin - Blocks', 'Administrative block management operations')
    .addTag('Moderation', 'Content moderation and reporting operations')
.addTag(
      'Escrow Payments',
      'Escrow payment system for holding and releasing coins between users for service transactions',
    )
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
