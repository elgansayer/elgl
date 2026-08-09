import { TestBed } from '@angular/core/testing';
import { FontScaleService } from './font-scale.service';

describe('FontScaleService', () => {
  let service: FontScaleService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.fontSize = '';
    TestBed.configureTestingModule({});
    service = TestBed.inject(FontScaleService);
  });

  it('should default to a scale factor of 1.0', () => {
    expect(service.scaleFactor()).toBe(1.0);
  });

  it('should restore a previously saved scale factor from localStorage', () => {
    localStorage.setItem('app_font_scale', '110');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(FontScaleService);
    expect(freshService.scaleFactor()).toBe(1.1);
  });

  it('should ignore an out-of-range saved value and fall back to the default', () => {
    localStorage.setItem('app_font_scale', '999');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(FontScaleService);
    expect(freshService.scaleFactor()).toBe(1.0);
  });

  it('should update the scale factor when setScale is called', () => {
    service.setScale(1.2);
    expect(service.scaleFactor()).toBe(1.2);
  });

  it('should apply the scaled font size to the document root in px', () => {
    service.setScale(1.2);
    TestBed.flushEffects();
    expect(document.documentElement.style.fontSize).toBe('19.2px');
  });

  it('should persist the scale factor to localStorage', () => {
    service.setScale(0.8);
    TestBed.flushEffects();
    expect(localStorage.getItem('app_font_scale')).toBe('80');
  });
});
