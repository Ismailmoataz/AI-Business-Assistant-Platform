"""Focused citation construction and serialization regressions."""

from uuid import uuid4

from app.services.chat_orchestrator_service import ChatOrchestratorService
from app.services.rag_retrieval_service import RetrievalContext
from app.services.vector_search_service import VectorSearchResult


def _chunk(document_id, chunk_index: int, score: float, title: str = "Shared title") -> VectorSearchResult:
    """Create one typed retrieved chunk with only real repository fields."""
    return VectorSearchResult(
        chunk_id=uuid4(),
        document_id=document_id,
        chunk_index=chunk_index,
        text="retrieved text",
        title=title,
        filename=f"source-{document_id}.pdf",
        similarity_score=score,
    )


def test_citations_deduplicate_chunks_by_document_without_merging_equal_titles() -> None:
    """Citation identity follows document IDs, not non-unique titles or parallel arrays."""
    first_document = uuid4()
    second_document = uuid4()
    retrieval = RetrievalContext(
        chunks=[
            _chunk(first_document, 1, 0.95),
            _chunk(first_document, 3, 0.89),
            _chunk(second_document, 0, 0.84),
        ],
        text="",
    )

    citations = ChatOrchestratorService._citations(retrieval)

    assert [citation.document_id for citation in citations] == [first_document, second_document]
    assert citations[0].chunk_index == 1
    assert citations[0].similarity_score == 0.95
    assert citations[0].as_metadata()["document_id"] == str(first_document)


def test_empty_retrieval_has_no_citations() -> None:
    """Responses without retrieved documents expose an honest empty citation list."""
    assert ChatOrchestratorService._citations(RetrievalContext(chunks=[], text="")) == []
