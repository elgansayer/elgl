import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscoveryComponent } from './discovery.component';
import { DiscoveryService } from '../../services/discovery.service';
import { provideHttpClient } from '@angular/common/http';
import * as toast from '../../services/toast.service';

describe('DiscoveryComponent', () => {
  let component: DiscoveryComponent;
  let fixture: ComponentFixture<DiscoveryComponent>;
  let mockDiscoveryService: any;

  beforeEach(async () => {
    mockDiscoveryService = {
      findPartners: vi.fn().mockResolvedValue([])
    };

    await TestBed.configureTestingModule({
      imports: [DiscoveryComponent],
      providers: [
        { provide: DiscoveryService, useValue: mockDiscoveryService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('notImplemented should show toast', () => {
    component.notImplemented();
    expect(toast.toastsSignal().length).toBeGreaterThan(0);
  });
});
