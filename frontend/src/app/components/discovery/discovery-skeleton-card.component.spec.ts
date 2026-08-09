import { describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscoverySkeletonCardComponent } from './discovery-skeleton-card.component';

describe('DiscoverySkeletonCardComponent', () => {
  let fixture: ComponentFixture<DiscoverySkeletonCardComponent>;
  let component: DiscoverySkeletonCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscoverySkeletonCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverySkeletonCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render skeleton loaders', () => {
    const element = fixture.nativeElement;
    const skeletons = element.querySelectorAll('app-skeleton-loader');
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  it('should render a circular avatar skeleton', () => {
    const element = fixture.nativeElement;
    const avatarSkeleton = element.querySelector(
      'app-skeleton-loader[variant="circle"][height="56px"]',
    );
    expect(avatarSkeleton).toBeTruthy();
  });

  it('should render article with aria-hidden', () => {
    const article = fixture.nativeElement.querySelector('article');
    expect(article).toBeTruthy();
    expect(article.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render interest tag skeleton chunks', () => {
    const tagSkeletons = fixture.nativeElement.querySelectorAll(
      'app-skeleton-loader[borderRadius="20px"]',
    );
    expect(tagSkeletons.length).toBe(3);
  });

  it('should compute stagger delay from index', () => {
    const article = fixture.nativeElement.querySelector('article');
    // Default index=0: delay=0ms
    expect(component.index()).toBe(0);
    expect(component.staggerDelay()).toBe('0ms');
    expect(article.style.animationDelay).toBe('0ms');
  });
});
