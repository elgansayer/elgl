import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LinkedAccountsComponent } from './linked-accounts.component';
import { LinkedAccountsService } from '../../../services/linked-accounts.service';
import { TranslatePipe } from '../../../services/translate.pipe';

describe('LinkedAccountsComponent', () => {
  let component: LinkedAccountsComponent;
  let fixture: ComponentFixture<LinkedAccountsComponent>;
  let linkedAccountsService: jasmine.SpyObj<LinkedAccountsService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('LinkedAccountsService', [
      'getLinkedAccounts',
      'linkAccount',
      'unlinkAccount',
    ]);
    spy.getLinkedAccounts.and.resolveTo([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: false, created_at: '2024-01-02' },
    ]);

    await TestBed.configureTestingModule({
      imports: [LinkedAccountsComponent, TranslatePipe],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LinkedAccountsService, useValue: spy },
      ],
    }).compileComponents();

    linkedAccountsService = TestBed.inject(LinkedAccountsService) as jasmine.SpyObj<LinkedAccountsService>;
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
    expect(component.isLinked('google')).toBeTrue();
    expect(component.isLinked('email')).toBeFalse();
    expect(component.isLinked('facebook')).toBeFalse();
  });

  it('should compute linked count', () => {
    expect(component.linkedCount()).toBe(1);
  });

  it('should prevent unlinking the only linked provider', () => {
    expect(component.canUnlink('google')).toBeFalse();
    expect(component.canUnlink('email')).toBeFalse();
  });

  it('should allow unlinking when multiple providers are linked', async () => {
    linkedAccountsService.getLinkedAccounts.and.resolveTo([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.canUnlink('google')).toBeTrue();
    expect(component.linkedCount()).toBe(2);
  });

  it('should call linkAccount on link', async () => {
    linkedAccountsService.linkAccount.and.resolveTo();
    await component.link('facebook');
    expect(linkedAccountsService.linkAccount).toHaveBeenCalledWith('facebook');
  });

  it('should call unlinkAccount on unlink when allowed', async () => {
    linkedAccountsService.getLinkedAccounts.and.resolveTo([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    linkedAccountsService.unlinkAccount.and.resolveTo();
    await component.unlink('email');
    expect(linkedAccountsService.unlinkAccount).toHaveBeenCalledWith('email');
  });

  it('should not call unlinkAccount when cannot unlink', async () => {
    linkedAccountsService.unlinkAccount.and.resolveTo();
    await component.unlink('google');
    expect(linkedAccountsService.unlinkAccount).not.toHaveBeenCalled();
  });

  it('should handle link error gracefully', async () => {
    linkedAccountsService.linkAccount.and.rejectWith(new Error('Network error'));
    await component.link('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBeFalse();
  });

  it('should handle unlink error gracefully', async () => {
    linkedAccountsService.getLinkedAccounts.and.resolveTo([
      { provider: 'google', active: true, created_at: '2024-01-01' },
      { provider: 'email', active: true, created_at: '2024-01-02' },
    ]);
    component.linkedAccountsResource.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    linkedAccountsService.unlinkAccount.and.rejectWith(new Error('Network error'));
    await component.unlink('google');
    expect(component.errorMessage()).toBeTruthy();
    expect(component.loading()).toBeFalse();
  });
});
