import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscoveryComponent } from './discovery.component';
import { DiscoveryService } from '../../services/discovery.service';
import { provideRouter } from '@angular/router';

describe('DiscoveryComponent', () => {
  let component: DiscoveryComponent;
  let fixture: ComponentFixture<DiscoveryComponent>;
  let mockDiscoveryService: { findPartners: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDiscoveryService = {
      findPartners: vi.fn().mockResolvedValue([]),
    };

    await TestBed.configureTestingModule({
      imports: [DiscoveryComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: mockDiscoveryService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
