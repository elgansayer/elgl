import { Injectable, OnDestroy, inject } from '@angular/core';
import { Subject } from 'rxjs';
import Centrifuge from 'centrifuge';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';

export interface SystemMessage {
  text: string;
  i18nKey?: string;
  i18nArgs?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class SystemMessageService implements OnDestroy {
  private supabase = inject(SupabaseService);

  private centrifuge!: Centrifuge;
  private messageSubject = new Subject<SystemMessage>();
  readonly messages$ = this.messageSubject.asObservable();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const {
      data: { session },
    } = await this.supabase.getClient().auth.getSession();
    const token = session?.access_token;
    if (!token) {
      console.warn('SystemMessageService: no session token yet');
      return;
    }

    const wsUrl = `${environment.centrifugoWsUrl}/connection/websocket`;

    this.centrifuge = new Centrifuge(wsUrl, { token });

    this.centrifuge.on('connected', () => {
      console.log('SystemMessageService connected');
    });

    const channel = 'global_announcements';
    const sub = this.centrifuge.newSubscription(channel);

    sub.on('publication', (ctx) => {
      const data = ctx.data as {
        type?: string;
        text: string;
        i18nKey?: string;
        i18nArgs?: Record<string, unknown>;
      };
      if (data.type === 'system_message') {
        this.messageSubject.next({
          text: data.text,
          i18nKey: data.i18nKey,
          i18nArgs: data.i18nArgs,
        });
      }
    });

    sub.subscribe();
    this.centrifuge.connect();
  }

  ngOnDestroy(): void {
    this.centrifuge?.disconnect();
  }
}
