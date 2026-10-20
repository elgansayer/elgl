export interface AssertionState {
  passed: number;
  total: number;
}

export type AssertCheckFn = (
  name: string,
  condition: boolean,
  details?: string,
) => void;
