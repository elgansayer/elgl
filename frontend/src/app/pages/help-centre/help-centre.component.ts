import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FaqService } from '../../services/faq.service';
import { FAQ } from '../../models/faq.model';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-help-centre',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './help-centre.component.html',
  styleUrl: './help-centre.component.scss'
})
export class HelpCentreComponent implements OnInit {
  private faqService = inject(FaqService);
  private i18n = inject(I18nService);
  faqs = signal<FAQ[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.faqService.getFaqs();
      this.faqs.set(result);
    } catch (e: unknown) {
      // Translate the error message so that no raw string ever appears in the UI
      const fallback = 'Failed to load FAQs';
      const translated = this.i18n?.translate('helpCentre.loadError') ?? fallback;
      this.error.set(translated);
    } finally {
      this.loading.set(false);
    }
  }

  trackById(index: number, faq: FAQ): string {
    return faq.id;
  }
}
