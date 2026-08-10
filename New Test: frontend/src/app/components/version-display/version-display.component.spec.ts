import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VersionDisplayComponent } from './version-display.component';
import { VersionService } from '../../services/version.service';
import { of } from 'rxjs';

describe('VersionDisplayComponent', () => {
  let component: VersionDisplayComponent;
  let fixture: ComponentFixture<VersionDisplayComponent>;
  let mockVersionService: jasmine.SpyObj<VersionService>;

  beforeEach(async () => {
    mockVersionService = jasmine.createSpyObj('VersionService', ['getVersion']);
    mockVersionService.getVersion.and.returnValue(
      of({ current: '1.0.0', latest: '1.1.0', updateUrl: 'https://example.com' }),
    );

    await TestBed.configureTestingModule({
      declarations: [VersionDisplayComponent],
      providers: [{ provide: VersionService, useValue: mockVersionService }],
    }).compileComponents();

    fixture = TestBed.createComponent(VersionDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should display the current and latest version', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1.0.0');
    expect(compiled.textContent).toContain('1.1.0');
  });

  it('should show update link if update is available', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const link = compiled.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.href).toContain('https://example.com');
  });
});
