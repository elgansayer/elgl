# 📋 Consolidated Product Backlog

_Organized by complete user outcomes rather than individual technical chores._

## Real-Time Communication & Messaging

- settings toggle to auto-play sequential voice notes
- Disappearing messages
- Edit sent messages
- Automated PII scrubbing
- Forwarding messages
- Instant video messages
- Pin priority chats
- swipe-to-reply gesture
- WebSocket connection rate limiting

## Social Feed & Community Engagement

- Mute Word client-side filter
- Correction Quality rating system
- Recommended for You carousel
- Has Audio Intro required filter
- Chart.js integration for visual data representation
- Implement x-algorithm for content recommendations

## Live Audio & Video Events

- AI-generated Session Summary
- Categorise active Voicerooms
- HLS/DASH on-the-fly video transcoding
- Fix WebRTC edge cases (Bluetooth headset interrupts)
- Fix inviteCoHost race conditions (Centrifugo events arriving out of order)

## Interactive Learning & AI Tools

- Architectural Enhancements for Language Learning Synergy (integrate Pronunciation/AI with Flashcards and Reading Engine)
- unlock premium one-off AI services
- 50/50 language exchange timers
- verb conjugation trainer
- partial credit scoring
- daily AI usage rate limiting
- strict LLM prompt injection protection


## Monetisation & Premium Features

- App Store receipt validation

## Trust, Safety & User Privacy

- Hide Online Status
- Who can see my profile toggle

## Platform Stability & Core Architecture

- Implement missing E2E test flows for Authentication, Chat Messaging, and Moment Creation
- Exempt non-user-authored body fields from sanitization
- Configure Angular Universal (SSR)
- Audit RxJS subscriptions and migrate to Angular Signals where possible
- Implement TimelineWorker backend job for fan-out processing
- Agent workflow to check for security issues and vulnerabilities
- Automated push notification reminders
- Achievements service in NestJS

## Communities UI Improvements

- Complete Responsive Communities Experience (incorporates Three-Pane Layout, Active States, Mobile Drawer, Unread Badges, and Error Handling)

## Visual Diff Component Improvements

- Stabilize Visual Diff Component (Replace naive diff with Myers, optimize segmenter, fix translation mapping, add focus visibility)
