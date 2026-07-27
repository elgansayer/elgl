import { Injectable } from '@nestjs/common';
import { HelpQueryDto } from './dto/help-query.dto';

export interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

@Injectable()
export class HelpService {
  // In-memory store – replace with a real DB call in production.
  private readonly faqs: FAQ[] = [
    {
      id: '1',
      category: 'account',
      question: 'How do I reset my password?',
      answer:
        'Go to Settings > Account > Change Password. If you are unable to log in, use the “Forgot password” link on the login screen.',
    },
    {
      id: '2',
      category: 'account',
      question: 'Can I change my display name?',
      answer:
        'Yes. Visit your profile, tap the edit icon next to your name, and save the desired display name.',
    },
    {
      id: '3',
      category: 'privacy',
      question: 'Who can see my profile?',
      answer:
        'You control your visibility in Settings > Privacy. You can hide your profile from search, hide your age, and block specific users.',
    },
    {
      id: '4',
      category: 'privacy',
      question: 'How do I block another user?',
      answer:
        'Go to the user’s profile, tap the three‑dot menu, and choose “Block”. Blocked users cannot message you or see your moments.',
    },
    {
      id: '5',
      category: 'billing',
      question: 'How do I cancel my VIP subscription?',
      answer:
        'Navigate to Settings > Subscription and tap “Cancel subscription”. Your VIP benefits remain active until the end of the current period.',
    },
    {
      id: '6',
      category: 'billing',
      question: 'Can I get a refund?',
      answer:
        'Refund requests are handled by the app store. Please follow the standard refund process provided by Google Play or the Apple App Store.',
    },
    {
      id: '7',
      category: 'audio-rooms',
      question: 'What is an Audio Room?',
      answer:
        'Audio Rooms are live voice‑based conversations where you can practise your target language with native speakers. You can listen or, when invited, speak on stage.',
    },
    {
      id: '8',
      category: 'audio-rooms',
      question: 'How do I become a speaker?',
      answer:
        'Raise your hand by tapping the hand icon. The room host can then approve you, allowing you to speak on stage.',
    },
    {
      id: '9',
      category: 'general',
      question: 'Is HelloTalk free?',
      answer:
        'The core features (text chat, discovery, moments) are free. A VIP subscription unlocks additional features such as unlimited AI translations and advanced search filters.',
    },
    {
      id: '10',
      category: 'general',
      question: 'What is a LingQ‑style reading session?',
      answer:
        'When you open an article, every word is colour‑coded based on your flashcard level. Tap a word to see its translation and add it to your vocabulary bank.',
    },
  ];

  findAll(query: HelpQueryDto) {
    let filtered = [...this.faqs];

    const category = (query as { category?: string }).category;
    const cat = category?.toLowerCase();

    const searchTerm = (query as { search?: string }).search;
    const search = searchTerm?.toLowerCase();

    if (cat) {
      filtered = filtered.filter((f) => f.category.toLowerCase() === cat);
    }

    if (search) {
      filtered = filtered.filter(
        (f) =>
          f.question.toLowerCase().includes(search) ||
          f.answer.toLowerCase().includes(search),
      );
    }

    const page = (query as { page?: number }).page ?? 1;
    const limit = (query as { limit?: number }).limit ?? 10;
    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return { items, total, page, limit };
  }
}
