import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform, signal } from '@angular/core';
import { StreakCounterComponent } from './streak-counter.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('StreakCounterComponent', () => {
  let component: StreakCounterComponent;
  let fixture: ComponentFixture<StreakCounterComponent>;
  let mockSupabaseService: { getDailyStreak: ReturnType<typeof vi.fn> };
  let mockAuthService: { currentUser: ReturnType<typeof signal<{ id: string } | null>> };

  beforeEach(async () => {
    mockSupabaseService = {
      getDailyStreak: vi.fn().mockResolvedValue(5),
    };

    mockAuthService = {
      currentUser: signal({ id: 'current-user-id' }),
    };

    await TestBed.configureTestingModule({
      imports: [StreakCounterComponent],
      providers: [
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    })
      .overrideComponent(StreakCounterComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();
  });

  it('should create', () => {
    fixture = TestBed.createComponent(StreakCounterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should display the daily streak', async () => {
    fixture = TestBed.createComponent(StreakCounterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockSupabaseService.getDailyStreak).toHaveBeenCalledWith('current-user-id');
    expect(fixture.nativeElement.textContent).toContain('5');
  });

  it('should not fetch the streak when no user is signed in', async () => {
    mockAuthService.currentUser.set(null);

    fixture = TestBed.createComponent(StreakCounterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockSupabaseService.getDailyStreak).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('0');
  });
});
