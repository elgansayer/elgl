---
name: hellotalk_architecture
description: Provides comprehensive architectural patterns, full-stack guidelines, and verification commands for the HelloTalk Angular v22 + NestJS + Supabase + Centrifugo + LiveKit ecosystem. Activate when developing features, writing queries, modifying real-time chat/audio, or debugging UI layouts.
---

# HelloTalk Architecture & Full-Stack AI Playbook

When modifying or generating code for **HelloTalk**, adhere to this exact full-stack architecture and domain rulebook.

## 1. System Architecture & Topology

- **Frontend (`/frontend`)**: Angular v22 standalone components using signals (`computed()`, `input()`, `output()`, Signal Forms) and strictly logical Tailwind CSS properties for native RTL (`ps-`, `pe-`, `ms-`, `me-`, `border-s`).
- **Backend (`/backend`)**: NestJS (TypeScript) with REST endpoints (`Controllers` + `Services`), strict `@nestjs/config` validation (`Joi`/`Zod`), and Supabase JWT guards.
- **Database (`/supabase/migrations`)**: Supabase PostgreSQL with **PostGIS** spatial queries (`ST_DWithin`, geography columns) and **`pg_trgm`** trigram text search.
- **Real-Time Engine (`/config/centrifugo`)**: Centrifugo v5 + Redis 7 pub/sub (`chat_messages`, `moments` timeline fan-out via `RPUSH timeline_queue:{id}`).
- **Audio/Video SFU (`/config/livekit`)**: LiveKit v2 WebRTC SFU architecture for live rooms (`RoomServiceClient`, stage management (`canPublish`), composite R2 archiving).
- **Media Storage**: Cloudflare R2 (`@aws-sdk/client-s3`) pre-signed URLs.

## 2. Mandatory Linguistic & Design Rules

- **British English Only**: Use `colour`, `favourite`, `monetisation`, `tokenise`, `favourite_languages` across variables, database columns, API JSON keys, and UI copy.
- **Banned Punctuation**: Never use an em dash anywhere in code, comments, or documentation. Use standard hyphens or colons instead.
- **RTL, Globalisation & Zero Hard-Coded Strings**: Support ANY language with 0 hard-coded UI strings. Never write raw hard-coded text in Angular templates (`*.html`) or code (`*.ts`); always use `TranslatePipe` (`{{ 'key' | t }}`) or `I18nService.translate('key', params)`. Never use physical layout classes (`pl-4`, `mr-2`, `border-l`). Always use logical equivalents (`ps-4`, `me-2`, `border-s`). Always use native `Intl.Segmenter` (`granularity: 'word'`) for token parsing.

## 3. Key Architectural Patterns

### PostGIS Matchmaking & Discovery

When writing spatial queries in NestJS (`DiscoveryService` / Supabase), construct geography points using standard PostGIS format:

```sql
ST_DWithin(
  location::geography,
  ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
  radius_meters
)
```

If `user.is_vip === true`, override real GPS coordinates with `mock_location` before performing spatial matching.

### Centrifugo Real-Time Messaging (`CentrifugeService`)

Every chat room connects to Centrifugo channels (`room_{id}`). Messages route via `POST /chat/messages` on NestJS, which validates and persists to `chat_messages` table before publishing via `/api/publish` to Centrifugo.

### Universal Word Tokenisation (`Intl.Segmenter`)

When rendering interactive text (`TokenisedTextComponent`), parse sentences without regex:

```typescript
const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
const segments = Array.from(segmenter.segment(rawText));
```

## 4. Verification & Build Commands

Before marking any task complete, verify clean execution:

- **Angular Build**: `cd frontend && npx ng build`
- **NestJS Build**: `cd backend && npm run build`
- **Backend Lint Check**: `cd backend && npm run lint`
- **Docker Compose Status**: `docker compose -f docker-compose.yml up -d`
