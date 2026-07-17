import json
import statistics
import time
from typing import Any

from app.experiment.context import ExperimentContext
from app.experiment.stages.base import ExperimentStage
from app.providers.generation import (
    create_generation_provider,
)


SYSTEM_INSTRUCTIONS = """
Eres un asistente especializado en responder preguntas
utilizando exclusivamente el contexto recuperado.

Reglas:
1. Responde en español.
2. Utiliza únicamente la información incluida en el contexto.
3. No inventes información.
4. Si el contexto no permite responder con seguridad, indícalo.
5. Da una respuesta clara, directa y breve.
""".strip()


def build_rag_prompt(
    question: str,
    contexts: list[dict[str, Any]],
) -> str:
    context_blocks: list[str] = []

    for item in contexts:
        rank = item.get("rank", len(context_blocks) + 1)
        filename = (
            item.get("metadata", {}).get("filename")
            or "documento desconocido"
        )
        text = str(item.get("text") or "")

        context_blocks.append(
            f"[Contexto {rank} — {filename}]\n{text}"
        )

    joined_contexts = "\n\n".join(context_blocks)

    return (
        f"{SYSTEM_INSTRUCTIONS}\n\n"
        f"CONTEXTO RECUPERADO:\n"
        f"{joined_contexts}\n\n"
        f"PREGUNTA:\n{question}\n\n"
        f"RESPUESTA:"
    )


class GenerationStage(ExperimentStage):
    name = "generation"

    async def execute(
        self,
        context: ExperimentContext,
    ) -> None:
        if not context.retrieval_results:
            raise ValueError(
                "No existen resultados de recuperación "
                "para generar respuestas."
            )

        configuration = context.version.configuration[
            "generation"
        ]

        provider_name = configuration["provider"]
        model_name = configuration["model"]
        temperature = float(
            configuration["temperature"]
        )

        provider = create_generation_provider(
            provider=provider_name,
            model=model_name,
        )

        generation_started = time.perf_counter()

        generation_results: list[dict[str, Any]] = []
        prompts_manifest: list[dict[str, Any]] = []
        latencies_ms: list[int] = []

        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_provider_duration_ns = 0
        total_load_duration_ns = 0
        total_prompt_eval_duration_ns = 0
        total_eval_duration_ns = 0

        for retrieval_result in context.retrieval_results:
            question = retrieval_result["question"]
            contexts = retrieval_result["contexts"]

            if not contexts:
                raise ValueError(
                    "No se recuperaron contextos para la pregunta "
                    f"{retrieval_result['question_id']}."
                )

            prompt = build_rag_prompt(
                question=question,
                contexts=contexts,
            )

            question_started = time.perf_counter()

            generated = await provider.generate(
                prompt=prompt,
                temperature=temperature,
            )

            latency_ms = int(
                (
                    time.perf_counter()
                    - question_started
                )
                * 1000
            )

            latencies_ms.append(latency_ms)

            total_prompt_tokens += (
                generated.prompt_eval_count
            )
            total_completion_tokens += (
                generated.eval_count
            )
            total_provider_duration_ns += (
                generated.total_duration_ns
            )
            total_load_duration_ns += (
                generated.load_duration_ns
            )
            total_prompt_eval_duration_ns += (
                generated.prompt_eval_duration_ns
            )
            total_eval_duration_ns += (
                generated.eval_duration_ns
            )

            prompts_manifest.append(
                {
                    "question_id": retrieval_result[
                        "question_id"
                    ],
                    "question": question,
                    "prompt": prompt,
                }
            )

            generation_results.append(
                {
                    "question_id": retrieval_result[
                        "question_id"
                    ],
                    "order_index": retrieval_result[
                        "order_index"
                    ],
                    "question": question,
                    "expected_answer": retrieval_result[
                        "expected_answer"
                    ],
                    "expected_contexts": retrieval_result[
                        "expected_contexts"
                    ],
                    "retrieved_contexts": contexts,
                    "generated_answer": generated.text,
                    "provider": provider_name,
                    "model": generated.model,
                    "temperature": temperature,
                    "latency_ms": latency_ms,
                    "usage": {
                        "prompt_tokens": (
                            generated.prompt_eval_count
                        ),
                        "completion_tokens": (
                            generated.eval_count
                        ),
                        "total_tokens": (
                            generated.prompt_eval_count
                            + generated.eval_count
                        ),
                    },
                    "timings": {
                        "total_duration_ns": (
                            generated.total_duration_ns
                        ),
                        "load_duration_ns": (
                            generated.load_duration_ns
                        ),
                        "prompt_eval_duration_ns": (
                            generated.prompt_eval_duration_ns
                        ),
                        "eval_duration_ns": (
                            generated.eval_duration_ns
                        ),
                    },
                    "done_reason": generated.done_reason,
                }
            )

        generation_duration_ms = int(
            (
                time.perf_counter()
                - generation_started
            )
            * 1000
        )

        generation_directory = (
            context.working_directory / "generation"
        )
        generation_directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        results_path = (
            generation_directory
            / "generation-results.json"
        )

        summary_path = (
            generation_directory
            / "generation-summary.json"
        )

        prompts_path = (
            generation_directory / "prompts.json"
        )

        results_path.write_text(
            json.dumps(
                generation_results,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        prompts_path.write_text(
            json.dumps(
                prompts_manifest,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        question_count = len(generation_results)
        total_tokens = (
            total_prompt_tokens
            + total_completion_tokens
        )

        summary = {
            "provider": provider_name,
            "model": model_name,
            "temperature": temperature,
            "question_count": question_count,
            "generated_answer_count": question_count,
            "generation_duration_ms": (
                generation_duration_ms
            ),
            "mean_latency_ms": (
                statistics.mean(latencies_ms)
                if latencies_ms
                else 0
            ),
            "min_latency_ms": (
                min(latencies_ms)
                if latencies_ms
                else 0
            ),
            "max_latency_ms": (
                max(latencies_ms)
                if latencies_ms
                else 0
            ),
            "prompt_tokens": total_prompt_tokens,
            "completion_tokens": (
                total_completion_tokens
            ),
            "total_tokens": total_tokens,
            "provider_total_duration_ns": (
                total_provider_duration_ns
            ),
            "provider_load_duration_ns": (
                total_load_duration_ns
            ),
            "provider_prompt_eval_duration_ns": (
                total_prompt_eval_duration_ns
            ),
            "provider_eval_duration_ns": (
                total_eval_duration_ns
            ),
            "completion_tokens_per_second": (
                total_completion_tokens
                / (total_eval_duration_ns / 1_000_000_000)
                if total_eval_duration_ns > 0
                else 0
            ),
        }

        summary_path.write_text(
            json.dumps(
                summary,
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        context.generation_results = generation_results

        context.metadata[
            "generation_provider"
        ] = provider_name
        context.metadata[
            "generation_model"
        ] = model_name
        context.metadata[
            "generation_temperature"
        ] = temperature

        context.artifacts[
            "generation"
        ] = generation_directory

        context.metrics[
            "generation_question_count"
        ] = float(question_count)

        context.metrics[
            "generated_answer_count"
        ] = float(question_count)

        context.metrics[
            "generation_duration_ms"
        ] = float(generation_duration_ms)

        context.metrics[
            "generation_mean_latency_ms"
        ] = float(summary["mean_latency_ms"])

        context.metrics[
            "generation_min_latency_ms"
        ] = float(summary["min_latency_ms"])

        context.metrics[
            "generation_max_latency_ms"
        ] = float(summary["max_latency_ms"])

        context.metrics[
            "generation_prompt_tokens"
        ] = float(total_prompt_tokens)

        context.metrics[
            "generation_completion_tokens"
        ] = float(total_completion_tokens)

        context.metrics[
            "generation_total_tokens"
        ] = float(total_tokens)

        context.metrics[
            "generation_completion_tokens_per_second"
        ] = float(
            summary["completion_tokens_per_second"]
        )
