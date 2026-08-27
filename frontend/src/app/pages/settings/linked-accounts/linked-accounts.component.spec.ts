import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LinkedAccountsComponent } from './linked-accounts.component';
import { LinkedAccountsService } from '../../../services/linked-accounts.service';
import { TranslatePipe } from '../../../services/translate.pipe';

describe('LinkedAccountsComponent', () => {
  let component: LinkedAccountsComponent;
  let fixture: ComponentFixture<LinkedAccountsComponent>;
  let linkedAccountsService: {
    getLinkedAccounts: ReturnType<typeof vi.fn>;
    linkAccount: ReturnType<typeof vi.fn>;
    unlinkAccount: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const spy = {
      getLinkedAccounts: vi.fn().mockResolvedValue([
        { provider: 'email', active: true, identity_id: 'email-1' },
        { provider: 'google', active: true, identity_id: 'google-1' },
      ]),
      linkAccount: vi.fn().mockResolvedValue(undefined),
      unlinkAccount: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [LinkedAccountsComponent, TranslatePipe],
      providers: [{ provide: LinkedAccountsService, useValue: spy }],
    }).compileComponents();

    linkedAccountsService = TestBed.inject(
      LinkedAccountsService,
    ) as unknown as typeof linkedAccountsService;
    fixture = TestBed.createComponent(LinkedAccountsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows only providers that the application can truthfully manage', () => {
    expect(component.supportedProviders.map((provider) => provider.id)).toEqual([
      'google',
      'apple',
      'email',
    ]);
  });

  it('detects authoritative linked identities and counts login methods', () => {
    expect(component.isLinked('google')).toBeTruthy();
    expect(component.isLinked('apple')).toBeFalsy();
    expect(component.isLinked('email')).toBeTruthy();
    expect(component.linkedCount()).toBe(2);
  });

  it('allows a social identity to be unlinked when another login method remains', () => {
    expect(component.canUnlink('google')).toBeTruthy();
  });

  it('prevents unlinking the last remaining sign-in method', async () => {
    linkedAccountsService.getLinkedAccounts.mockResolvedValue([
      { provider: 'google', active: true, identity_id: 'google-1' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();

    expect(component.canUnlink('google')).toBeFalsy();
    component.requestUnlink('google');
    expect(component.pendingUnlinkProvider()).toBeNull();
  });

  it('links only a supported social provider and reloads identity state', async () => {
    const reloadSpy = vi.spyOn(component.linkedAccountsResource, 'reload');

    await component.link('apple');

    expect(linkedAccountsService.linkAccount).toHaveBeenCalledWith('apple');
    expect(reloadSpy).toHaveBeenCalled();
    expect(component.successMessage()).toBe('settings.linkedAccounts.linkSuccess');
    expect(component.loading()).toBeFalsy();
  });

  it('requires explicit confirmation before unlinking', async () => {
    component.requestUnlink('google');

    expect(component.pendingUnlinkProvider()).toBe('google');
    expect(linkedAccountsService.unlinkAccount).not.toHaveBeenCalled();

    await component.confirmUnlink();

    expect(linkedAccountsService.unlinkAccount).toHaveBeenCalledWith('google');
    expect(component.pendingUnlinkProvider()).toBeNull();
    expect(component.successMessage()).toBe('settings.linkedAccounts.unlinkSuccess');
  });

  it('cancels unlink confirmation without mutating identity state', () => {
    component.requestUnlink('google');
    component.cancelUnlink();

    expect(component.pendingUnlinkProvider()).toBeNull();
    expect(linkedAccountsService.unlinkAccount).not.toHaveBeenCalled();
  });

  it('keeps unlink retryable after a provider failure', async () => {
    linkedAccountsService.unlinkAccount.mockRejectedValue(new Error('provider unavailable'));
    component.requestUnlink('google');

    await component.confirmUnlink();

    expect(component.errorMessage()).toBe('settings.linkedAccounts.unlinkFailed');
    expect(component.pendingUnlinkProvider()).toBe('google');
    expect(component.loading()).toBeFalsy();
  });

  it('does not leave the UI busy after link failure', async () => {
    linkedAccountsService.linkAccount.mockRejectedValue(new Error('provider unavailable'));

    await component.link('apple');

    expect(component.errorMessage()).toBe('settings.linkedAccounts.linkFailed');
    expect(component.successMessage()).toBe('');
    expect(component.loading()).toBeFalsy();
  });

  it('offers a retry when the initial identity load fails', () => {
    const reloadSpy = vi.spyOn(component.linkedAccountsResource, 'reload');

    component.retryLoad();

    expect(reloadSpy).toHaveBeenCalled();
  });
});
