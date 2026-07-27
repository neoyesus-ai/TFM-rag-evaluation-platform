export type RagConsoleRun = {
  run_id: string;
  experiment_id: string;
  experiment_name: string;
  version_id: string;
  version_number: number;
  corpus_id: string;
  corpus_name: string;
  embedding_provider: string;
  embedding_model: string;
  generation_provider: string;
  generation_model: string;
  status: string;
  created_at: string;
};

export type RagConsoleContextMetadata = Record<
  string,
  unknown
>;

export type RagConsoleRetrievedContext = {
  content?: string;
  text?: string;
  document?: string;
  score?: number;
  distance?: number;
  rank?: number;
  metadata?: RagConsoleContextMetadata;
};

export type RagConsoleQueryRequest = {
  run_id: string;
  question: string;
  top_k?: number;
};

export type RagConsoleQueryResponse = {
  answer: string;
  contexts: RagConsoleRetrievedContext[];
  timings?: Record<string, number>;
  metadata?: Record<string, unknown>;
};
