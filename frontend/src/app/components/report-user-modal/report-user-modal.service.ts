import { Injectable } from '@angular/core';
import { ReportUserModalComponent } from './report-user-modal.component';

@Injectable({
  providedIn: 'root',
})
export class ReportUserModalService {
  private modalComponent: ReportUserModalComponent | null = null;

  registerModal(modal: ReportUserModalComponent): void {
    this.modalComponent = modal;
  }

  open(userId: string): void {
    this.modalComponent?.open(userId);
  }
}
