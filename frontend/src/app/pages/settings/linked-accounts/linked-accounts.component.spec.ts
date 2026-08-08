import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { LinkedAccountsComponent } from './linked-accounts.component';
import { TranslatePipe } from '../../../services/translate.pipe';

describe('LinkedAccountsComponent', () => {
  let component: LinkedAccountsComponent;
  let fixture: ComponentFixture<LinkedAccountsComponent>;
  let getLinkedAccountsSpy: ReturnType<typeof vi.fn>;
  let linkAccountSpy: ReturnType<typeof vi.fn>;
  let unlinkAccountSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getLinkedAccountsSpy = vi.fn().mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: false, created_at: '2024-01-02' },
    ]);
    linkAccountSpy = vi.fn().mockResolvedValue(undefined);
    unlinkAccountSpy = vi.fn().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [LinkedAccountsComponent, TranslatePipe],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LinkedAccountsService,
          useValue: {
            getLinkedAccounts: getLinkedAccountsSpy,
            linkAccount: linkAccountSpy,
            unlinkAccount: unlinkAccountSpy,
          },
        },
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
    expect(component.isLinked('google')).toBeTruthy();
    expect(component.isLinked('email')).toBeFalsy();
    expect(component.isLinked('facebook')).toBeFalsy();
  });

  it('should compute linked count', () => {
    expect(component.linkedCount()).toBe(1);
  });

  it('should prevent unlinking the only linked provider', () => {
    expect(component.canUnlink('google')).toBeFalsy();
    expect(component.canUnlink('email')).toBeFalsy();
  });

  it('should allow unlinking when multiple providers are linked', async () => {
    getLinkedAccountsSpy.mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.canUnlink('google')).toBeTruthy();
    expect(component.linkedCount()).toBe(2);
  });

  it('should call linkAccount on link', async () => {
    await component.link('facebook');
    expect(linkAccountSpy).toHaveBeenCalledWith('facebook');
  });

  it('should call unlinkAccount on unlink when allowed', async () => {
    getLinkedAccountsSpy.mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.unlink('email');
    expect(unlinkAccountSpy).toHaveBeenCalledWith('email');
  });

  it('should not call unlinkAccount when cannot unlink', async () => {
    await component.unlink('google');
    expect(unlinkAccountSpy).not.toHaveBeenCalled();
  });

  it('should handle link error gracefully', async () => {
    linkAccountSpy.mockRejectedValue(new Error('Network error'));
    await component.link('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBeFalsy();
  });

  it('should handle unlink error gracefully', async () => {
    getLinkedAccountsSpy.mockResolvedValue([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    unlinkAccountSpy.mockRejectedValue(new Error('Network error'));
    await component.unlink('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBeFalsy();
  });
});
