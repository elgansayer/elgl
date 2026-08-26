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
  NetworkBlockScope,
  NetworkProviderAllowlistEntry,
  NetworkProviderBlock,
  NetworkProviderImpactPreview,
  NetworkProviderReputation,
} from '../admin-network-security.service';

const MAX_ASN = 4_294_967_295;

@Component({
  selector: 'app-network-provider-security',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="provider-controls" aria-labelledby="provider-security-title">
      <p class="eyebrow">Infrastructure intelligence</p>
      <h3 id="provider-security-title">ASN and hosting-provider controls</h3>
      <p>
        Review privacy-minimized, edge-verified infrastructure trends before applying a temporary
        ASN restriction. These aggregates contain no raw IP addresses or account identifiers.
      </p>

      <div class="grid">
        <section class="card" aria-labelledby="provider-lookup-title">
          <h4 id="provider-lookup-title">Provider reputation</h4>
          <label for="provider-asn">Autonomous System Number (ASN)</label>
          <input
            id="provider-asn"
            type="number"
            min="1"
            max="4294967295"
            step="1"
            [(ngModel)]="providerAsn"
            (ngModelChange)="clearPreview()"
          />
          <button type="button" (click)="lookup()" [disabled]="busy() || !validAsn()">
            Investigate ASN
          </button>

          @if (reputation(); as result) {
            <div class="result" aria-live="polite">
              <p><strong>ASN:</strong> {{ result.asn }}</p>
              <p><strong>Provider:</strong> {{ result.provider }}</p>
              <p><strong>Hosting infrastructure:</strong> {{ result.isHostingProvider ? 'Yes' : 'No' }}</p>
              <p><strong>Risk:</strong> {{ result.riskLevel }}</p>
              <p><strong>Observed requests:</strong> {{ result.requestsToday }} today, {{ result.requests7d }} / 7d</p>
              <p><strong>Active days:</strong> {{ result.activeDays7d }} / 7d</p>
              <p><strong>Allowlisted:</strong> {{ result.allowlisted ? 'Yes' : 'No' }}</p>
              @if (result.signals.length) {
                <ul aria-label="Provider risk signals">
                  @for (signalName of result.signals; track signalName) {
                    <li>{{ signalName }}</li>
                  }
                </ul>
              }
            </div>
          }
        </section>

        <section class="card" aria-labelledby="provider-block-title">
          <h4 id="provider-block-title">Temporary ASN restriction</h4>
          <p>Use the ASN above. Preview impact before the restriction can be applied.</p>

          <label for="provider-block-scope">Scope</label>
          <select
            id="provider-block-scope"
            [(ngModel)]="blockScope"
            (ngModelChange)="clearPreview()"
          >
            <option value="auth">Authentication / signup</option>
            <option value="write">Posting and other writes</option>
            <option value="all">All application requests</option>
          </select>

          <label for="provider-block-hours">Duration in hours (max 720)</label>
          <input
            id="provider-block-hours"
            type="number"
            min="0.1"
            max="720"
            step="0.1"
            [(ngModel)]="blockHours"
          />

          <label for="provider-block-reason">Reason</label>
          <select id="provider-block-reason" [(ngModel)]="reasonCode">
            <option value="fraud_or_abuse">Fraud or abuse</option>
            <option value="incident_response">Incident response</option>
            <option value="account_security">Account security</option>
            <option value="policy_violation">Policy violation</option>
          </select>

          <label for="provider-block-note">Operator note (optional)</label>
          <textarea
            id="provider-block-note"
            maxlength="1000"
            [(ngModel)]="operatorNote"
          ></textarea>

          <div class="actions">
            <button type="button" (click)="previewBlock()" [disabled]="busy() || !validAsn()">
              Preview ASN impact
            </button>
            @if (canManage()) {
              <button
                type="button"
                (click)="createBlock()"
                [disabled]="busy() || !previewMatches()"
              >
                Apply temporary ASN restriction
              </button>
            }
          </div>

          @if (impact(); as preview) {
            <div class="result" aria-live="polite">
              <p><strong>ASN:</strong> {{ preview.asn }}</p>
              <p><strong>Provider:</strong> {{ preview.provider }}</p>
              <p><strong>Hosting infrastructure:</strong> {{ preview.isHostingProvider ? 'Yes' : 'No' }}</p>
              <p><strong>Observed requests in 30d:</strong> {{ preview.observedRequests30d }}</p>
              <p><strong>Observed days in 30d:</strong> {{ preview.observedDays30d }}</p>
              @if (preview.allowlisted) {
                <p role="alert">This ASN is allowlisted. The exception overrides an ASN block.</p>
              }
            </div>
          }
        </section>

        @if (canManage()) {
          <section class="card" aria-labelledby="provider-allowlist-title">
            <h4 id="provider-allowlist-title">ASN exception</h4>
            <p>Allowlist the ASN above only after reviewing the provider impact.</p>
            <label for="provider-allow-reason">Reviewed reason</label>
            <input id="provider-allow-reason" maxlength="240" [(ngModel)]="allowReason" />
            <button
              type="button"
              (click)="createAllowlist()"
              [disabled]="busy() || !validAsn() || allowReason.trim().length < 3"
            >
              Add ASN exception
            </button>
          </section>
        }
      </div>

      @if (busy()) {
        <p aria-live="polite">Updating provider security data…</p>
      }
      @if (error()) {
        <p role="alert">{{ error() }}</p>
      }

      <section class="active" aria-labelledby="provider-active-title">
        <div class="active-header">
          <h4 id="provider-active-title">Active ASN controls</h4>
          <button type="button" (click)="refreshControls()" [disabled]="busy()">Refresh</button>
        </div>

        <h5>Restrictions</h5>
        @if (blocks().length === 0) {
          <p>No active ASN restrictions.</p>
        } @else {
          <ul class="control-list">
            @for (block of blocks(); track block.id) {
              <li>
                <span>
                  <strong>AS{{ block.asn }}</strong>
                  @if (block.providerSnapshot) { · {{ block.providerSnapshot }} }
                  · {{ block.scope }} · expires {{ formatDate(block.expiresAt) }}
                </span>
                @if (canManage()) {
                  <button type="button" (click)="revokeBlock(block)" [disabled]="busy()">Revoke</button>
                }
              </li>
            }
          </ul>
        }

        <h5>Exceptions</h5>
        @if (allowlist().length === 0) {
          <p>No active ASN exceptions.</p>
        } @else {
          <ul class="control-list">
            @for (entry of allowlist(); track entry.id) {
              <li>
                <span>
                  <strong>AS{{ entry.asn }}</strong>
                  @if (entry.providerSnapshot) { · {{ entry.providerSnapshot }} }
                  · {{ entry.reason }}
                </span>
                @if (canManage()) {
                  <button type="button" (click)="revokeAllowlist(entry)" [disabled]="busy()">Revoke</button>
                }
              </li>
            }
          </ul>
        }
      </section>
    </section>
  `,
  styles: [`
    .provider-controls { border-block-start: 1px solid currentColor; margin-top: 1.5rem; padding-top: 1.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: 1rem; margin-top: 1rem; }
    .card, .active, .result { border: 1px solid currentColor; border-radius: .75rem; padding: 1rem; }
    .card { display: grid; gap: .5rem; align-content: start; }
    .card h4, .active h4 { margin-block-start: 0; }
    input, select, textarea { box-sizing: border-box; width: 100%; min-height: 2.75rem; font: inherit; }
    textarea { min-height: 5rem; resize: vertical; }
    button { min-height: 2.75rem; }
    .actions, .active-header { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; justify-content: space-between; }
    .result { margin-top: .5rem; overflow-wrap: anywhere; }
    .control-list { display: grid; gap: .5rem; padding: 0; list-style: none; }
    .control-list li { display: flex; flex-wrap: wrap; gap: .75rem; justify-content: space-between; align-items: center; border-block-end: 1px solid currentColor; padding-block: .5rem; }
    .active { margin-top: 1rem; }
    @media (max-width: 40rem) { .control-list li > * { width: 100%; } }
  `],
})
export class NetworkProviderSecurityComponent {
  private readonly security = inject(AdminNetworkSecurityService);
  private readonly auth = inject(AdminAuthContextService);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly reputation = signal<NetworkProviderReputation | null>(null);
  readonly impact = signal<NetworkProviderImpactPreview | null>(null);
  readonly blocks = signal<NetworkProviderBlock[]>([]);
  readonly allowlist = signal<NetworkProviderAllowlistEntry[]>([]);
  readonly canManage = computed(() =>
    this.auth.hasCapability('security.network.manage'),
  );

  providerAsn: number | null = null;
  blockScope: NetworkBlockScope = 'auth';
  blockHours = 1;
  reasonCode = 'fraud_or_abuse';
  operatorNote = '';
  allowReason = '';
  private previewInput = '';

  constructor() {
    void this.refreshControls();
  }

  validAsn(): boolean {
    return (
      Number.isInteger(this.providerAsn) &&
      (this.providerAsn ?? 0) >= 1 &&
      (this.providerAsn ?? 0) <= MAX_ASN
    );
  }

  previewMatches(): boolean {
    return (
      !!this.impact() &&
      this.previewInput === `${this.providerAsn}|${this.blockScope}` &&
      this.blockHours >= 0.1 &&
      this.blockHours <= 720
    );
  }

  clearPreview(): void {
    this.impact.set(null);
    this.previewInput = '';
  }

  async lookup(): Promise<void> {
    const asn = this.asn();
    if (asn === null) return;
    await this.run(async () => {
      this.reputation.set(await firstValueFrom(this.security.lookupProvider(asn)));
    });
  }

  async previewBlock(): Promise<void> {
    const asn = this.asn();
    if (asn === null) return;
    await this.run(async () => {
      this.impact.set(
        await firstValueFrom(this.security.previewProvider(asn, this.blockScope)),
      );
      this.previewInput = `${asn}|${this.blockScope}`;
    });
  }

  async createBlock(): Promise<void> {
    const asn = this.asn();
    if (asn === null || !this.canManage() || !this.previewMatches()) return;
    await this.run(async () => {
      const expiresAt = new Date(
        Date.now() + this.blockHours * 60 * 60 * 1000,
      ).toISOString();
      await firstValueFrom(
        this.security.createProviderBlock({
          asn,
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
    const asn = this.asn();
    if (asn === null || !this.canManage()) return;
    await this.run(async () => {
      await firstValueFrom(
        this.security.createProviderAllowlist({
          asn,
          reason: this.allowReason.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      this.allowReason = '';
      await this.loadControls();
    });
  }

  async revokeBlock(block: NetworkProviderBlock): Promise<void> {
    if (!this.canManage()) return;
    await this.run(async () => {
      await firstValueFrom(this.security.revokeProviderBlock(block.id));
      await this.loadControls();
    });
  }

  async revokeAllowlist(entry: NetworkProviderAllowlistEntry): Promise<void> {
    if (!this.canManage()) return;
    await this.run(async () => {
      await firstValueFrom(this.security.revokeProviderAllowlist(entry.id));
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

  private asn(): number | null {
    return this.validAsn() ? (this.providerAsn as number) : null;
  }

  private async loadControls(): Promise<void> {
    const [blocks, allowlist] = await Promise.all([
      firstValueFrom(this.security.listProviderBlocks()),
      firstValueFrom(this.security.listProviderAllowlist()),
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
        error instanceof Error
          ? error.message
          : 'Provider security operation failed',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
