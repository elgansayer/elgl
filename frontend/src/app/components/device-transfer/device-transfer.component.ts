import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { environment } from '../../../environments/environment';

type TransferStatus = 'generating' | 'ready' | 'consuming' | 'done' | 'error';
type CopyStatus = 'idle' | 'copying' | 'copied' | 'error';

@Component({
  imports: [HlmButton],
  selector: 'app-device-transfer',
  template: `
    <main
      class="flex min-h-screen flex-col items-center justify-center bg-surface p-8 text-on-surface"
      aria-labelledby="device-transfer-title"
    >
      <h1 id="device-transfer-title" class="mb-4 text-2xl font-bold">Device Transfer</h1>

      @if (status() === 'generating') {
        <p role="status" aria-live="polite">Generating device link…</p>
      } @else if (status() === 'ready') {
        <p class="mb-2">Open this link on the other device:</p>
        <div class="rounded-lg bg-card p-4 break-all">
          <code>{{ deviceLink() }}</code>
        </div>
        <button
          hlmBtn
          type="button"
          size="touch"
          class="mt-4"
          [disabled]="copyStatus() === 'copying'"
          [attr.aria-busy]="copyStatus() === 'copying' ? 'true' : null"
          (click)="copyLink()"
        >
          @if (copyStatus() === 'copying') {
            Copying…
          } @else if (copyStatus() === 'copied') {
            Copied
          } @else {
            Copy Link
          }
        </button>
        <p class="mt-2 text-sm opacity-70">Link expires in 5 minutes.</p>
        <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
          @if (copyStatus() === 'copied') {
            Device transfer link copied to clipboard.
          } @else if (copyStatus() === 'error') {
            Could not copy the link. Select the link above and copy it manually.
          }
        </p>
      } @else if (status() === 'consuming') {
        <p role="status" aria-live="polite">Transferring session…</p>
      } @else if (status() === 'done') {
        <p class="text-success" role="status" aria-live="polite">
          Account transferred successfully!
        </p>
      } @else if (status() === 'error') {
        <p class="text-danger" role="alert">{{ errorMessage() }}</p>
      }
    </main>
  `,
  styles: [],
})
export class DeviceTransferComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiBase = environment.apiUrl;

  readonly deviceLink = signal('');
  readonly status = signal<TransferStatus>('generating');
  readonly errorMessage = signal('');
  readonly copyStatus = signal<CopyStatus>('idle');

  constructor() {
    if (isPlatformServer(this.platformId)) return;
    const tokenParam = this.route.snapshot.queryParamMap.get('token');
    if (tokenParam) {
      void this.onReceive(tokenParam);
    } else {
      void this.onGenerate();
    }
  }

  private async onGenerate(): Promise<void> {
    try {
      this.status.set('generating');
      const url = await this.authService.generateDeviceLink();
      this.deviceLink.set(url);
      this.copyStatus.set('idle');
      this.status.set('ready');
    } catch {
      this.status.set('error');
      this.errorMessage.set('Failed to generate device link');
    }
  }

  private async onReceive(token: string): Promise<void> {
    this.status.set('consuming');
    try {
      // Call backend to consume the one-time token and obtain a swap JWT.
      const consumeRes = await lastValueFrom(
        this.http.post<{ swapToken: string }>(`${this.apiBase}/transfer/consume`, { token }),
      );
      // Exchange the swap JWT for a real session.
      const swapRes = await lastValueFrom(
        this.http.post<{ access_token: string; refresh_token: string; user_id: string }>(
          `${this.apiBase}/transfer/swap`,
          { swapToken: consumeRes.swapToken },
        ),
      );
      // Use the returned tokens to set the Supabase session on this device.
      const supabase = this.supabaseService.getClient();
      await supabase.auth.setSession({
        access_token: swapRes.access_token,
        refresh_token: swapRes.refresh_token,
      });
      // Reload auth state.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Session was not established');

      // The AuthService listener will pick the session up automatically.
      this.status.set('done');
      setTimeout(() => void this.router.navigate(['/']), 1500);
    } catch {
      this.status.set('error');
      this.errorMessage.set('Transfer failed');
    }
  }

  async copyLink(): Promise<void> {
    const link = this.deviceLink();
    if (this.status() !== 'ready' || !link || this.copyStatus() === 'copying') return;

    this.copyStatus.set('copying');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else if (!this.copyWithTextArea(link)) {
        throw new Error('Clipboard API is unavailable');
      }
      this.copyStatus.set('copied');
    } catch {
      this.copyStatus.set('error');
    }
  }

  private copyWithTextArea(link: string): boolean {
    const textArea = document.createElement('textarea');
    textArea.value = link;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);

    try {
      textArea.select();
      return document.execCommand('copy');
    } finally {
      textArea.remove();
    }
  }
}
