import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpCentreComponent } from './help-centre.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';

describe('HelpCentreComponent', () => {
  let component: HelpCentreComponent;
  let fixture: ComponentFixture<HelpCentreComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HelpCentreComponent, HttpClientTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpCentreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
