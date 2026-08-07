import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, vi } from 'vitest';
import { LinkedAccountsComponent } from './linked-accounts.component';
import { LinkedAccountsService } from '../../../services/linked-accounts.service';
import { I18nService } from '../../../services/i18n.service';

describe('LinkedAccountsComponent', () => {
  let component: LinkedAccountsComponent;
  let fixture: ComponentFixture<LinkedAccountsComponent>;
  let linkedAccountsService: Partial<LinkedAccountsService>;

  beforeEach(async () => {
    linkedAccountsService = {
      getLinkedAccounts: vi.fn().mockResolvedValue([
        { provider: 'google', active: true, created_at: '2024-01-01' },
        { provider: 'email', active: false, created_at: '2024-01-02' },
      ]),
      linkAccount: vi.fn().mockResolvedValue(undefined),
      unlinkAccount: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [LinkedAccountsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LinkedAccountsService, useValue: linkedAccountsService },
        { provide: I18nService, useValue: { translate: vi.fn((k: string) => k) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LinkedAccountsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display supported providers', () => {
    expect(component.supportedProviders.length).toBeGreaterThan(0);
  });

  it('should detect linked providers', () => {
    expect(component.isLinked('google')).toBe(true);
    expect(component.isLinked('email')).toBe(false);
    expect(component.isLinked('facebook')).toBe(false);
  });

  it('should compute linked count', () => {
    expect(component.linkedCount()).toBe(1);
  });

  it('should prevent unlinking the only linked provider', () => {
    expect(component.canUnlink('google')).toBe(false);
    expect(component.canUnlink('email')).toBe(false);
  });

  it('should allow unlinking when multiple providers are linked', async () => {
    (linkedAccountsService.getLinkedAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.canUnlink('google')).toBe(true);
    expect(component.linkedCount()).toBe(2);
  });

  it('should call linkAccount on link', async () => {
    await component.link('facebook');
    expect(linkedAccountsService.linkAccount).toHaveBeenCalledWith('facebook');
  });

  it('should call unlinkAccount on unlink when allowed', async () => {
    (linkedAccountsService.getLinkedAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.unlink('email');
    expect(linkedAccountsService.unlinkAccount).toHaveBeenCalledWith('email');
  });

  it('should not call unlinkAccount when cannot unlink', async () => {
    await component.unlink('google');
    expect(linkedAccountsService.unlinkAccount).not.toHaveBeenCalled();
  });

  it('should handle link error gracefully', async () => {
    (linkedAccountsService.linkAccount as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    await component.link('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });

  it('should handle unlink error gracefully', async () => {
    (linkedAccountsService.getLinkedAccounts as ReturnType<typeof vi.fn>).mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    (linkedAccountsService.unlinkAccount as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    await component.unlink('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });
});
