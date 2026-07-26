import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GroupParticipant {
  id: string;
  display_name: string;
  avatar_url?: string;
  native_language: string;
  target_languages: string[];
  is_vip: boolean;
}

@Component({
  selector: 'app-group-participant-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './group-participant-drawer.component.html',
  styleUrls: ['./group-participant-drawer.component.scss']
})
export class GroupParticipantDrawerComponent {
  readonly isOpen = input<boolean>(false);
  readonly participants = input<GroupParticipant[]>([]);

  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }
}
