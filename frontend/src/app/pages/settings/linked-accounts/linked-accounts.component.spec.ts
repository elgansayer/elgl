import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LinkedAccountsComponent } from './linked-accounts.component';
import { LinkedAccountsService } from '../../../services/linked-accounts.service';
import { TranslatePipe } from '../../../services/translate.pipe';
import { vi } from 'vitest';

describe('LinkedAccountsComponent', () => {
  let component: LinkedAccountsComponent;
  let fixture: ComponentFixture<LinkedAccountsComponent>;
  let spyLinkedAccountsService: {
    getLinkedAccounts: ReturnType<typeof vi.fn>;
    linkAccount: ReturnType<typeof vi.fn>;
    unlinkAccount: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    spyLinkedAccountsService = {
      getLinkedAccounts: vi.fn(),
      linkAccount: vi.fn(),
      unlinkAccount: vi.fn(),
    };
    spyLinkedAccountsService.getLinkedAccounts.mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: false, created_at: '2024-01-02' },
    ]);
    spyLinkedAccountsService.linkAccount.mockResolvedValue(undefined);
    spyLinkedAccountsService.unlinkAccount.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [LinkedAccountsComponent, TranslatePipe],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LinkedAccountsService, useValue: spyLinkedAccountsService },
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
    spyLinkedAccountsService.getLinkedAccounts.mockResolvedValue([
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
    expect(spyLinkedAccountsService.linkAccount).toHaveBeenCalledWith('facebook');
  });

  it('should call unlinkAccount on unlink when allowed', async () => {
    spyLinkedAccountsService.getLinkedAccounts.mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.unlink('email');
    expect(spyLinkedAccountsService.unlinkAccount).toHaveBeenCalledWith('email');
  });

  it('should not call unlinkAccount when cannot unlink', async () => {
    await component.unlink('google');
    expect(spyLinkedAccountsService.unlinkAccount).not.toHaveBeenCalled();
  });

  it('should handle link error gracefully', async () => {
    spyLinkedAccountsService.linkAccount.mockRejectedValue(new Error('Network error'));
    await component.link('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });

  it('should handle unlink error gracefully', async () => {
    spyLinkedAccountsService.getLinkedAccounts.mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    spyLinkedAccountsService.unlinkAccount.mockRejectedValue(new Error('Network error'));
    await component.unlink('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });
});
