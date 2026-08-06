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
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
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
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.title.set(target.value);
    }
  }

  onDatetimeChange(event: Event) {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.datetime.set(target.value);
    }
  }

  onLocationChange(event: Event) {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      this.location.set(target.value);
    }
  }

  onDescriptionChange(event: Event) {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.description.set(target.value);
    }
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
