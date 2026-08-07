import { Injectable } from '@nestjs/common';

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

@Injectable()
export class LegalService {
  private readonly termsOfService: LegalDocument = {
    title: 'Terms of Service',
    lastUpdated: '2026-08-01T00:00:00.000Z',
    sections: [
      {
        id: 'acceptance',
        heading: '1. Acceptance of Terms',
        content:
          'By accessing or using HelloTalk ("the Service"), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing the Service.',
      },
      {
        id: 'eligibility',
        heading: '2. Eligibility',
        content:
          'You must be at least 13 years of age to use the Service. By creating an account, you represent and warrant that you meet this age requirement and that the information you provide is accurate, complete, and current.',
      },
      {
        id: 'account',
        heading: '3. Account Registration and Security',
        content:
          'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorised use of your account. HelloTalk shall not be liable for any loss or damage arising from your failure to comply with this obligation.',
      },
      {
        id: 'conduct',
        heading: '4. User Conduct',
        content:
          'You agree to use the Service for lawful purposes only. You shall not:\n\n(a) Harass, abuse, stalk, threaten, defame, or otherwise infringe the rights of any other person;\n\n(b) Post, transmit, or share content that is unlawful, harmful, obscene, pornographic, defamatory, or otherwise objectionable;\n\n(c) Impersonate any person or entity, or falsely state or misrepresent your affiliation with a person or entity;\n\n(d) Use the Service to spam, solicit, or advertise commercial services without our express prior written consent;\n\n(e) Attempt to gain unauthorised access to any part of the Service, or to any other systems or networks connected to the Service.',
      },
      {
        id: 'content',
        heading: '5. User-Generated Content',
        content:
          'You retain all rights to the content you create, upload, or share through the Service ("User Content"). By posting User Content, you grant HelloTalk a worldwide, non-exclusive, royalty-free, sub-licensable licence to host, store, use, display, reproduce, modify, adapt, and distribute that content in connection with providing the Service.\n\nYou represent and warrant that you own or have the necessary rights to your User Content and that it does not infringe the rights of any third party.',
      },
      {
        id: 'privacy',
        heading: '6. Privacy',
        content:
          'Your use of the Service is also governed by our Privacy Policy, which explains how we collect, use, and protect your personal information. By using the Service, you consent to the data practices described in the Privacy Policy.',
      },
      {
        id: 'intellectual-property',
        heading: '7. Intellectual Property',
        content:
          'The Service and its original content (excluding User Content), features, and functionality are and shall remain the exclusive property of HelloTalk and its licensors. The Service is protected by copyright, trademark, and other applicable laws. You shall not copy, modify, distribute, or create derivative works from any part of the Service without our prior written consent.',
      },
      {
        id: 'termination',
        heading: '8. Termination',
        content:
          'We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease. All provisions of the Terms that by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.',
      },
      {
        id: 'disclaimer',
        heading: '9. Disclaimer of Warranties',
        content:
          'THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. HELLOTALK EXPRESSLY DISCLAIMS ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.\n\nWe do not warrant that the Service will be uninterrupted, timely, secure, or error-free, or that any defects will be corrected.',
      },
      {
        id: 'limitation',
        heading: '10. Limitation of Liability',
        content:
          'IN NO EVENT SHALL HELLOTALK, ITS DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR ANY OTHER LEGAL THEORY.',
      },
      {
        id: 'changes',
        heading: '11. Changes to Terms',
        content:
          'We reserve the right to modify or replace these Terms at any time. We will provide reasonable notice of any material changes by posting the updated Terms on the Service and updating the "Last Updated" date. Your continued use of the Service after any changes constitutes your acceptance of the new Terms.',
      },
      {
        id: 'governing-law',
        heading: '12. Governing Law',
        content:
          'These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which HelloTalk is established, without regard to its conflict of law provisions. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts in that jurisdiction.',
      },
      {
        id: 'contact',
        heading: '13. Contact Information',
        content:
          'If you have any questions, concerns, or feedback regarding these Terms of Service, please contact us at support@hellotalk.com or through the in-app Support Centre.',
      },
    ],
  };

  private readonly privacyPolicy: LegalDocument = {
    title: 'Privacy Policy',
    lastUpdated: '2026-08-01T00:00:00.000Z',
    sections: [
      {
        id: 'introduction',
        heading: '1. Introduction',
        content:
          'HelloTalk ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website (collectively, the "Service"). Please read this policy carefully to understand our practices regarding your personal data.',
      },
      {
        id: 'information-we-collect',
        heading: '2. Information We Collect',
        content:
          'We collect several types of information from and about users of our Service:\n\n(a) Personal Information: When you register, we collect your name, email address, phone number, date of birth, native language, and target language(s).\n\n(b) Profile Information: This includes your profile picture, bio, audio introduction, location data, interests, and study goals that you choose to provide.\n\n(c) Communication Data: We collect the content of messages, voice recordings, video calls, and corrections you send through the Service.\n\n(d) Usage Data: We automatically collect information about how you interact with the Service, including features used, session duration, and interaction patterns.\n\n(e) Device Information: We collect device type, operating system version, unique device identifiers, IP address, and mobile network information.',
      },
      {
        id: 'how-we-use',
        heading: '3. How We Use Your Information',
        content:
          'We use the information we collect for the following purposes:\n\n(a) To provide, maintain, and improve the Service;\n\n(b) To personalise your experience and match you with suitable language partners;\n\n(c) To enable communication and content sharing between users;\n\n(d) To process transactions and manage subscriptions;\n\n(e) To send administrative notifications about your account and updates to our policies;\n\n(f) To detect, prevent, and address technical issues, fraud, and abuse;\n\n(g) To comply with legal obligations and enforce our Terms of Service.',
      },
      {
        id: 'sharing',
        heading: '4. How We Share Your Information',
        content:
          'We may share your information in the following circumstances:\n\n(a) With other users: Your profile information (excluding email and phone number) is visible to other users as described in your privacy settings.\n\n(b) With service providers: We engage trusted third-party providers for hosting, analytics, payment processing, and customer support, who are contractually bound to protect your data.\n\n(c) For legal reasons: We may disclose information if required by law, regulation, legal process, or governmental request.\n\n(d) Business transfers: In connection with a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.',
      },
      {
        id: 'data-retention',
        heading: '5. Data Retention',
        content:
          'We retain your personal information for as long as your account is active or as needed to provide you the Service. If you delete your account, we will delete or anonymise your data within 30 days, except where we are required to retain certain information by law or for legitimate business purposes such as fraud prevention.',
      },
      {
        id: 'data-rights',
        heading: '6. Your Data Protection Rights',
        content:
          'Depending on your jurisdiction, you may have the following rights regarding your personal data:\n\n(a) Right of Access: You may request a copy of the personal data we hold about you.\n\n(b) Right of Rectification: You may request correction of inaccurate or incomplete data.\n\n(c) Right of Erasure: You may request deletion of your personal data, subject to legal retention requirements.\n\n(d) Right of Portability: You may request a structured, machine-readable copy of your data to transfer to another service.\n\n(e) Right to Object: You may object to the processing of your personal data in certain circumstances.\n\n(f) Right to Withdraw Consent: You may withdraw your consent at any time, without affecting the lawfulness of processing based on consent before withdrawal.\n\nTo exercise any of these rights, please use the GDPR tools in the App Settings or contact us at privacy@hellotalk.com.',
      },
      {
        id: 'cookies',
        heading: '7. Cookies and Tracking Technologies',
        content:
          'We may use cookies and similar tracking technologies to personalise content, analyse usage patterns, and remember your preferences. You can configure your browser or device settings to reject cookies; however, some features of the Service may not function properly without them.',
      },
      {
        id: 'children',
        heading: '8. Children\'s Privacy',
        content:
          'The Service is not intended for children under the age of 13, and we do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information from our records.',
      },
      {
        id: 'international',
        heading: '9. International Data Transfers',
        content:
          'Your information may be transferred to and processed in countries other than the one in which you reside. We use appropriate safeguards, including Standard Contractual Clauses, to ensure that your data receives an adequate level of protection wherever it is processed.',
      },
      {
        id: 'security',
        heading: '10. Data Security',
        content:
          'We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, alteration, disclosure, or destruction. These measures include encryption of data in transit and at rest, secure access controls, and regular security assessments.',
      },
      {
        id: 'third-party',
        heading: '11. Third-Party Services',
        content:
          'The Service may contain links to third-party websites or services that are not owned or controlled by HelloTalk. We are not responsible for the privacy practices or content of these third parties. We encourage you to review the privacy policies of any third-party services you access.',
      },
      {
        id: 'changes',
        heading: '12. Changes to This Privacy Policy',
        content:
          'We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on the Service and updating the "Last Updated" date. We will also notify you via the Service or by email for significant changes. Your continued use of the Service after such modifications constitutes your acknowledgment of the updated policy.',
      },
      {
        id: 'contact',
        heading: '13. Contact Us',
        content:
          'If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:\n\nEmail: privacy@hellotalk.com\n\nIn-app: Settings > Support Centre',
      },
    ],
  };

  getDocument(type: 'tos' | 'privacy'): LegalDocument | null {
    if (type === 'tos') return this.termsOfService;
    if (type === 'privacy') return this.privacyPolicy;
    return null;
  }
}