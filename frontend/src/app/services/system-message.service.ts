import { Injectable, OnDestroy, signal } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class SystemMessageService implements OnDestroy {
  private centrifuge: any;
  readonly messages = signal<SystemMessage[]>([]);

  constructor(private supabase: SupabaseService) {
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

    this.centrifuge.subscribe('global_announcements', (ctx: any) => {
      const payload = ctx.data;
      if (payload?.type === 'system_message') {
        const msg: SystemMessage = {
          id: Date.now().toString(),
          text: payload.text,
          i18nKey: payload.i18nKey,
          i18nArgs: payload.i18nArgs,
          createdAt: new Date(),
        };
        this.messages.update((prev) => [msg, ...prev]);
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
