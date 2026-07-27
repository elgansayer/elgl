import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';

@Component({
  selector: 'app-update-modal',
  standalone: true,
  templateUrl: './update-modal.component.html',
  styleUrls: ['./update-modal.component.scss'],
})
export class UpdateModalComponent {
  @Input() message = 'A new version is available.';
  @Output() close = new EventEmitter<void>();

  /**
   * Prevent any background clicks from reaching elements behind the overlay.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    event.stopPropagation();
    event.preventDefault();
  }

  /**
   * Lock scrolling while the modal is visible.
   */
  @HostListener('window:scroll', ['$event'])
  @HostListener('window:touchmove', ['$event'])
  @HostListener('window:wheel', ['$event'])
  preventScroll(event: Event) {
    event.preventDefault();
  }

  handleClose(): void {
    this.close.emit();
  }
}
