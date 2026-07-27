import { Component, OnDestroy, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  SystemMessageService,
  SystemMessage,
} from '../../services/system-message.service';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

interface BubbleMessage {
  id: number;
  text: string;
  i18nKey?: string;
  i18nArgs?: Record<string, unknown>;
}

@Component({
  selector: 'app-system-message-bubble',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './system-message-bubble.component.html',
})
export class SystemMessageBubbleComponent implements OnInit, OnDestroy {
  private systemMessageService = inject(SystemMessageService);
  private cdr = inject(ChangeDetectorRef);

  bubbles: BubbleMessage[] = [];
  private sub!: Subscription;
  private nextId = 0;

  ngOnInit(): void {
    this.sub = this.systemMessageService.messages$.subscribe((msg: SystemMessage) => {
      const id = this.nextId++;
      this.bubbles.push({
        id,
        text: msg.text,
        i18nKey: msg.i18nKey,
        i18nArgs: msg.i18nArgs,
      });

      this.cdr.detectChanges();

      setTimeout(() => {
        this.bubbles = this.bubbles.filter((b) => b.id !== id);
        this.cdr.detectChanges();
      }, 6000);
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  dismiss(id: number): void {
    this.bubbles = this.bubbles.filter((b) => b.id !== id);
  }
}
