import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LegalSection {
  id: string;
  heading: string;
  content: string;
}

export interface LegalDocument {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
}

const DEFAULT_EFFECTIVE_DATE = '2026-07-01';
const ISO_CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

@Injectable()
export class LegalService {
  private readonly logger = new Logger(LegalService.name);

  constructor(@Optional() private readonly configService?: ConfigService) {}

  getTermsOfService(): LegalDocument {
    const effectiveDate = this.resolveEffectiveDate('TOS_EFFECTIVE_DATE');

    return {
      title: 'Terms of Service',
      lastUpdated: effectiveDate,
      sections: [
        {
          id: 'acceptance',
          heading: '1. Acceptance of Terms',
          content:
            'By accessing and using this application, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.',
        },
        {
          id: 'conduct',
          heading: '2. User Conduct',
          content:
            "You agree to use the service for lawful purposes only and in a way that does not infringe the rights of, restrict or inhibit anyone else's use and enjoyment of the service. Prohibited behaviour includes harassing or causing distress or inconvenience to any other user, transmitting obscene or offensive content, or disrupting the normal flow of dialogue within this service.",
        },
        {
          id: 'account',
          heading: '3. Account Terms',
          content:
            'You must be at least 13 years of age to use this service. You are responsible for maintaining the security of your account and password. The service provider cannot and will not be liable for any loss or damage from your failure to comply with this security obligation. You are responsible for all content posted and activity that occurs under your account.',
        },
        {
          id: 'content',
          heading: '4. User Content',
          content:
            'You retain all ownership rights to the content you submit to the service. However, by submitting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, and distribute such content on and through the service. You warrant that you have the right to grant this license for all content you submit.',
        },
        {
          id: 'termination',
          heading: '5. Termination',
          content:
            'We may terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. All provisions of the Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.',
        },
        {
          id: 'changes',
          heading: '6. Changes to Terms',
          content:
            "We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.",
        },
        {
          id: 'governing-law',
          heading: '7. Governing Law',
          content:
            'These Terms shall be governed and construed in accordance with the laws of England and Wales, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.',
        },
        {
          id: 'contact',
          heading: '8. Contact Us',
          content:
            'If you have any questions about these Terms, please contact us via the Help Centre within the application or by emailing legal@hellotalk.nexus.',
        },
      ],
    };
  }

  getPrivacyPolicy(): LegalDocument {
    const effectiveDate = this.resolveEffectiveDate('PRIVACY_EFFECTIVE_DATE');

    return {
      title: 'Privacy Policy',
      lastUpdated: effectiveDate,
      sections: [
        {
          id: 'information-we-collect',
          heading: '1. Information We Collect',
          content:
            'We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information may include: your display name, email address, profile photo, native language, target languages, and other profile details you choose to provide.',
        },
        {
          id: 'how-we-use-information',
          heading: '2. How We Use Information',
          content:
            'We may use the information we collect about you to provide, maintain, and improve our services, such as to: enable language exchange matching with suitable partners, personalise your experience with relevant content and recommendations, send you technical notices and support messages, and detect and prevent fraudulent or unauthorised activity.',
        },
        {
          id: 'sharing',
          heading: '3. Information Sharing',
          content:
            'We do not sell your personal data. We may share your information with your consent (e.g. your public profile is visible to other users per your privacy settings), with service providers who perform functions on our behalf, or when required by law or to protect rights and safety. All third-party service providers are contractually obligated to maintain the confidentiality and security of your information.',
        },
        {
          id: 'data-retention',
          heading: '4. Data Retention',
          content:
            'We retain your personal data for as long as your account is active or as needed to provide you services. If you delete your account, your data will be permanently deleted within 30 days following the grace period, except where retention is required by law. You may request a full archive of your data at any time through Settings > Privacy > Request Archive.',
        },
        {
          id: 'security',
          heading: '5. Security',
          content:
            'We take reasonable measures to help protect your personal data from loss, theft, misuse, and unauthorised access, disclosure, alteration, and destruction. These measures include encryption of data in transit and at rest, access controls, and regular security reviews. However, no method of electronic storage or transmission over the internet is 100% secure.',
        },
        {
          id: 'your-rights',
          heading: '6. Your Rights',
          content:
            'Under applicable data protection laws, you have the right to access, rectify, or erase your personal data, restrict or object to processing, and the right to data portability. You can exercise many of these rights directly through your account settings. For additional requests, contact us through the Help Centre.',
        },
        {
          id: 'children',
          heading: "7. Children's Privacy",
          content:
            "Our service is not directed to persons under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we take steps to remove such information and terminate the child's account.",
        },
        {
          id: 'changes-privacy',
          heading: '8. Changes to This Policy',
          content:
            'We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy within the application and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically for any changes.',
        },
      ],
    };
  }

  private resolveEffectiveDate(configKey: string): string {
    const configured = this.configService?.get<string>(configKey)?.trim();
    if (!configured) {
      return DEFAULT_EFFECTIVE_DATE;
    }

    if (this.isIsoCalendarDate(configured)) {
      return configured;
    }

    this.logger.warn(
      `Ignoring invalid ${configKey}; using bundled legal effective date`,
    );
    return DEFAULT_EFFECTIVE_DATE;
  }

  private isIsoCalendarDate(value: string): boolean {
    const match = ISO_CALENDAR_DATE_PATTERN.exec(value);
    if (!match) {
      return false;
    }

    const [, yearText, monthText, dayText] = match;
    if (!yearText || !monthText || !dayText) {
      return false;
    }

    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }
}
