import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserManagementComponent } from './user-management.component';
import { AdminService, AdminUserSummary } from '../../services/admin.service';
import { Pipe, PipeTransform, Component } from '@angular/core';
import { vi } from 'vitest';
import { TranslatePipe } from '../../services/translate.pipe';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';
import { AppCardComponent } from '../../components/primitives/card/card.component';
import { AppSkeletonLoaderComponent } from '../../components/primitives/skeleton-loader/skeleton-loader.component';

@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string { return value; }
}

@Pipe({ name: 'sanitiseHtml', standalone: true })
class MockSanitiseHtmlPipe implements PipeTransform {
  transform(value: string): string { return value; }
}

@Component({
  selector: 'app-card',
  standalone: true,
  template: '<ng-content></ng-content>'
})
class MockAppCardComponent {}

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  template: ''
})
class MockAppSkeletonLoaderComponent {}

describe('UserManagementComponent', () => {
  let component: UserManagementComponent;
  let fixture: ComponentFixture<UserManagementComponent>;
  let adminServiceMock: any;

  const mockUsers: AdminUserSummary[] = [
    { id: '1', native_languages: [], target_languages: [], is_vip: false, vip_tier: 'free', is_admin: false, coins_balance: 0, study_streak_days: 0, created_at: '' }
  ];

  beforeEach(async () => {
    TestBed.resetTestingModule();
    adminServiceMock = {
      listUsers: vi.fn().mockResolvedValue({ users: mockUsers, total: 1, page: 1, pageSize: 50 }),
      setVipStatus: vi.fn().mockResolvedValue(undefined)
    };

    await TestBed.configureTestingModule({
      imports: [UserManagementComponent, MockAppCardComponent, MockAppSkeletonLoaderComponent],
      providers: [
        { provide: AdminService, useValue: adminServiceMock }
      ]
    })
    .overrideComponent(UserManagementComponent, {
      remove: {
        imports: [
          TranslatePipe,
          SanitiseHtmlPipe,
          AppCardComponent,
          AppSkeletonLoaderComponent,
        ],
      },
      add: { imports: [MockTranslatePipe, MockSanitiseHtmlPipe, MockAppCardComponent, MockAppSkeletonLoaderComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserManagementComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load users on init', async () => {
    fixture.detectChanges(); // triggers ngOnInit
    await fixture.whenStable();
    await vi.waitFor(() => expect(component.isLoading()).toBe(false));
    expect(adminServiceMock.listUsers).toHaveBeenCalled();
    expect(component.users()).toEqual(mockUsers);
    expect(component.isLoading()).toBe(false);
  });

  it('should handle error when loading users', async () => {
    adminServiceMock.listUsers.mockRejectedValue(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(component.isLoading()).toBe(false));

    expect(component.loadError()).toBe(true);
    expect(component.isLoading()).toBe(false);
    consoleSpy.mockRestore();
  });

  it('should toggle VIP status to true', async () => {
    const user = { ...mockUsers[0], is_vip: false };
    const loadUsersSpy = vi.spyOn(component, 'loadUsers');

    await component.toggleVip(user);

    expect(adminServiceMock.setVipStatus).toHaveBeenCalledWith('1', true, 'consumer_8_ukp_10_usd');
    expect(loadUsersSpy).toHaveBeenCalled();
  });

  it('should toggle VIP status to false', async () => {
    const user = { ...mockUsers[0], is_vip: true };
    const loadUsersSpy = vi.spyOn(component, 'loadUsers');

    await component.toggleVip(user);

    expect(adminServiceMock.setVipStatus).toHaveBeenCalledWith('1', false, 'free');
    expect(loadUsersSpy).toHaveBeenCalled();
  });
});
