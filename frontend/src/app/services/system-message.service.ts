import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { CentrifugeService } from './centrifuge.service';
import { AuthService } from './auth.service';

export interface SystemMessageBubble {
  id: number;
  text: string;
  i18nKey?: string;
  i18nArgs?: Record<string, unknown>;
}

const BUBBLE_DISPLAY_MS = 6000;

@Injectable({ providedIn: 'root' })
export class SystemMessageService implements OnDestroy {
  private centrifuge = inject(CentrifugeService);
  private auth = inject(AuthService);

  private nextId = 0;
  private channelSubscription: any | null = null;
  private channelName?: string;

  readonly bubbles = signal<SystemMessageBubble[]>([]);

  constructor() {
    this.initChannel();
  }

  private initChannel(): void {
    const user = this.auth.getCurrentUser();
    if (!user?.id) {
      return;
    }
    this.channelName = `user_${user.id}`;
    this.channelSubscription = this.centrifuge.subscribe(
      this.channelName,
      (data: unknown) => {
        const payload = data as {
          type?: string;
          text?: string;
          i18nKey?: string;
          i18nArgs?: Record<string, unknown>;
        } | null;

        if (payload?.type === 'system') {
          this.show(payload.text ?? '', payload.i18nKey, payload.i18nArgs);
        }
      },
    );
  }

  dismiss(id: number): void {
    this.bubbles.update((current) =>
      current.filter((bubble) => bubble.id !== id),
    );
  }

  private show(
    text: string,
    i18nKey?: string,
    i18nArgs?: Record<string, unknown>,
  ): void {
    const id = this.nextId++;
    this.bubbles.update((current) => [
      ...current,
      { id, text, i18nKey, i18nArgs },
    ]);
    setTimeout(() => this.dismiss(id), BUBBLE_DISPLAY_MS);
  }

  ngOnDestroy(): void {
    this.channelSubscription?.unsubscribe?.();
  }
}
