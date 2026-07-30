import { Component, inject } from '@angular/core';
import { DataStorageService } from '../../services/data-storage.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-data-storage',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './data-storage.component.html',
})
export class DataStorageComponent {
  protected dataStorageService = inject(DataStorageService);

  clearCache(): void {
    this.dataStorageService.clearLocalCache();
  }

  toggleCellular(): void {
    this.dataStorageService.toggleCellularAutoDownload();
  }
}
