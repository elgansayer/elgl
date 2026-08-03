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
      providers: [provideRouter([]), { provide: DiscoveryService, useValue: mockDiscoveryService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    audioInstances = [];
    TestBed.resetTestingModule();
  });

  async function flush(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function init(): Promise<void> {
    return flush();
  }

  it('should create', async () => {
    await init();
    expect(component).toBeDefined();
  });
});
