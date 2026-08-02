import { Component, inject, OnInit } from '@angular/core';
import { VersionService, VersionInfo } from '../../services/version.service';
import { signal } from '@angular/core';

@Component({
  selector: 'app-version-display',
  templateUrl: './version-display.component.html',
  styleUrls: ['./version-display.component.css'],
})
export class VersionDisplayComponent implements OnInit {
  private versionService = inject(VersionService);
  readonly versionInfo = signal<VersionInfo | null>(null);

  ngOnInit(): void {
    this.versionService.getVersion().subscribe((version) => {
      this.versionInfo.set(version);
    });
  }

  get updateAvailable(): boolean {
    const version = this.versionInfo();
    return version ? version.current !== version.latest : false;
  }
}
