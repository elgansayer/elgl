import { Injectable, signal } from '@angular/core';
import { IncomingCallData } from './incoming-call-modal.component';

@Injectable({
  providedIn: 'root',
})
export class IncomingCallModalService {
  /** Signal holding the current incoming call data, or null if no active call */
  readonly currentCall = signal<IncomingCallData | null>(null);

  /** Show the incoming call modal */
  showCall(callData: IncomingCallData): void {
    this.currentCall.set(callData);
  }

  /** Dismiss the incoming call modal */
  dismissCall(): void {
    this.currentCall.set(null);
  }
}
