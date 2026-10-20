import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminAuthContextService } from '../admin-auth-context.service';
import {
  AdminNetworkSecurityService,
  NetworkAllowlistEntry,
  NetworkBlock,
  NetworkBlockScope,
  NetworkImpactPreview,
  NetworkReputation,
} from '../admin-network-security.service';
import { NetworkProviderSecurityComponent } from './network-provider-security.component';

@Component({
  standalone: true,
  imports: [FormsModule, NetworkProviderSecurityComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="network-security-title">
      <p class="eyebrow">Trust & Safety</p>
      <h2 id="network-security-title">Network abuse controls</h2>
      <p>
        Investigate coarse abuse signals without persisting lookup IPs. CIDR controls are temporary,
        bounded and fully audited. Backend authorization remains authoritative.
      </p>

      <div class="grid">
        <section class="card" aria-labelledby="lookup-title">
          <h3 id="lookup-title">IP reputation</h3>
          <label for="ip-lookup">Public IP address</label>
          <input id="ip-lookup" [(ngModel)]="lookupIp" autocomplete="off" spellcheck="false" />
          <button type="button" (click)="lookup()" [disabled]="busy() || !lookupIp.trim()">
            Investigate
          </button>

          @if (reputation(); as result) {
            <div class="result" aria-live="polite">
              <p><strong>Coarse network:</strong> {{ result.network }}</p>
              <p><strong>Risk:</strong> {{ result.riskLevel }}</p>
              <p><strong>Logins:</strong> {{ result.loginEvents24h }} / 24h, {{ result.loginEvents7d }} / 7d</p>
              <p><strong>Observed accounts:</strong> {{ result.uniqueAccounts7d }} / 7d</p>
              <p><strong>Allowlisted:</strong> {{ result.allowlisted ? 'Yes' : 'No' }}</p>
              @if (result.signals.length) {
                <ul aria-label="Risk signals">
                  @for (signalName of result.signals; track signalName) {
                    <li>{{ signalName }}</li>
                  }
                </ul>
              }
            </div>
          }
        </section>

        <section class="card" aria-labelledby="block-title">
          <h3 id="block-title">Temporary block</h3>
          <label for="block-cidr">CIDR or single public IP</label>
          <input id="block-cidr" [(ngModel)]="blockCidr" autocomplete="off" spellcheck="false" />

          <label for="block-scope">Scope</label>
          <select id="block-scope" [(ngModel)]="blockScope" (ngModelChange)="clearPreview()">
            <option value="auth">Authentication</option>
            <option value="write">Writes</option>
            <option value="all">All application requests</option>
          </select>

          <label for="block-hours">Duration in hours (max 720)</label>
          <input id="block-hours" type="number" min="0.1" max="720" step="0.1" [(ngModel)]="blockHours" />

          <label for="block-reason">Reason</label>
          <select id="block-reason" [(ngModel)]="reasonCode">
            <option value="fraud_or_abuse">Fraud or abuse</option>
            <option value="incident_response">Incident response</option>
            <option value="account_security">Account security</option>
            <option value="policy_violation">Policy violation</option>
          </select>

          <label for="block-note">Operator note (optional)</label>
          <textarea id="block-note" maxlength="1000" [(ngModel)]="operatorNote"></textarea>

          <div class="actions">
            <button type="button" (click)="previewBlock()" [disabled]="busy() || !blockCidr.trim()">
              Preview impact
            </button>
            @if (canManage()) {
              <button
                type="button"
                (click)="createBlock()"
                [disabled]="busy() || !previewMatches()"
              >
                Apply temporary block
              </button>
            }
          </div>

          @if (impact(); as preview) {
            <div class="result" aria-live="polite">
              <p><strong>Canonical network:</strong> {{ preview.network }}</p>
              <p><strong>Observed accounts in 30d:</strong> {{ preview.observedAccounts30d }}</p>
              <p><strong>Login events in 30d:</strong> {{ preview.observedLoginEvents30d }}</p>
              @if (preview.allowlistConflicts.length) {
                <p role="alert">
                  Allowlist overlap: {{ preview.allowlistConflicts.join(', ') }}. Allowlist entries override blocks.
                </p>
              }
            </div>
          }
        </section>

        @if (canManage()) {
          <section class="card" aria-labelledby="allowlist-title">
            <h3 id="allowlist-title">Allowlist exception</h3>
            <p>Use only for reviewed networks that must override temporary abuse blocks.</p>
            <label for="allow-cidr">CIDR or single public IP</label>
            <input id="allow-cidr" [(ngModel)]="allowCidr" autocomplete="off" spellcheck="false" />
            <label for="allow-reason">Reviewed reason</label>
            <input id="allow-reason" maxlength="240" [(ngModel)]="allowReason" />
            <button
              type="button"
              (click)="createAllowlist()"
              [disabled]="busy() || !allowCidr.trim() || allowReason.trim().length < 3"
            >
              Add exception
            </button>
          </section>
        }
      </div>

      @if (busy()) {
        <p aria-live="polite">Updating network security data…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }

      <section class="controls" aria-labelledby="active-controls-title">
        <div class="controls-header">
          <h3 id="active-controls-title">Active controls</h3>
          <button type="button" (click)="refreshControls()" [disabled]="busy()">Refresh</button>
        </div>

        <h4>Blocks</h4>
        @if (blocks().length === 0) {
          <p>No active network blocks.</p>
        } @else {
          <ul class="control-list">
            @for (block of blocks(); track block.id) {
              <li>
                <span><strong>{{ block.network }}</strong> · {{ block.scope }} · expires {{ formatDate(block.expiresAt) }}</span>
                @if (canManage()) {
                  <button type="button" (click)="revokeBlock(block)" [disabled]="busy()">Revoke</button>
                }
              </li>
            }
          </ul>
        }

        <h4>Allowlist exceptions</h4>
        @if (allowlist().length === 0) {
          <p>No active network exceptions.</p>
        } @else {
          <ul class="control-list">
            @for (entry of allowlist(); track entry.id) {
              <li>
                <span><strong>{{ entry.network }}</strong> · {{ entry.reason }}</span>
                @if (canManage()) {
                  <button type="button" (click)="revokeAllowlist(entry)" [disabled]="busy()">Revoke</button>
                }
              </li>
            }
          </ul>
        }
      </section>

      <app-network-provider-security />
    </section>
  `,
  styles: [`
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: 1rem; margin-top: 1rem; }
    .card, .controls, .result { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; }
    .card { display: grid; gap: .5rem; align-content: start; }
    .card h3, .controls h3 { margin-block-start: 0; }
    input, select, textarea { box-sizing: border-box; width: 100%; min-height: 2.75rem; font: inherit; }
    textarea { min-height: 5rem; resize: vertical; }
    button { min-height: 2.75rem; }
    .actions, .controls-header { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; justify-content: space-between; }
    .result { margin-top: .5rem; overflow-wrap: anywhere; }
    .control-list { display: grid; gap: .5rem; padding: 0; list-style: none; }
    .control-list li { display: flex; flex-wrap: wrap; gap: .75rem; justify-content: space-between; align-items: center; border-block-end: 1px solid currentColor; padding-block: .5rem; }
    .controls { margin-top: 1rem; }
    @media (max-width: 40rem) { .control-list li > * { width: 100%; } }
  `],
})
export class NetworkSecurityPageComponent {
  private readonly security = inject(AdminNetworkSecurityService);
  private readonly auth = inject(AdminAuthContextService);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly reputation = signal<NetworkReputation | null>(null);
  readonly impact = signal<NetworkImpactPreview | null>(null);
  readonly blocks = signal<NetworkBlock[]>([]);
  readonly allowlist = signal<NetworkAllowlistEntry[]>([]);
  readonly canManage = computed(() =>
    this.auth.hasCapability('security.network.manage'),
  );

  lookupIp = '';
  blockCidr = '';
  blockScope: NetworkBlockScope = 'auth';
  blockHours = 1;
  reasonCode = 'fraud_or_abuse';
  operatorNote = '';
  allowCidr = '';
  allowReason = '';
  private previewInput = '';

  constructor() {
    void this.refreshControls();
  }

  previewMatches(): boolean {
    return (
      !!this.impact() &&
      this.previewInput === `${this.blockCidr.trim()}|${this.blockScope}` &&
      this.blockHours >= 0.1 &&
      this.blockHours <= 720
    );
  }

  clearPreview(): void {
    this.impact.set(null);
    this.previewInput = '';
  }

  async lookup(): Promise<void> {
    await this.run(async () => {
      this.reputation.set(
        await firstValueFrom(this.security.lookup(this.lookupIp.trim())),
      );
    });
  }

  async previewBlock(): Promise<void> {
    const cidr = this.blockCidr.trim();
    await this.run(async () => {
      this.impact.set(
        await firstValueFrom(this.security.preview(cidr, this.blockScope)),
      );
      this.previewInput = `${cidr}|${this.blockScope}`;
    });
  }

  async createBlock(): Promise<void> {
    if (!this.canManage() || !this.previewMatches()) return;
    await this.run(async () => {
      const expiresAt = new Date(
        Date.now() + this.blockHours * 60 * 60 * 1000,
      ).toISOString();
      await firstValueFrom(
        this.security.createBlock({
          cidr: this.blockCidr.trim(),
          scope: this.blockScope,
          reasonCode: this.reasonCode,
          operatorNote: this.operatorNote.trim() || undefined,
          expiresAt,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      this.clearPreview();
      await this.loadControls();
    });
  }

  async createAllowlist(): Promise<void> {
    if (!this.canManage()) return;
    await this.run(async () => {
      await firstValueFrom(
        this.security.createAllowlist({
          cidr: this.allowCidr.trim(),
          reason: this.allowReason.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      this.allowCidr = '';
      this.allowReason = '';
      await this.loadControls();
    });
  }

  async revokeBlock(block: NetworkBlock): Promise<void> {
    if (!this.canManage()) return;
    await this.run(async () => {
      await firstValueFrom(this.security.revokeBlock(block.id));
      await this.loadControls();
    });
  }

  async revokeAllowlist(entry: NetworkAllowlistEntry): Promise<void> {
    if (!this.canManage()) return;
    await this.run(async () => {
      await firstValueFrom(this.security.revokeAllowlist(entry.id));
      await this.loadControls();
    });
  }

  async refreshControls(): Promise<void> {
    await this.run(() => this.loadControls());
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  }

  private async loadControls(): Promise<void> {
    const [blocks, allowlist] = await Promise.all([
      firstValueFrom(this.security.listBlocks()),
      firstValueFrom(this.security.listAllowlist()),
    ]);
    this.blocks.set(blocks);
    this.allowlist.set(allowlist);
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await operation();
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Network security operation failed',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
