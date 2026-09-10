# Issue 1: N+1 API Call Performance Bottleneck in Message Status Updates

## Title
bug(performance): fix N+1 API call bottleneck when marking messages as read in chat

## Description
In `chat-page.component.ts`, when a user selects a room, the `selectRoom` method iterates over all unread messages from others and fires individual asynchronous API calls to mark them as 'delivered' and 'read'. For rooms with a large number of unread messages, this results in an N+1 API call pattern, flooding the backend with dozens or hundreds of concurrent HTTP requests. This degrades client performance, wastes network resources, and risks rate-limiting or accidental Denial of Service (DoS) against the backend.

## Acceptance Criteria
* Update `chatService.markMessageStatus` (or introduce a new method) to accept an array of message IDs and the target status to allow bulk updates.
* Refactor the `selectRoom` method in `chat-page.component.ts` to batch unread message IDs and send a single API request for 'delivered' and a single API request for 'read' (or a single combined request).
* Ensure proper error handling is implemented for the bulk update operation.

## Suggested Labels
bug, performance, tech-debt


# Issue 2: Monolithic Component Architecture and Lack of Separation of Concerns

## Title
tech-debt(ui): refactor chat-page.component.ts to extract AI and chat sub-components

## Description
The `chat-page.component.ts` file currently handles multiple distinct domains within a single monolithic file. It directly manages room selection, real-time Centrifugo socket events, chat history, message corrections, UI state, and the AI Conversation Partner logic. This violates the Single Responsibility Principle, making the component difficult to test, maintain, and scale.

## Acceptance Criteria
* Extract the AI Conversation Partner functionality (UI and logic) into a separate `ai-partner.component.ts`.
* Extract the Chat Message List and Message Input into their own respective components.
* Utilize Angular Services or state management to handle Centrifugo event dispatching and chat state, rather than managing raw signal arrays directly within the monolithic page component.
* Ensure all existing functionalities (messaging, corrections, AI chat) work seamlessly after the refactor and are covered by relevant unit tests.

## Suggested Labels
tech-debt, refactor, architectural
