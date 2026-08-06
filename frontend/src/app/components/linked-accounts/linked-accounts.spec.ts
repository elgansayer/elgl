import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LinkedAccounts } from './linked-accounts';

describe('LinkedAccounts', () => {
  let component: LinkedAccounts;
  let fixture: ComponentFixture<LinkedAccounts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinkedAccounts],
    }).compileComponents();

    fixture = TestBed.createComponent(LinkedAccounts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
