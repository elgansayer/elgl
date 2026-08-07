import { describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscoverySkeletonCardComponent } from './discovery-skeleton-card.component';

describe('DiscoverySkeletonCardComponent', () => {
  let fixture: ComponentFixture<DiscoverySkeletonCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscoverySkeletonCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverySkeletonCardComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeDefined();
  });

  it('should render skeleton loaders', () => {
    const skeletons = fixture.nativeElement.querySelectorAll('app-skeleton-loader');
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  it('should render a circular avatar skeleton', () => {
    const avatarSkeleton = fixture.nativeElement.querySelector(
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
});