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
<<<<<<< HEAD
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
=======
  let linkedAccountsService: { getLinkedAccounts: ReturnType<typeof vi.fn>; linkAccount: ReturnType<typeof vi.fn>; unlinkAccount: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    const spy = {
      getLinkedAccounts: vi.fn().mockResolvedValue([
        { provider: 'google', active: true, created_at: '2024-01-01' },
        { provider: 'email', active: false, created_at: '2024-01-02' },
      ]),
      linkAccount: vi.fn().mockResolvedValue(undefined),
      unlinkAccount: vi.fn().mockResolvedValue(undefined),
    };
>>>>>>> origin/main

    await TestBed.configureTestingModule({
      imports: [LinkedAccountsComponent, TranslatePipe],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LinkedAccountsService, useValue: spyLinkedAccountsService },
      ],
    }).compileComponents();

<<<<<<< HEAD
=======
    linkedAccountsService = TestBed.inject(LinkedAccountsService) as typeof linkedAccountsService;
>>>>>>> origin/main
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
<<<<<<< HEAD
    expect(component.isLinked('google')).toBe(true);
    expect(component.isLinked('email')).toBe(false);
    expect(component.isLinked('facebook')).toBe(false);
=======
    expect(component.isLinked('google')).toBeTruthy();
    expect(component.isLinked('email')).toBeFalsy();
    expect(component.isLinked('facebook')).toBeFalsy();
>>>>>>> origin/main
  });

  it('should compute linked count', () => {
    expect(component.linkedCount()).toBe(1);
  });

  it('should prevent unlinking the only linked provider', () => {
<<<<<<< HEAD
    expect(component.canUnlink('google')).toBe(false);
    expect(component.canUnlink('email')).toBe(false);
  });

  it('should allow unlinking when multiple providers are linked', async () => {
    spyLinkedAccountsService.getLinkedAccounts.mockResolvedValue([
=======
    expect(component.canUnlink('google')).toBeFalsy();
    expect(component.canUnlink('email')).toBeFalsy();
  });

  it('should allow unlinking when multiple providers are linked', async () => {
    linkedAccountsService.getLinkedAccounts.mockResolvedValue([
>>>>>>> origin/main
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

<<<<<<< HEAD
    expect(component.canUnlink('google')).toBe(true);
=======
    expect(component.canUnlink('google')).toBeTruthy();
>>>>>>> origin/main
    expect(component.linkedCount()).toBe(2);
  });

  it('should call linkAccount on link', async () => {
<<<<<<< HEAD
=======
    linkedAccountsService.linkAccount.mockResolvedValue(undefined);
>>>>>>> origin/main
    await component.link('facebook');
    expect(spyLinkedAccountsService.linkAccount).toHaveBeenCalledWith('facebook');
  });

  it('should call unlinkAccount on unlink when allowed', async () => {
<<<<<<< HEAD
    spyLinkedAccountsService.getLinkedAccounts.mockResolvedValue([
=======
    linkedAccountsService.getLinkedAccounts.mockResolvedValue([
>>>>>>> origin/main
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

<<<<<<< HEAD
=======
    linkedAccountsService.unlinkAccount.mockResolvedValue(undefined);
>>>>>>> origin/main
    await component.unlink('email');
    expect(spyLinkedAccountsService.unlinkAccount).toHaveBeenCalledWith('email');
  });

  it('should not call unlinkAccount when cannot unlink', async () => {
<<<<<<< HEAD
=======
    linkedAccountsService.unlinkAccount.mockResolvedValue(undefined);
>>>>>>> origin/main
    await component.unlink('google');
    expect(spyLinkedAccountsService.unlinkAccount).not.toHaveBeenCalled();
  });

  it('should handle link error gracefully', async () => {
<<<<<<< HEAD
    spyLinkedAccountsService.linkAccount.mockRejectedValue(new Error('Network error'));
    await component.link('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });

  it('should handle unlink error gracefully', async () => {
    spyLinkedAccountsService.getLinkedAccounts.mockResolvedValue([
=======
    linkedAccountsService.linkAccount.mockRejectedValue(new Error('Network error'));
    await component.link('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBeFalsy();
  });

  it('should handle unlink error gracefully', async () => {
    linkedAccountsService.getLinkedAccounts.mockResolvedValue([
>>>>>>> origin/main
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

<<<<<<< HEAD
    spyLinkedAccountsService.unlinkAccount.mockRejectedValue(new Error('Network error'));
    await component.unlink('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBe(false);
=======
    linkedAccountsService.unlinkAccount.mockRejectedValue(new Error('Network error'));
    await component.unlink('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBeFalsy();
>>>>>>> origin/main
  });
});
