# AGENTS.md (The Engineering Constitution)

## 1. Technology Stack Mandate
You are strictly forbidden from substituting these core technologies:
*   **Frontend:** Angular (latest stable) using Tailwind CSS.
*   **Backend API:** NestJS (TypeScript).
*   **Database & Auth:** Supabase (PostgreSQL with PostGIS for spatial queries and `pg_trgm` for search).
*   **Real-Time Messaging:** Centrifugo (using JWT authentication) + Redis.
*   **Real-Time Audio/Video:** LiveKit (WebRTC SFU architecture).
*   **Media Hosting:** Cloudflare R2 (S3-compatible, chosen for zero egress fees).
*   **Language Processing:** NLP.js on the backend for language detection.

## 2. Formatting & Linguistic Rules
*   **British English:** You must use British English spelling for all variables, database columns, and UI copy (e.g., `colour`, `monetisation`, `tokenise`, `favourite`).
*   **Banned Punctuation:** You must never use an em dash in your code, comments, or documentation. Use standard hyphens or colons instead.
*   **Monetary Display:** Whenever rendering a price in the UI or documentation, you must display both currencies (e.g., "8 UKP / $10 USD" or "20 UKP / $26 USD").

## 3. Globalisation & RTL Layout Rules
*   **Universal Tokenisation:** You must use the native JavaScript `Intl.Segmenter` API (which achieved baseline browser support in 2024) to parse all text into clickable word tokens. Never use regex or space-splitting.
*   **RTL CSS:** You must strictly use Tailwind logical properties (e.g., `ps-4`, `me-2`, `border-s`) instead of physical directions (`pl-4`, `mr-2`, `border-l`). This ensures the Angular interface natively mirrors for Arabic, Hebrew, and Persian.

## 4. Autonomous Execution Protocol
*   **Verification:** Before checking off a task in `TODO.md`, you must run `npm run lint` and verify no TypeScript compiler errors exist.
*   **API First:** Angular must never connect to the database directly. Every data request must route through the NestJS REST API or Centrifugo WebSockets.
