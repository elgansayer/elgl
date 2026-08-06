import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateEventModalComponent } from './create-event-modal.component';
import { I18nService } from '../../services/i18n.service';
import { signal } from '@angular/core';

describe('CreateEventModalComponent', () => {
  let component: CreateEventModalComponent;
  let fixture: ComponentFixture<CreateEventModalComponent>;

  beforeEach(async () => {
    const i18nMock = {
      translate: (key: string) => key,
      translations: signal({}),
    };

    await TestBed.configureTestingModule({
      imports: [CreateEventModalComponent],
      providers: [
        { provide: I18nService, useValue: i18nMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CreateEventModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
