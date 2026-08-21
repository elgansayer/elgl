import { Injectable } from '@angular/core';

/**
 * Manages interactive product tours.
 * Joyride-based tours have been removed. This service is retained as a compat shim.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  startEconomyTour(): void {
    // Tour disabled
  }
}