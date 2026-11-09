import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { ShareCardComponent } from './share-card.component';
import { HtmlSanitisationService } from '../../services/html-sanitisation.service';
import { I18nService } from '../../services/i18n.service';
import type { LinkPreviewShare } from '../../services/chat.service';
import { signal } from '@angular/core';

describe('ShareCardComponent', () => {
  let fixture: ComponentFixture<ShareCardComponent>;

  const share: LinkPreviewShare = {
    entityType: 'tutor',
    entityId: 'tutor-1',
    webUrl: '/profile/tutor-1',
    deepLink: 'hellotalk://profile/tutor-1',
    pricing: {
      ukp: 10,
      usd: 12.5,
      display: '10 UKP / 12.50 USD',
    },
  };

  const i18nMock = {
    translate: (key: string) => {
      const labels: Record<string, string> = {
        'shareCard.badge': 'Shared from HelloTalk',
        'shareCard.type.tutor': 'Tutor',
        'shareCard.openAria': 'Open {{title}} in HelloTalk',
      };
      return labels[key] ?? key;
    },
    direction: signal('ltr'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShareCardComponent],
      providers: [
        provideRouter([]),
        { provide: I18nService, useValue: i18nMock },
        HtmlSanitisationService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareCardComponent);
    fixture.componentRef.setInput('share', share);
    fixture.componentRef.setInput('title', 'Ana Spanish');
    fixture.componentRef.setInput('description', 'Patient Spanish tutor');
    fixture.componentRef.setInput('image', 'https://cdn.example.com/ana.png');
    fixture.detectChanges();
  });

  it('renders an internal link to the in-app entity route', () => {
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe('/profile/tutor-1');
  });

  it('renders the dual-currency price from the backend', () => {
    expect(fixture.nativeElement.textContent).toContain('10 UKP / 12.50 USD');
  });

  it('renders translated type and badge labels', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Shared from HelloTalk');
    expect(text).toContain('Tutor');
  });

  it('renders a safe image and omits unsafe image URLs', () => {
    expect(fixture.nativeElement.querySelector('img')?.src).toBe('https://cdn.example.com/ana.png');

    fixture.componentRef.setInput('image', 'javascript:alert(1)');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('omits the price badge when pricing is unavailable', () => {
    fixture.componentRef.setInput('share', { ...share, pricing: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('UKP');
  });
});
