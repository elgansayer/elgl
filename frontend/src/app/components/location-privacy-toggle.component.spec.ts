import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LocationPrivacyToggleComponent } from './location-privacy-toggle.component';
import { UserService } from '../services/user.service';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 't'
})
class MockTranslatePipe implements PipeTransform {
  transform(value: string): string {
    return value;
  }
}

describe('LocationPrivacyToggleComponent', () => {
  let component: LocationPrivacyToggleComponent;
  let fixture: ComponentFixture<LocationPrivacyToggleComponent>;
  let userServiceSpy: any;

  beforeEach(async () => {
    userServiceSpy = {
      updatePrivacySettings: vi.fn().mockResolvedValue({})
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LocationPrivacyToggleComponent],
      providers: [
        { provide: UserService, useValue: userServiceSpy }
      ]
    })
    .overrideComponent(LocationPrivacyToggleComponent, {
        set: {
            imports: [MockTranslatePipe]
        }
    })
    .compileComponents();

    fixture = TestBed.createComponent(LocationPrivacyToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call updatePrivacySettings when setting privacy to region', async () => {
    component.setLocationPrivacy('region');
    expect(component.locationPrivacy()).toBe('region');
    expect(userServiceSpy.updatePrivacySettings).toHaveBeenCalledWith({ privacy_hide_exact_location: true });
  });

  it('should call updatePrivacySettings when setting privacy to exact', async () => {
    // Initial value is exact, we set it to region first, then back to exact
    component.setLocationPrivacy('region');
    component.setLocationPrivacy('exact');
    expect(component.locationPrivacy()).toBe('exact');
    expect(userServiceSpy.updatePrivacySettings).toHaveBeenCalledWith({ privacy_hide_exact_location: false });
  });
});
