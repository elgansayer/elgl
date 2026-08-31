import { Injectable, Logger } from '@nestjs/common';
import { LlmProxyService } from '../llm-proxy/llm-proxy.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { FlashcardsService } from '../flashcards/flashcards.service';
import { StudyStreakService } from '../study-streak/study-streak.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { Flashcard } from '../flashcards/interfaces/flashcard.interface';
import {
  LearnerKnowledgeService,
  LearnerKnowledgeProfile,
} from '../learner-knowledge/learner-knowledge.service';

export interface Scenario {
  id: string;
  name: string;
  systemPrompt: string;
  icon: string;
}

const DAILY_AI_LIMIT_FREE = 10;
const REDIS_KEY_PREFIX = 'daily_ai_usage:';
const REDIS_TTL_SECONDS = 86400; // 24 hours

@Injectable()
export class AiConversationService {
  private readonly logger = new Logger(AiConversationService.name);

  readonly scenarios: Scenario[] = [
    {
      id: 'ordering-coffee',
      name: 'Ordering Coffee',
      icon: '☕',
      systemPrompt: `You are a friendly barista at a coffee shop helping a customer. Stay in character.

Your role: Barista at a busy coffee shop.
The user's role: Customer ordering coffee.

- Greet and ask what they want.
- Offer drink options: latte, cappuccino, espresso, americano, mocha, flat white.
- Ask size, milk type, extras.
- State price naturally.
- Keep replies 1-3 sentences.`,
    },
    {
      id: 'job-interview',
      name: 'Job Interview',
      icon: '💼',
      systemPrompt: `You are a hiring manager conducting a job interview. Stay in character.

Your role: Hiring manager at a tech company.
The user's role: Job candidate.

- Welcome the candidate.
- Ask typical interview questions about experience, strengths, and goals.
- Follow up based on answers.
- Be professional but encouraging.
- End by saying you will be in touch.
- Keep replies 1-3 sentences.`,
    },
    {
      id: 'hotel-booking',
      name: 'Hotel Booking',
      icon: '🏨',
      systemPrompt: `You are a hotel receptionist handling a booking. Stay in character.

Your role: Front desk receptionist.
The user's role: Guest booking a room.

- Greet warmly.
- Ask check-in/out dates, nights, room type, guests.
- Mention amenities: WiFi, breakfast, gym, pool.
- Offer room views/price options.
- Confirm and mention check-in/out times.
- Keep replies 1-3 sentences.`,
    },
    {
      id: 'doctor-appointment',
      name: 'Doctor Appointment',
      icon: '🩺',
      systemPrompt: `You are a GP seeing a patient. Stay in character.

Your role: Family doctor.
The user's role: Patient with symptoms.

- Greet and ask what brings them in.
- Ask about symptoms, onset, severity.
- Ask about history, allergies, medications.
- Offer advice or recommend tests.
- End with summary and next steps.
- Keep replies 1-3 sentences.`,
    },
    {
      id: 'restaurant-order',
      name: 'Restaurant Order',
      icon: '🍽️',
      systemPrompt: `You are a restaurant server. Stay in character.

Your role: Waiter/waitress at a casual restaurant.
The user's role: Diner ordering a meal.

- Greet and offer a menu.
- Mention specials.
- Take drink then food orders.
- Ask about dietary needs, cooking preferences.
- Check on them, offer dessert.
- Keep replies 1-3 sentences.`,
    },
    {
      id: 'airport-checkin',
      name: 'Airport Check-in',
      icon: '✈️',
      systemPrompt: `You are an airline check-in agent. Stay in character.

Your role: Check-in desk agent.
The user's role: Passenger checking in.

- Greet and ask for passport.
- Confirm flight and destination.
- Ask about luggage.
- Offer seat preference.
- Provide gate and boarding time.
- Wish a pleasant flight.
- Keep replies 1-3 sentences.`,
    },
    {
      id: 'bank-account',
      name: 'Opening a Bank Account',
      icon: '🏦',
      systemPrompt: `You are a bank representative helping a new customer. Stay in character.

Your role: Bank customer service rep.
The user's role: Customer opening an account.

- Greet and ask account type (savings/current).
- Request ID and proof of address.
- Explain features: interest, overdraft, card, online banking.
- Ask initial deposit amount.
- Collect details and complete.
- Keep replies 1-3 sentences.`,
    },
    {
      id: 'shopping',
      name: 'Shopping for Clothes',
      icon: '👗',
      systemPrompt: `You are a shop assistant in a clothing store. Stay in character.

Your role: Sales assistant.
The user's role: Customer browsing.

- Greet and ask what they seek.
- Ask size, colour, style.
- Mention promotions.
- Offer fitting room.
- Mention prices.
- Keep replies 1-3 sentences.`,
    },
    {
      id: 'travel-directions',
      name: 'Asking for Directions',
      icon: '🗺️',
      systemPrompt: `You are a helpful local giving directions. Stay in character.

Your role: Friendly local resident.
The user's role: Visitor asking directions.

- Ask where they are going.
- Give clear directions using landmarks.
- Mention walking time or bus numbers.
- Offer tips about the area.
- Keep replies 1-3 sentences.`,
    },
    {
      id: 'small-talk',
      name: 'Small Talk with a Stranger',
      icon: '💬',
      systemPrompt: `You are a friendly stranger making conversation. Stay in character.

Your role: Chatty person at a cafe or social event.
The user's role: Someone practising casual English.

- Open with weather, venue, or drinks.
- Ask about interests, hobbies, background.
- Share a bit about yourself.
- Be positive and encouraging.
- Ask open-ended questions.
- Keep replies 1-3 sentences.`,
    },
  ];

  constructor(
    private readonly llmProxy: LlmProxyService,
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
    private readonly flashcardsService: FlashcardsService,
    private readonly studyStreakService: StudyStreakService,
    private readonly learnerKnowledgeService: LearnerKnowledgeService,
  ) {}

  getScenarios(): Omit<Scenario, 'systemPrompt'>[] {
    return this.scenarios.map(({ id, name, icon }) => ({ id, name, icon }));
  }

  /**
   * Checks and increments the Redis-backed daily AI usage counter.
   * Free users are capped at DAILY_AI_LIMIT_FREE requests per day;
   * VIP users are unlimited. Returns true when the request is allowed.
   */
  async checkDailyAiRateLimit(userId: string): Promise<boolean> {
    const isVip = await this.supabaseService.isVipUser(userId);
    if (isVip) return true;

    const redis = this.supabaseService.getRedisClient();
    if (!redis) {
      // No Redis; allow but log a warning
      this.logger.warn(
        'Redis unavailable for AI rate limiting; allowing request.',
      );
      return true;
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `${REDIS_KEY_PREFIX}${userId}:${today}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, REDIS_TTL_SECONDS);
      }
      return count <= DAILY_AI_LIMIT_FREE;
    } catch (err) {
      this.logger.warn(
        `Redis error checking AI rate limit, allowing request: ${(err as Error).message}`,
      );
      return true;
    }
  }

  async generateReply(
    userId: string,
    userMessage: string,
    scenarioId?: string,
    conversationHistory?: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<string> {
    const scenario = this.scenarios.find((s) => s.id === scenarioId);
    let learnerKnowledge: LearnerKnowledgeProfile | null = null;
    try {
      learnerKnowledge = await this.learnerKnowledgeService.getProfile(
        userId,
        'en',
      );
    } catch (e) {
      this.logger.warn(
        `Failed to fetch learner knowledge profile for user ${userId}`,
        e,
      );
    }

    let systemPrompt = scenario?.systemPrompt;

    if (!systemPrompt) {
      const [profile, flashcards, streak] = await Promise.all([
        this.usersService.getProfile(userId).catch(() => null),
        this.flashcardsService
          .getFlashcards(userId, undefined, 10)
          .catch(() => []),
        this.studyStreakService.getStreak(userId).catch(() => 0),
      ]);
      systemPrompt = this.getDefaultSystemPrompt(
        profile,
        flashcards,
        streak,
        learnerKnowledge,
      );
    }
    const scenarioName = scenario?.name ?? 'free conversation';

    const messages: {
      role: 'system' | 'user' | 'assistant';
      content: string;
    }[] = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory ?? []),
      { role: 'user', content: userMessage },
    ];

    try {
      const result = await this.llmProxy.chatCompletion(messages);
      return result.trim() || this.getFallbackReply(userMessage, scenarioId);
    } catch (err) {
      this.logger.warn(
        `LLM call failed for scenario=${scenarioName}, falling back to local replies.`,
        (err as Error).message,
      );
      return this.getFallbackReply(userMessage, scenarioId);
    }
  }

  private getDefaultSystemPrompt(
    profile: UserProfile | null,
    flashcards: Flashcard[],
    streak: number,
    learnerKnowledge: LearnerKnowledgeProfile | null = null,
  ): string {
    const targetLanguages = profile?.target_languages?.join(', ') || 'English';
    const interests = profile?.interests?.join(', ') || 'various topics';
    const level =
      learnerKnowledge?.globalProficiency?.level ||
      profile?.proficiency_level ||
      'beginner/intermediate';

    let flashcardContext = '';
    if (flashcards && flashcards.length > 0) {
      const words = flashcards.map((f) => f.word_token).join(', ');
      flashcardContext = `\n- The user has recently been studying these words/phrases: ${words}. Try to naturally incorporate some of these into the conversation to help them practice.`;
    }

    let knowledgeContext = '';
    if (learnerKnowledge) {
      const strugglingItems = Array.from([
        ...learnerKnowledge.globalKnowledgeItems.values(),
        ...learnerKnowledge.languageKnowledgeItems.values(),
      ])
        .filter((item) => item.status === 'struggling')
        .map((item) => item.id.replace('vocab:', ''))
        .join(', ');

      if (strugglingItems) {
        knowledgeContext = `\n- The user has been struggling with the following concepts or vocabulary: ${strugglingItems}. Provide extra support or subtle corrections if they make mistakes related to these.`;
      }
    }

    let streakContext = '';
    if (streak > 3) {
      streakContext = `\n- The user is on a ${streak}-day study streak! Acknowledge their dedication if appropriate.`;
    }

    return `You are a personalized, expert language tutor helping a learner practice ${targetLanguages}. Stay in character as a supportive and knowledgeable tutor.

The user's profile:
- Target language(s): ${targetLanguages}
- Proficiency level: ${level}
- Interests: ${interests}${streakContext}${flashcardContext}${knowledgeContext}

Your instructions:
- Comprehensible Input: Use natural, conversational language slightly above their ${level} level (i+1) to challenge them without overwhelming them.
- Active Production: Ask engaging, open-ended questions related to their interests to prompt them to speak and produce language.
- Retrieval Practice & Spaced Repetition: Deliberately reuse recently learned material (vocabulary listed above) to reinforce learning.
- Meaningful Feedback: If the user makes a grammatical or vocabulary error, gently and naturally rephrase their sentence correctly in your response before moving on.
- Be encouraging, warm, and supportive.
- Keep replies 1-3 sentences.`;
  }

  private getFallbackReply(userMessage: string, scenarioId?: string): string {
    const scenarioReplies: Record<string, string[]> = {
      'ordering-coffee': [
        'Would you like a latte, cappuccino, or something else?',
        'What size would you like? Small, medium, or large?',
        'Would you like any extras? A shot of vanilla syrup?',
        'Great choice, I will prepare that for you right away!',
        'That comes to \u00a33.50. Will that be card or cash?',
      ],
      'job-interview': [
        'Tell me a little about yourself.',
        'What are your greatest strengths?',
        'Why do you want to work here?',
        'Where do you see yourself in five years?',
        'Thank you for your answers. We will be in touch soon.',
      ],
    };

    const replies =
      scenarioId && scenarioReplies[scenarioId]
        ? scenarioReplies[scenarioId]
        : [
            'That is fascinating! Can you tell me more about it?',
            'I see. How does that make you feel?',
            'Ah, I understand. What else have you been learning?',
            'Interesting point. Do you have an example?',
            'I appreciate your perspective. Could you elaborate?',
            'Great question! Let me think...',
            'I agree. Have you tried any new language techniques recently?',
            'That reminds me of something I read. Keep going!',
            'Nice! You are making excellent progress.',
            'Hmm, let me reflect on that.',
          ];
    const index = userMessage.length % replies.length;
    return replies[index];
  }
}
