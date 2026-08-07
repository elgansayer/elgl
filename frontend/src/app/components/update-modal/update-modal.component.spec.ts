import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { UpdateModalComponent } from './update-modal.component';

@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('UpdateModalComponent', () => {
  let component: UpdateModalComponent;
  let fixture: ComponentFixture<UpdateModalComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [UpdateModalComponent],
    })
      .overrideComponent(UpdateModalComponent, {
        set: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UpdateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the update button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button');
    expect(button).toBeTruthy();
  });

  it('should render with default message input', () => {
    expect(component.message()).toBe('A new version is available.');
  });

  it('should block scroll events', () => {
    const event = new Event('scroll');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    component.preventScroll(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});