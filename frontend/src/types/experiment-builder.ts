export type ChunkingStrategy =
  | "recursive"
  | "fixed"
  | "semantic";

export type RetrievalStrategy =
  | "similarity"
  | "mmr";

export type EvaluationMetric =
  | "faithfulness"
  | "answer_relevancy"
  | "context_precision"
  | "context_recall"
  | "latency_ms";

export type PipelineConfiguration = {
  schema_version: string;

  chunking: {
    strategy: ChunkingStrategy;
    chunk_size: number;
    chunk_overlap: number;
  };

  embedding: {
    provider: "ollama";
    model: string;
  };

  retrieval: {
    strategy: RetrievalStrategy;
    top_k: number;
  };

  generation: {
    provider: "ollama";
    model: string;
    temperature: number;
  };

  evaluation: {
    metrics: EvaluationMetric[];
  };
};

export type ExperimentTemplate = {
  template_key: string;
  schema_version: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  configuration: PipelineConfiguration;
  matrix:
    | Record<
        string,
        Array<string | number>
      >
    | null;
};

export type SavedExperimentTemplate = {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  category: string;
  schema_version: string;
  tags: string[];
  configuration: PipelineConfiguration;
  matrix:
    | Record<
        string,
        Array<string | number>
      >
    | null;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
};

export type ExperimentBuilderCorpus = {
  id: string;
  name: string;
  description: string | null;
};

export type ExperimentBuilderDataset = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  status: string;
  question_count: number;
};

export type ExperimentBuilderForm = {
  name: string;
  description: string;
  corpusId: string;
  datasetId: string;
  templateKey: string;
  gitCommit: string;
  configuration: PipelineConfiguration;
};

export type ExperimentBuilderStep =
  | "identity"
  | "template"
  | "configuration"
  | "review";

export type CreatedExperimentVersion = {
  id: string;
  experiment_id: string;
  version_number: number;
  schema_version: string;
  configuration: PipelineConfiguration;
  configuration_hash: string;
  source_template_key: string | null;
  git_commit: string | null;
  created_at: string;
};

export type CreatedExperiment = {
  id: string;
  name: string;
  description: string | null;
  corpus_id: string;
  dataset_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  versions: CreatedExperimentVersion[];
};

export const DEFAULT_PIPELINE_CONFIGURATION: PipelineConfiguration = {
  schema_version: "1.0",

  chunking: {
    strategy: "recursive",
    chunk_size: 512,
    chunk_overlap: 64,
  },

  embedding: {
    provider: "ollama",
    model: "nomic-embed-text",
  },

  retrieval: {
    strategy: "similarity",
    top_k: 5,
  },

  generation: {
    provider: "ollama",
    model: "llama3.1",
    temperature: 0,
  },

  evaluation: {
    metrics: [
      "faithfulness",
      "answer_relevancy",
      "context_precision",
      "context_recall",
      "latency_ms",
    ],
  },
};

export const EMPTY_EXPERIMENT_BUILDER_FORM: ExperimentBuilderForm = {
  name: "",
  description: "",
  corpusId: "",
  datasetId: "",
  templateKey: "",
  gitCommit: "",
  configuration:
    DEFAULT_PIPELINE_CONFIGURATION,
};
