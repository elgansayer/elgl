import { describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscoverySkeletonCardComponent } from './discovery-skeleton-card.component';
import { Component, signal } from '@angular/core';

@Component({
  template: `<app-discovery-skeleton-card [index]="index()" />`,
  imports: [DiscoverySkeletonCardComponent],
})
class TestHostComponent {
  readonly index = signal(0);
}

describe('DiscoverySkeletonCardComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, DiscoverySkeletonCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeDefined();
  });

  it('should render skeleton loaders', () => {
    const skeletonEl = fixture.nativeElement.querySelector('app-discovery-skeleton-card');
    const skeletons = skeletonEl.querySelectorAll('app-skeleton-loader');
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  it('should render a circular avatar skeleton', () => {
    const skeletonEl = fixture.nativeElement.querySelector('app-discovery-skeleton-card');
    const avatarSkeleton = skeletonEl.querySelector(
      'app-skeleton-loader[variant="circle"][height="56px"]',
    );
    expect(avatarSkeleton).toBeTruthy();
  });

  it('should render article with aria-hidden', () => {
    const article = fixture.nativeElement.querySelector('app-discovery-skeleton-card article');
    expect(article).toBeTruthy();
    expect(article.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render interest tag skeleton chunks', () => {
    const skeletonEl = fixture.nativeElement.querySelector('app-discovery-skeleton-card');
    const tagSkeletons = skeletonEl.querySelectorAll(
      'app-skeleton-loader[borderRadius="20px"]',
    );
    expect(tagSkeletons.length).toBe(3);
  });

  it('should compute stagger delay from index', () => {
    const component = fixture.nativeElement.querySelector('app-discovery-skeleton-card');
    const article = component.querySelector('article');
    host.index.set(0);
    fixture.detectChanges();
    expect(article.style.animationDelay).toBe('0ms');

    host.index.set(3);
    fixture.detectChanges();
    expect(article.style.animationDelay).toBe('180ms');

    host.index.set(10);
    fixture.detectChanges();
    expect(article.style.animationDelay).toBe('300ms');
  });
});