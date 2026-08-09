import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShareModalComponent } from './share-modal';

describe('ShareModalComponent', () => {
  let component: ShareModalComponent;
  let fixture: ComponentFixture<ShareModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShareModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ShareModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
