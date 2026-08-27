import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisitorLogs } from './visitor-logs';

describe('VisitorLogs', () => {
  let component: VisitorLogs;
  let fixture: ComponentFixture<VisitorLogs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisitorLogs],
    }).compileComponents();

    fixture = TestBed.createComponent(VisitorLogs);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
