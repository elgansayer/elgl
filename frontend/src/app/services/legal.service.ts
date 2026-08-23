import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
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

const MAX_LEGAL_SECTIONS = 64;
const MAX_TITLE_LENGTH = 160;
const MAX_SECTION_ID_LENGTH = 80;
const MAX_HEADING_LENGTH = 240;
const MAX_SECTION_CONTENT_LENGTH = 20_000;
const SECTION_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

@Injectable({ providedIn: 'root' })
export class LegalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/legal`;

  fetchTermsOfService(): Promise<LegalDocument> {
    return this.fetchDocument('terms');
  }

  fetchPrivacyPolicy(): Promise<LegalDocument> {
    return this.fetchDocument('privacy');
  }

  private async fetchDocument(kind: 'terms' | 'privacy'): Promise<LegalDocument> {
    const payload = await firstValueFrom(this.http.get<unknown>(`${this.baseUrl}/${kind}`));
    return this.parseDocument(payload);
  }

  private parseDocument(payload: unknown): LegalDocument {
    if (!this.isRecord(payload)) {
      throw new Error('Invalid legal document response');
    }

    const title = this.readBoundedString(payload['title'], MAX_TITLE_LENGTH);
    const lastUpdated = this.readBoundedString(payload['lastUpdated'], 10);
    const sections = payload['sections'];

    if (!title || !lastUpdated || !this.isIsoCalendarDate(lastUpdated)) {
      throw new Error('Invalid legal document response');
    }

    if (!Array.isArray(sections) || sections.length === 0 || sections.length > MAX_LEGAL_SECTIONS) {
      throw new Error('Invalid legal document response');
    }

    const seenIds = new Set<string>();
    const parsedSections = sections.map((section) => {
      if (!this.isRecord(section)) {
        throw new Error('Invalid legal document response');
      }

      const id = this.readBoundedString(section['id'], MAX_SECTION_ID_LENGTH);
      const heading = this.readBoundedString(section['heading'], MAX_HEADING_LENGTH);
      const content = this.readBoundedString(section['content'], MAX_SECTION_CONTENT_LENGTH);

      if (
        !id ||
        !heading ||
        !content ||
        !SECTION_ID_PATTERN.test(id) ||
        seenIds.has(id)
      ) {
        throw new Error('Invalid legal document response');
      }

      seenIds.add(id);
      return { id, heading, content } satisfies LegalSection;
    });

    return { title, lastUpdated, sections: parsedSections };
  }

  private readBoundedString(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) {
      return null;
    }

    return normalized;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isIsoCalendarDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }
}
