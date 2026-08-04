import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminUsersComponent } from './admin-users.component';
import { AdminService } from '../../services/admin.service';

describe('AdminUsersComponent', () => {
  let component: AdminUsersComponent;
  let fixture: ComponentFixture<AdminUsersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        {
          provide: AdminService,
          useValue: {
            listUsers: jest.fn().mockResolvedValue({ users: [], total: 0 }),
            getLoginHistory: jest.fn().mockResolvedValue([]),
            setVipStatus: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
