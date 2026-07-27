import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-update-modal',
  standalone: true,
  templateUrl: './update-modal.component.html',
  styleUrls: ['./update-modal.component.scss'],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(window:scroll)': 'preventScroll($event)',
    '(window:touchmove)': 'preventScroll($event)',
    '(window:wheel)': 'preventScroll($event)',
  },
})
export class UpdateModalComponent {
  @Input() message = 'A new version is available.';
  @Output() dismiss = new EventEmitter<void>();

  /**
   * Prevent any background clicks from reaching elements behind the overlay.
   */
  onDocumentClick(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * Lock scrolling while the modal is visible.
   */
  preventScroll(event: Event) {
    event.preventDefault();
  }

  handleClose(): void {
    this.dismiss.emit();
  }
}
