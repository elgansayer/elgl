import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';

export interface EventData {
  title: string;
  datetime: string;
  location: string;
  description: string;
}

@Component({
  selector: 'app-create-event-modal',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './create-event-modal.component.html',
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class CreateEventModalComponent {
  isOpen = input<boolean>(false);
  closeModal = output<void>();
  createEvent = output<EventData>();

  title = signal('');
  datetime = signal('');
  location = signal('');
  description = signal('');

  onTitleChange(event: Event) {
    this.title.set((event.target as HTMLInputElement).value);
  }

  onDatetimeChange(event: Event) {
    this.datetime.set((event.target as HTMLInputElement).value);
  }

  onLocationChange(event: Event) {
    this.location.set((event.target as HTMLSelectElement).value);
  }

  onDescriptionChange(event: Event) {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  submit() {
    this.createEvent.emit({
      title: this.title(),
      datetime: this.datetime(),
      location: this.location(),
      description: this.description(),
    });
    this.closeModal.emit();
  }
}
