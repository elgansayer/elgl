import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  imports: [HlmButton],
  selector: 'app-device-transfer',
  template: `
    <div
      class="flex flex-col items-center justify-center min-h-screen p-8 bg-surface text-on-surface"
    >
      <h1 class="text-2xl font-bold mb-4">Device Transfer</h1>

      @if (status() === 'generating') {
        <p>Generating device link…</p>
      } @else if (status() === 'ready') {
        <p class="mb-2">Open this link on the other device:</p>
        <div class="bg-card p-4 rounded-lg break-all">
          <code>{{ deviceLink() }}</code>
        </div>
        <button
          hlmBtn
          class="mt-4 px-6 py-2 bg-accent text-on-fill rounded-full"
          (click)="copyLink()"
        >
          Copy Link
        </button>
        <p class="mt-2 text-sm opacity-70">Link expires in 5 minutes.</p>
      } @else if (status() === 'consuming') {
        <p>Transferring session…</p>
      } @else if (status() === 'done') {
        <p class="text-success">Account transferred successfully!</p>
      } @else if (status() === 'error') {
        <p class="text-danger">{{ errorMessage() }}</p>
      }
    </div>
  `,
  styles: [],
})
export class DeviceTransferComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);
  private platformId = inject(PLATFORM_ID);

  readonly deviceLink = signal<string>('');
  readonly status = signal<'generating' | 'ready' | 'consuming' | 'done' | 'error'>('generating');
  readonly errorMessage = signal<string>('');

  constructor() {
    if (isPlatformServer(this.platformId)) return;
    const tokenParam = this.route.snapshot.queryParamMap.get('token');
    if (tokenParam) {
      this.onReceive(tokenParam);
    } else {
      this.onGenerate();
    }
  }

  private async onGenerate(): Promise<void> {
    try {
      this.status.set('generating');
      const url = await this.authService.generateDeviceLink();
      this.deviceLink.set(url);
      this.status.set('ready');
    } catch (e: unknown) {
      this.status.set('error');
      this.errorMessage.set(e instanceof Error ? e.message : 'Failed to generate device link');
    }
  }

  private async onReceive(token: string): Promise<void> {
    this.status.set('consuming');
    try {
      // Call backend to consume the one‑time token and obtain a swap JWT
      const consumeRes = await lastValueFrom(
        this.http.post<{ swapToken: string }>('/api/transfer/consume', { token }),
      );
      // Exchange the swap JWT for a real session
      const swapRes = await lastValueFrom(
        this.http.post<{ access_token: string; refresh_token: string; user_id: string }>(
          '/api/transfer/swap',
          { swapToken: consumeRes.swapToken },
        ),
      );
      // Use the returned tokens to set the Supabase session on this device
      const supabase = this.supabaseService.getClient();
      await supabase.auth.setSession({
        access_token: swapRes.access_token,
        refresh_token: swapRes.refresh_token,
      });
      // Reload auth state
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        // The AuthService listener will pick it up automatically
        this.status.set('done');
        setTimeout(() => this.router.navigate(['/']), 1500);
      } else {
        throw new Error('Failed to establish session');
      }
    } catch (e: unknown) {
      this.status.set('error');
      this.errorMessage.set(e instanceof Error ? e.message : 'Transfer failed');
    }
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.deviceLink());
    } catch {
      // fallback – copy via old‑style execCommand
      const ta = document.createElement('textarea');
      ta.value = this.deviceLink();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }
}
