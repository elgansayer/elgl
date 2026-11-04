import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { EconomyStore } from '../../services/economy.store';
import { I18nService } from '../../services/i18n.service';
import { TipHostModalComponent } from './tip-host-modal.component';

describe('TipHostModalComponent', () => {
  let component: TipHostModalComponent;
  let fixture: ComponentFixture<TipHostModalComponent>;
  const tipHost = vi.fn<(roomId: string, amount: number, requestId: string) => Promise<boolean>>();
  const coinsBalance = signal(200);

  beforeEach(async () => {
    tipHost.mockReset();
    coinsBalance.set(200);
    await TestBed.configureTestingModule({
      imports: [TipHostModalComponent],
      providers: [
        { provide: AudioRoomsStore, useValue: { tipHost } },
        { provide: EconomyStore, useValue: { coinsBalance } },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) =>
              params?.['amount'] === undefined ? key : `${key}:${params['amount']}`,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TipHostModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('roomId', 'room-1');
    fixture.componentRef.setInput('hostName', 'Test Host');
    await fixture.whenStable();
  });

  it('renders an accessible dialog with logical directional styles', () => {
    const title = document.getElementById(component.titleId);
    const dialog = title?.closest('[role="dialog"]') as HTMLElement | null;
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.outerHTML).not.toMatch(/\b(?:pl|pr|ml|mr|left|right|border-l|border-r)-/);
  });

  it('delegates focus, Escape and backdrop behaviour to the Spartan dialog', () => {
    const title = document.getElementById(component.titleId);
    const panel = title?.closest('.rounded-sheet') as HTMLElement | null;
    const closeControls = panel?.querySelectorAll('[data-slot="dialog-close"]');

    expect(panel).not.toBeNull();
    expect(panel?.classList.contains('shadow-lift')).toBe(true);
    expect(closeControls?.length).toBe(2);
  });

  it('selects only positive preset amounts', () => {
    component.selectAmount(50);
    expect(component.selectedAmount()).toBe(50);

    component.selectAmount(0);
    expect(component.selectedAmount()).toBe(50);
  });

  it('submits one stable UUID and closes after success', async () => {
    tipHost.mockResolvedValueOnce(true);
    const closeSpy = vi.spyOn(component.closed, 'emit');
    component.selectAmount(100);

    await component.confirmSend();

    expect(tipHost).toHaveBeenCalledWith('room-1', 100, expect.any(String));
    expect(tipHost.mock.calls[0]?.[2]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(closeSpy).toHaveBeenCalledOnce();
  });

  it('stays open and reuses the request key after a failed delivery', async () => {
    tipHost.mockResolvedValue(false);
    const closeSpy = vi.spyOn(component.closed, 'emit');
    component.selectAmount(50);

    await component.confirmSend();
    await component.confirmSend();

    expect(tipHost).toHaveBeenCalledTimes(2);
    expect(tipHost.mock.calls[0]?.[2]).toBe(tipHost.mock.calls[1]?.[2]);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('uses a fresh request key after the amount changes', async () => {
    tipHost.mockResolvedValue(false);
    component.selectAmount(10);
    await component.confirmSend();
    const firstKey = tipHost.mock.calls[0]?.[2];

    component.selectAmount(100);
    await component.confirmSend();

    expect(tipHost.mock.calls[1]?.[2]).not.toBe(firstKey);
  });

  it('disables submission when the selected tip exceeds the balance', async () => {
    coinsBalance.set(20);
    component.selectAmount(50);
    await fixture.whenStable();

    const title = document.getElementById(component.titleId);
    const panel = title?.closest('.rounded-sheet');
    const sendButton = panel?.querySelector(
      'button[aria-label="audioRoom.tipSendAria:50"]',
    ) as HTMLButtonElement | null;
    expect(sendButton?.disabled).toBe(true);
  });

  it('emits close for a dialog-originated dismissal', () => {
    const closeSpy = vi.spyOn(component.closed, 'emit');

    component.onDialogStateChanged('closed');

    expect(closeSpy).toHaveBeenCalledOnce();
  });

  it('does not close the dialog while a tip is in flight', () => {
    const closeSpy = vi.spyOn(component.closed, 'emit');
    component.isSending.set(true);

    component.onDialogStateChanged('closed');

    expect(closeSpy).not.toHaveBeenCalled();
  });
});
