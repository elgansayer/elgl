# HelloTalk AI Clone

This project is a premium, pixel-perfect clone of HelloTalk, built autonomously by an AI Swarm. It features an advanced social language exchange platform integrating LiveKit audio/video rooms, real-time messaging, LingQ-style interactive reading, and native speaker corrections.

## Table of Contents

- [Overview](#overview)
- [Wiki & Documentation](#wiki--documentation)
- [Tech Stack](#tech-stack)
- [Advanced AI Factory Tooling](#advanced-ai-factory-tooling)

## Overview

HelloTalk AI Clone aims to replicate and extend the best features of modern language exchange applications. It implements a fully internationalized, highly responsive frontend coupled with a robust, scalable backend capable of handling real-time chat and multi-user WebRTC rooms.

## Wiki & Documentation

Comprehensive documentation has been dynamically generated from the repository's codebase and GitHub issues tracking backlog.

Please refer to the following Wiki pages for exhaustive details:
- **[Home (`wiki/Home.md`)](wiki/Home.md)**: Main landing page for the project Wiki.
- **[Features List (`wiki/Features.md`)](wiki/Features.md)**: An exhaustive list of all implemented and planned features, sourced from our specification files.
- **[Codebase Reference (`wiki/Codebase_Reference.md`)](wiki/Codebase_Reference.md)**: A complete architectural dump listing every file and method in the backend and frontend codebases.
- **[Issues Backlog (`wiki/Issues_Backlog.md`)](wiki/Issues_Backlog.md)**: A compiled status report of all active GitHub issues assigned to the swarm queue.

Additional specifications:
- `AGENTS.md`: The Engineering Constitution and system rules.
- `SPEC.md`: Architectural Blueprint covering the PostGIS and PostgREST structures.

## Tech Stack

- **Frontend:** Angular (Standalone Components, Signals, Tailwind CSS)
- **Backend:** NestJS, BullMQ
- **Database:** Supabase (PostgreSQL with PostGIS for spatial queries, pg_trgm for full-text search)
- **Real-Time Messaging:** Centrifugo + Redis
- **Live Video/Audio Rooms:** LiveKit SFU
- **Storage:** Cloudflare R2 (S3-compatible)

## Advanced AI Factory Tooling

The AI Swarm has been fully equipped with autonomous workflow management.

**Tools Installed:**

- **Dependabot:** Fully configured (`.github/dependabot.yml`) to automatically submit PRs for outdated frontend/backend packages every week.
- **Ngrok:** Installed in the backend for webhook testing. The AI can now test LiveKit and Stripe payments locally using `npx ngrok http 3000`.
- **Two-Way Sync:** A GitHub Action perfectly syncs `TODO.md` with GitHub Issues.

**Pending Setup (Action Required):**

- **GitHub CodeQL:** To prevent the AI from accidentally writing vulnerable code, please go to your GitHub repository -> Settings -> Code Security and enable "CodeQL Analysis". This will automatically scan every commit the AI pushes for vulnerabilities.
