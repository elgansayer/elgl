import { Injectable } from '@angular/core';
import { ReportUserModalComponent } from './report-user-modal.component';
import type { SafetyReportTargetType } from '../../services/safety.service';

@Injectable({
  providedIn: 'root',
})
export class ReportUserModalService {
  private modalComponent: ReportUserModalComponent | null = null;

  registerModal(modal: ReportUserModalComponent): void {
    this.modalComponent = modal;
  }

  open(userId: string, contextUrl?: string, targetType: SafetyReportTargetType = 'user'): void {
    this.modalComponent?.open(userId, contextUrl, targetType);
  }
}
