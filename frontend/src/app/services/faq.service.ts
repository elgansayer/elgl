import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FAQ } from '../models/faq.model';

@Injectable({
  providedIn: 'root',
})
export class FaqService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/help`;

  async getFaqs(): Promise<FAQ[]> {
    return firstValueFrom(this.http.get<FAQ[]>(`${this.baseUrl}/faqs`));
  }
}
