"""Deterministic preparation of extracted document text for future embedding."""

from dataclasses import dataclass

from app.config.settings import Settings, settings


@dataclass(frozen=True)
class PreparedChunk:
    """An ordered extracted-text segment ready for later persistence and embedding."""

    chunk_index: int
    text: str
    token_count: int
    metadata: dict[str, int]


class ChunkingService:
    """Splits extracted text by paragraph boundaries with configured overlap."""

    def __init__(self, config: Settings = settings) -> None:
        """Create a pure chunking service from validated application settings."""
        if config.chunk_overlap >= config.chunk_size:
            raise ValueError("CHUNK_OVERLAP must be smaller than CHUNK_SIZE")
        self._size = config.chunk_size
        self._overlap = config.chunk_overlap

    def prepare(self, extracted_text: str | None) -> list[PreparedChunk]:
        """Return ordered non-empty chunks without persistence or provider interaction."""
        if not extracted_text or not extracted_text.strip():
            return []
        paragraphs = [part.strip() for part in extracted_text.replace("\r\n", "\n").split("\n\n") if part.strip()]
        chunks: list[PreparedChunk] = []
        current = ""
        for paragraph in paragraphs:
            candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
            if current and len(candidate) > self._size:
                chunks.append(self._chunk(len(chunks), current))
                current = current[-self._overlap:].lstrip() if self._overlap else ""
                candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
            while len(candidate) > self._size:
                chunks.append(self._chunk(len(chunks), candidate[:self._size]))
                candidate = candidate[self._size - self._overlap:].lstrip()
            current = candidate
        if current:
            chunks.append(self._chunk(len(chunks), current))
        return chunks

    @staticmethod
    def _chunk(index: int, text: str) -> PreparedChunk:
        """Build one chunk with stable order and lightweight token estimate metadata."""
        normalized = text.strip()
        token_count = len(normalized.split())
        return PreparedChunk(index, normalized, token_count, {"character_count": len(normalized), "token_estimate": token_count})
