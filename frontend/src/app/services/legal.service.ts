import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class LegalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/legal`;

  async fetchTermsOfService(): Promise<LegalDocument> {
    return firstValueFrom(
      this.http.get<LegalDocument>(`${this.baseUrl}/terms`),
    );
  }

  async fetchPrivacyPolicy(): Promise<LegalDocument> {
    return firstValueFrom(
      this.http.get<LegalDocument>(`${this.baseUrl}/privacy`),
    );
  }
}