import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VersionInfo {
  current: string;
  latest: string;
  updateUrl?: string;
  /** Optional for mixed-version compatibility with backends deployed before the policy field. */
  minimumSupported?: string;
}

@Injectable({ providedIn: 'root' })
export class VersionService {
  private http = inject(HttpClient);

  getVersion(): Observable<VersionInfo> {
    return this.http.get<VersionInfo>(`${environment.apiUrl}/version`);
  }
}
