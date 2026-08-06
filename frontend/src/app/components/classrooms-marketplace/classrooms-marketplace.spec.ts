import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassroomsMarketplace } from './classrooms-marketplace';

describe('ClassroomsMarketplace', () => {
  let component: ClassroomsMarketplace;
  let fixture: ComponentFixture<ClassroomsMarketplace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClassroomsMarketplace],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassroomsMarketplace);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
