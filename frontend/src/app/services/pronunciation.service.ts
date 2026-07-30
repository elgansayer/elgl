import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PronunciationFeedback {
  score: number;
  phonemeBreakdown: string[];
  overallAssessment: string;
  language: string;
}

@Injectable({ providedIn: 'root' })
export class PronunciationService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/pronunciation/feedback`;

  analyse(
    audioBlob: Blob,
    referenceText?: string,
  ): Observable<PronunciationFeedback> {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    if (referenceText) {
      formData.append('referenceText', referenceText);
    }
    return this.http.post<PronunciationFeedback>(this.apiUrl, formData);
  }
}
