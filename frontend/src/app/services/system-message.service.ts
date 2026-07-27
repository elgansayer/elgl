import { Injectable, OnDestroy, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';
import Centrifuge from 'centrifuge';

export interface SystemMessage {
  id: string;
  text: string;
  i18nKey?: string;
  i18nArgs?: Record<string, unknown>;
  createdAt: Date;
}

interface SubscriptionContext {
  data: unknown;
}

interface SystemMessageData {
  type?: string;
  text: string;
  i18nKey?: string;
  i18nArgs?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class SystemMessageService implements OnDestroy {
  private centrifuge?: Centrifuge;
  private supabase = inject(SupabaseService);
  readonly messages = signal<SystemMessage[]>([]);

  constructor() {
    this.init();
  }

  private async init() {
    const {
      data: { session },
    } = await this.supabase.getClient().auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const wsUrl = `${environment.centrifugoWsUrl}/connection/websocket`;

    this.centrifuge = new Centrifuge(wsUrl, { token });

    this.centrifuge.subscribe('global_announcements', (ctx: SubscriptionContext) => {
      const rawData = ctx.data;
      if (rawData && typeof rawData === 'object' && 'type' in rawData) {
        const payload = rawData as SystemMessageData;
        if (payload.type === 'system_message') {
          const msg: SystemMessage = {
            id: Date.now().toString(),
            text: payload.text,
            i18nKey: payload.i18nKey,
            i18nArgs: payload.i18nArgs,
            createdAt: new Date(),
          };
          this.messages.update((prev) => [msg, ...prev]);
        }
      }
    });

    this.centrifuge.connect();
  }

  ngOnDestroy(): void {
    if (this.centrifuge) {
      this.centrifuge.disconnect();
    }
  }
}
