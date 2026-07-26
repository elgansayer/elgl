import { Injectable } from '@nestjs/common';
import { FAQ } from './interfaces/faq.interface';

@Injectable()
export class HelpService {
  private faqs: FAQ[] = [
    {
      id: '1',
      question: 'How do I start a language exchange?',
      answer:
        'Go to the Discovery tab, find a partner, and send a chat request.',
      category: 'getting-started',
    },
    {
      id: '2',
      question: 'What are Moments and how do I create one?',
      answer:
        'Moments are public posts visible to your followers and classmates. Tap the camera icon on the Moments feed to create a new Moment.',
      category: 'features',
    },
    {
      id: '3',
      question: 'How does the VIP subscription work?',
      answer:
        'VIP unlocks unlimited translations, advanced corrections, and location spoofing. You can subscribe from the VIP tab.',
      category: 'billing',
    },
    {
      id: '4',
      question: 'How do I report a user?',
      answer:
        'Go to the user’s profile, tap the three-dot menu, and select Report user.',
      category: 'safety',
    },
    {
      id: '5',
      question: 'Can I use HelloTalk for free?',
      answer:
        'Yes! Free users have access to core features like language exchange, Moments, and basic audio rooms.',
      category: 'billing',
    },
  ];

  getFaqs(category?: string): FAQ[] {
    if (category) {
      return this.faqs.filter((f) => f.category === category);
    }
    return this.faqs;
  }

  getFaq(id: string): FAQ | undefined {
    return this.faqs.find((f) => f.id === id);
  }
}
