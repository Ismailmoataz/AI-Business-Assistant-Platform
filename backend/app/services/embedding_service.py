"""Provider-agnostic batch generation of normalized embedding vectors."""

import math
from dataclasses import dataclass
from collections.abc import Sequence

from app.ai.providers import EmbeddingProvider, ProviderFactory
from app.config.settings import Settings, settings


@dataclass(frozen=True)
class GeneratedEmbedding:
    """A normalized vector paired with its original input position and text."""

    input_index: int
    text: str
    vector: list[float]


class EmbeddingService:
    """Batches text through the configured embedding provider without persistence."""

    def __init__(self, provider: EmbeddingProvider | None = None, config: Settings = settings) -> None:
        """Create the service with an injectable provider for future workers and tests."""
        self._provider = provider or ProviderFactory.embeddings(config)
        self._batch_size = config.embedding_batch_size

    async def generate(self, texts: Sequence[str]) -> list[GeneratedEmbedding]:
        """Generate ordered unit-normalized vectors for non-empty input text chunks."""
        indexed = [(index, text) for index, text in enumerate(texts) if text.strip()]
        results: list[GeneratedEmbedding] = []
        for start in range(0, len(indexed), self._batch_size):
            batch = indexed[start:start + self._batch_size]
            vectors = await self._provider.embed([text for _, text in batch])
            if len(vectors) != len(batch):
                raise ValueError("Embedding provider returned an unexpected number of vectors")
            results.extend(GeneratedEmbedding(index, text, self._normalize(vector)) for (index, text), vector in zip(batch, vectors, strict=True))
        return results

    @staticmethod
    def _normalize(vector: Sequence[float]) -> list[float]:
        """Return a finite unit-length vector suitable for cosine similarity storage."""
        values = [float(value) for value in vector]
        magnitude = math.sqrt(sum(value * value for value in values))
        if not values or not math.isfinite(magnitude) or magnitude == 0:
            raise ValueError("Embedding provider returned an invalid vector")
        return [value / magnitude for value in values]
