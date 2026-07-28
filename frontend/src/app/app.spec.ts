import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { EconomyStore } from './services/economy.store';
import { CentrifugeService } from './services/centrifuge.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: AuthService,
          useValue: {
            currentUser: signal(null),
            signOut: () => Promise.resolve(),
          },
        },
        {
          provide: EconomyStore,
          useValue: {
            coinsBalance: signal(50),
            activeGiftAnimation: signal(null),
            loadInitialData: () => Promise.resolve(),
          },
        },
        {
          provide: CentrifugeService,
          useValue: {
            connect: () => Promise.resolve(),
            subscribe: () => undefined,
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('HelloTalk');
  });
});
