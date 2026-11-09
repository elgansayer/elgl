import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import type { LinkPreviewShare, ShareEntityType, SharePricing } from './chat.service';

export interface SharePreview extends LinkPreviewShare {
  title: string;
  description: string;
  imageUrl: string | null;
  siteName: string;
  shareUrl: string;
}

export interface ShareLink {
  entityType: ShareEntityType;
  entityId: string;
  shareUrl: string;
  webUrl: string;
  deepLink: string;
}

export type { ShareEntityType, SharePricing };

@Service()
export class SharingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/sharing`;

  getPreview(entityType: ShareEntityType, entityId: string): Promise<SharePreview> {
    return firstValueFrom(
      this.http.get<SharePreview>(
        `${this.apiUrl}/preview/${entityType}/${encodeURIComponent(entityId)}`,
      ),
    );
  }

  createShareLink(entityType: ShareEntityType, entityId: string): Promise<ShareLink> {
    return firstValueFrom(
      this.http.get<ShareLink>(`${this.apiUrl}/link/${entityType}/${encodeURIComponent(entityId)}`),
    );
  }
}
