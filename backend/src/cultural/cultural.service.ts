import { Injectable } from '@nestjs/common';

interface CulturalGuide {
  language: string;
  guideText: string;
}

@Injectable()
export class CulturalService {
  private readonly guides: CulturalGuide[] = [
    {
      language: 'fr',
      guideText:
        'In France, it is polite to greet with "Bonjour" and use "vous" for formal situations.',
    },
    {
      language: 'ja',
      guideText:
        'In Japan, bowing is the customary greeting rather than handshakes. Avoid direct eye contact.',
    },
    {
      language: 'ar',
      guideText:
        'In Arabic cultures, greetings are warm and often include "As-salamu alaykum". Use right hand for handshakes.',
    },
    {
      language: 'es',
      guideText:
        'In Spain, friends often greet with a hug or kiss on both cheeks. Use "tú" for informal contexts.',
    },
    {
      language: 'ko',
      guideText:
        'In Korea, bowing is common; use two hands when giving or receiving something. Respect elders.',
    },
    {
      language: 'ru',
      guideText:
        'In Russia, it is customary to bring a gift when visiting someone’s home and remove shoes at the door.',
    },
    {
      language: 'it',
      guideText:
        'In Italy, greetings are enthusiastic; expect gestures during conversation. Use "ciao" for informal.',
    },
  ];

  getGuideForLanguage(language: string): string | undefined {
    const entry = this.guides.find(
      (g) => g.language === language || g.language === language.split('-')[0],
    );
    return entry?.guideText;
  }
}
