declare module 'node-nlp' {
  export class Language {
    constructor();
    guess(
      text: string,
      whitelist?: string[],
      limit?: number,
    ): Array<{
      alpha3: string;
      alpha2: string;
      language: string;
      score: number;
    }>;
  }
}
