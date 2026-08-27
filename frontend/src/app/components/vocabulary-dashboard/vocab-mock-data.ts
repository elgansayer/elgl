export interface VocabCard {
  id: string;
  term: string;
  definition: string;
  example?: string;
  level: number;
}

export const VOCABULARY_MOCK_DECK: readonly VocabCard[] = [
  {
    id: '1',
    term: 'abundant',
    definition: 'existing or available in large quantities; plentiful',
    example: 'Fish are abundant in the lake.',
    level: 1,
  },
  {
    id: '2',
    term: 'benevolent',
    definition: 'well meaning and kindly',
    example: 'She was a benevolent presence at the meeting.',
    level: 2,
  },
  {
    id: '3',
    term: 'candid',
    definition: 'truthful and straightforward; frank',
    example: 'His response was surprisingly candid.',
    level: 2,
  },
  {
    id: '4',
    term: 'diligent',
    definition: 'having or showing care and conscientiousness in one\u2019s work or duties',
    example: 'The diligent student reviewed every lesson.',
    level: 1,
  },
  {
    id: '5',
    term: 'eloquent',
    definition: 'fluent or persuasive in speaking or writing',
    example: 'She gave an eloquent speech about cultural exchange.',
    level: 3,
  },
];
