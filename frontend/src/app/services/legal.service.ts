import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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

@Injectable({
  providedIn: 'root',
})
export class LegalService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/legal`;

  async getDocument(type: 'tos' | 'privacy'): Promise<LegalDocument> {
    return firstValueFrom(
      this.http.get<LegalDocument>(`${this.baseUrl}/document/${type}`),
    );
  }
}