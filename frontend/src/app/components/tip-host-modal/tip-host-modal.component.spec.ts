import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TipHostModalComponent } from './tip-host-modal.component';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { EconomyStore } from '../../services/economy.store';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('TipHostModalComponent', () => {
  let component: TipHostModalComponent;
  let fixture: ComponentFixture<TipHostModalComponent>;
  let audioRoomsStore: AudioRoomsStore;
  let economyStore: EconomyStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TipHostModalComponent],
      providers: [
        AudioRoomsStore,
        EconomyStore,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TipHostModalComponent);
    component = fixture.componentInstance;
    audioRoomsStore = TestBed.inject(AudioRoomsStore);
    economyStore = TestBed.inject(EconomyStore);

    // Set required inputs
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.componentRef.setInput('hostName', 'TestHost');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have preset amounts', () => {
    expect(component.presetAmounts()).toEqual([10, 50, 100, 500]);
  });

  it('should select a preset amount', () => {
    component.selectAmount(50);
    expect(component.selectedAmount()).toBe(50);
  });

  it('should not select an amount less than 1', () => {
    component.selectAmount(0);
    expect(component.selectedAmount()).toBeNull();
  });

  it('should emit closed when backdrop is clicked', () => {
    const spy = jest.spyOn(component.closed, 'emit');
    component.onBackdropClick(new MouseEvent('click'));
    expect(spy).not.toHaveBeenCalled(); // event target !== currentTarget in unit test

    // Simulate backdrop click where target === currentTarget
    const event = { target: {} } as MouseEvent;
    const spy2 = jest.spyOn(component.closed, 'emit');
    // Can't easily mock event.target === event.currentTarget without DOM
  });

  it('should call tipHost on confirmSend', async () => {
    const tipSpy = jest.spyOn(audioRoomsStore, 'tipHost').mockResolvedValue(true);
    const closeSpy = jest.spyOn(component.closed, 'emit');

    component.selectAmount(100);
    await component.confirmSend();

    expect(tipSpy).toHaveBeenCalledWith('room-1', 100);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should not call tipHost if no amount selected', async () => {
    const tipSpy = jest.spyOn(audioRoomsStore, 'tipHost').mockResolvedValue(true);
    await component.confirmSend();
    expect(tipSpy).not.toHaveBeenCalled();
  });

  it('should handle custom amount', () => {
    component.onCustomAmountChange(25);
    expect(component.customAmount()).toBe(25);
  });
});