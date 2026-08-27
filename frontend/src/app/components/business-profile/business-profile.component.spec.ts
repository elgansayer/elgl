import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslatePipe } from '../../services/translate.pipe';
import { BusinessProfileComponent } from './business-profile.component';

describe('BusinessProfileComponent', () => {
  let component: BusinessProfileComponent;
  let fixture: ComponentFixture<BusinessProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessProfileComponent, TranslatePipe],
    }).compileComponents();

    fixture = TestBed.createComponent(BusinessProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add a catalog item', () => {
    component.addItem();
    expect(component.catalogItems().length).toBe(1);
  });

  it('should remove a catalog item', () => {
    component.addItem();
    const id = component.catalogItems()[0].id;
    component.removeItem(id);
    expect(component.catalogItems().length).toBe(0);
  });
});
