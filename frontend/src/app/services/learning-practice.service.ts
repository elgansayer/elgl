import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type VerbTense = 'present' | 'past';

export type VerbPersonKey =
  | 'firstSingular'
  | 'secondSingular'
  | 'thirdSingular'
  | 'firstPlural'
  | 'secondPlural'
  | 'thirdPlural';

export type IpaPhonemeType = 'vowel' | 'diphthong' | 'consonant' | 'nasal';

export interface VerbLanguageSummary {
  code: string;
  name: string;
  tenses: VerbTense[];
  verbCount: number;
}

export interface VerbExercise {
  id: string;
  languageCode: string;
  infinitive: string;
  translation: string;
  tense: VerbTense;
  person: VerbPersonKey;
  options: string[];
}

export interface VerbSession {
  languageCode: string;
  languageName: string;
  tense: VerbTense;
  exercises: VerbExercise[];
}

export interface VerbAttemptResult {
  correct: boolean;
  expected: string;
  submitted: string;
  languageCode: string;
}

export interface IpaLanguageSummary {
  code: string;
  name: string;
  phonemeCount: number;
}

export interface IpaPhoneme {
  id: string;
  symbol: string;
  type: IpaPhonemeType;
  example: string;
  description: string;
}

export interface IpaCatalogue {
  languageCode: string;
  languageName: string;
  phonemes: IpaPhoneme[];
}

export interface IpaQuizQuestion {
  id: string;
  symbol: string;
  type: IpaPhonemeType;
  description: string;
  options: string[];
}

export interface IpaQuiz {
  languageCode: string;
  languageName: string;
  questions: IpaQuizQuestion[];
}

export interface IpaAttemptResult {
  correct: boolean;
  expected: string;
  submitted: string;
  languageCode: string;
}

export interface PracticeLanguageProgress {
  languageCode: string;
  total: number;
  correct: number;
}

export interface PracticeProgress {
  total: number;
  correct: number;
  accuracy: number;
  byLanguage: PracticeLanguageProgress[];
}

@Injectable({ providedIn: 'root' })
export class LearningPracticeService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  listVerbLanguages(): Promise<VerbLanguageSummary[]> {
    return firstValueFrom(
      this.http.get<VerbLanguageSummary[]>(
        `${environment.apiUrl}/learning/verb-conjugation/languages`,
        { headers: this.authHeaders() },
      ),
    );
  }

  getVerbSession(
    language: string,
    tense: VerbTense,
    limit = 5,
  ): Promise<VerbSession> {
    const params = new HttpParams()
      .set('language', language)
      .set('tense', tense)
      .set('limit', limit);
    return firstValueFrom(
      this.http.get<VerbSession>(
        `${environment.apiUrl}/learning/verb-conjugation/session`,
        { headers: this.authHeaders(), params },
      ),
    );
  }

  checkVerbAnswer(exerciseId: string, answer: string): Promise<VerbAttemptResult> {
    return firstValueFrom(
      this.http.post<VerbAttemptResult>(
        `${environment.apiUrl}/learning/verb-conjugation/attempts`,
        { exerciseId, answer },
        { headers: this.authHeaders() },
      ),
    );
  }

  getVerbProgress(): Promise<PracticeProgress> {
    return firstValueFrom(
      this.http.get<PracticeProgress>(
        `${environment.apiUrl}/learning/verb-conjugation/progress`,
        { headers: this.authHeaders() },
      ),
    );
  }

  listIpaLanguages(): Promise<IpaLanguageSummary[]> {
    return firstValueFrom(
      this.http.get<IpaLanguageSummary[]>(
        `${environment.apiUrl}/learning/ipa-alphabet/languages`,
        { headers: this.authHeaders() },
      ),
    );
  }

  getIpaCatalogue(language: string): Promise<IpaCatalogue> {
    const params = new HttpParams().set('language', language);
    return firstValueFrom(
      this.http.get<IpaCatalogue>(
        `${environment.apiUrl}/learning/ipa-alphabet/catalogue`,
        { headers: this.authHeaders(), params },
      ),
    );
  }

  getIpaQuiz(language: string, limit = 5): Promise<IpaQuiz> {
    const params = new HttpParams().set('language', language).set('limit', limit);
    return firstValueFrom(
      this.http.get<IpaQuiz>(`${environment.apiUrl}/learning/ipa-alphabet/quiz`, {
        headers: this.authHeaders(),
        params,
      }),
    );
  }

  checkIpaAnswer(exerciseId: string, answer: string): Promise<IpaAttemptResult> {
    return firstValueFrom(
      this.http.post<IpaAttemptResult>(
        `${environment.apiUrl}/learning/ipa-alphabet/attempts`,
        { exerciseId, answer },
        { headers: this.authHeaders() },
      ),
    );
  }

  getIpaProgress(): Promise<PracticeProgress> {
    return firstValueFrom(
      this.http.get<PracticeProgress>(
        `${environment.apiUrl}/learning/ipa-alphabet/progress`,
        { headers: this.authHeaders() },
      ),
    );
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }
}
