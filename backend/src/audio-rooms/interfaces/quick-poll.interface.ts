export interface QuickPollResults {
  poll_id: string;
  question: string;
  options: string[];
  votes: number[];
  totalVotes: number;
  is_active: boolean;
  userVote: number | null;
}

export type QuickPollAggregate = Omit<QuickPollResults, 'userVote'>;
