import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminModerationService } from '../admin-moderation.service';
import { FlaggedMomentsPanelComponent } from './flagged-moments-panel.component';
import { ModerationPageComponent } from './moderation-page.component';

@Component({ selector: 'app-flagged-moments-panel', standalone: true, template: '<p>panel</p>' })
class StubFlaggedMomentsPanelComponent {}

describe('ModerationPageComponent', () => {
  const listReports = vi.fn();
  let fixture: ComponentFixture<ModerationPageComponent>;

  const host = (): HTMLElement => fixture.nativeElement;
  const click = async (label: string) => {
    const button = Array.from(host().querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    button?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    listReports.mockReset();
    listReports.mockReturnValue(
      of({
        reports: [
          {
            id: 'report-1',
            reporter_id: null,
            reported_user_id: 'user-1',
            reason_category: 'spam',
            description: null,
            status: 'pending',
            created_at: '2026-11-09T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ModerationPageComponent],
      providers: [provideRouter([]), { provide: AdminModerationService, useValue: { listReports } }],
    }).overrideComponent(ModerationPageComponent, {
      remove: { imports: [FlaggedMomentsPanelComponent] },
      add: { imports: [StubFlaggedMomentsPanelComponent] },
    });
    fixture = TestBed.createComponent(ModerationPageComponent);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('opens on the flagged Moments queue without reading the member-report list', () => {
    expect(host().querySelector('app-flagged-moments-panel')).not.toBeNull();
    expect(listReports).not.toHaveBeenCalled();
    const pressed = Array.from(host().querySelectorAll('.view-switch button')).map((button) =>
      button.getAttribute('aria-pressed'),
    );
    expect(pressed).toEqual(['false', 'true']);
  });

  it('loads member reports on first view only and keeps them read-only', async () => {
    await click('Member reports');

    expect(listReports).toHaveBeenCalledTimes(1);
    expect(host().querySelector('app-flagged-moments-panel')).toBeNull();
    expect(host().textContent).toContain('Read-only member reports');
    expect(host().textContent).toContain('spam');

    await click('Flagged Moments');
    await click('Member reports');

    expect(listReports).toHaveBeenCalledTimes(1);
  });
});
