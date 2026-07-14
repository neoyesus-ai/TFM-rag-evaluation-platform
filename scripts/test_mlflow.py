import json
import os
import tempfile
from pathlib import Path

import mlflow


tracking_uri = os.getenv(
    "MLFLOW_TRACKING_URI",
    "http://localhost:5000",
)

experiment_name = "tfm-rag-smoke-tests"

mlflow.set_tracking_uri(tracking_uri)
mlflow.set_experiment(experiment_name)

configuration = {
    "chunking_strategy": "recursive",
    "chunk_size": 512,
    "chunk_overlap": 64,
    "embedding_model": "nomic-embed-text",
    "retrieval_strategy": "similarity",
    "top_k": 5,
    "llm_model": "llama3.1",
    "temperature": 0.0,
}

with mlflow.start_run(
    run_name="infrastructure-smoke-test",
    tags={
        "project": "TFM-rag-evaluation-platform",
        "run_type": "smoke-test",
        "environment": "development",
    },
) as run:
    mlflow.log_params(configuration)

    mlflow.log_metrics(
        {
            "faithfulness": 0.88,
            "answer_relevancy": 0.84,
            "context_precision": 0.81,
            "context_recall": 0.79,
            "latency_ms": 1325.0,
        }
    )

    with tempfile.TemporaryDirectory() as temp_dir:
        artifact_path = Path(temp_dir) / "configuration.json"

        artifact_path.write_text(
            json.dumps(configuration, indent=2),
            encoding="utf-8",
        )

        mlflow.log_artifact(
            str(artifact_path),
            artifact_path="configuration",
        )

    print(f"experiment_id={run.info.experiment_id}")
    print(f"run_id={run.info.run_id}")
    print(f"artifact_uri={run.info.artifact_uri}")
