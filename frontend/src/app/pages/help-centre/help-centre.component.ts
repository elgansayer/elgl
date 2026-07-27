import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FaqService } from '../../services/faq.service';
import { FAQ } from '../../models/faq.model';

@Component({
  selector: 'app-help-centre',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './help-centre.component.html',
  styleUrl: './help-centre.component.scss'
})
export class HelpCentreComponent implements OnInit {
  private faqService = inject(FaqService);
  faqs = signal<FAQ[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.faqService.getFaqs();
      this.faqs.set(result);
    } catch (e: unknown) {
      let errMsg = 'Failed to load FAQs';
      if (e instanceof Error) {
        errMsg = e.message;
      } else if (typeof e === 'string') {
        errMsg = e;
      }
      this.error.set(errMsg);
    } finally {
      this.loading.set(false);
    }
  }

  trackById(index: number, faq: FAQ): string {
    return faq.id;
  }
}
