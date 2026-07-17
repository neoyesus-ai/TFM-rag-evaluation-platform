from dataclasses import dataclass


@dataclass
class TextChunk:
    chunk_id: str
    document_id: str
    filename: str
    position: int
    text: str
    character_count: int


def fixed_size_chunking(
    text: str,
    document_id: str,
    filename: str,
    chunk_size: int,
    chunk_overlap: int,
) -> list[TextChunk]:
    if chunk_size <= 0:
        raise ValueError("chunk_size debe ser mayor que cero.")

    if chunk_overlap < 0:
        raise ValueError("chunk_overlap no puede ser negativo.")

    if chunk_overlap >= chunk_size:
        raise ValueError(
            "chunk_overlap debe ser menor que chunk_size."
        )

    chunks: list[TextChunk] = []
    start = 0
    position = 0
    text_length = len(text)

    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunk_text = text[start:end].strip()

        if chunk_text:
            chunk_id = f"{document_id}:{position}"

            chunks.append(
                TextChunk(
                    chunk_id=chunk_id,
                    document_id=document_id,
                    filename=filename,
                    position=position,
                    text=chunk_text,
                    character_count=len(chunk_text),
                )
            )

            position += 1

        if end >= text_length:
            break

        start = end - chunk_overlap

    return chunks


def recursive_chunking(
    text: str,
    document_id: str,
    filename: str,
    chunk_size: int,
    chunk_overlap: int,
) -> list[TextChunk]:
    separators = [
        "\n\n",
        "\n",
        ". ",
        " ",
    ]

    pieces = [text]

    for separator in separators:
        new_pieces: list[str] = []

        for piece in pieces:
            if len(piece) <= chunk_size:
                new_pieces.append(piece)
                continue

            split_parts = piece.split(separator)

            for index, part in enumerate(split_parts):
                if index < len(split_parts) - 1:
                    new_pieces.append(part + separator)
                else:
                    new_pieces.append(part)

        pieces = new_pieces

    merged: list[str] = []
    current = ""

    for piece in pieces:
        if len(current) + len(piece) <= chunk_size:
            current += piece
            continue

        if current.strip():
            merged.append(current.strip())

        current = piece

    if current.strip():
        merged.append(current.strip())

    chunks: list[TextChunk] = []

    for position, chunk_text in enumerate(merged):
        if position > 0 and chunk_overlap > 0:
            previous = merged[position - 1]
            overlap_text = previous[-chunk_overlap:]
            chunk_text = overlap_text + chunk_text

        chunk_id = f"{document_id}:{position}"

        chunks.append(
            TextChunk(
                chunk_id=chunk_id,
                document_id=document_id,
                filename=filename,
                position=position,
                text=chunk_text,
                character_count=len(chunk_text),
            )
        )

    return chunks


def create_chunks(
    text: str,
    document_id: str,
    filename: str,
    strategy: str,
    chunk_size: int,
    chunk_overlap: int,
) -> list[TextChunk]:
    if strategy == "fixed":
        return fixed_size_chunking(
            text=text,
            document_id=document_id,
            filename=filename,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    if strategy == "recursive":
        return recursive_chunking(
            text=text,
            document_id=document_id,
            filename=filename,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    raise ValueError(
        f"Estrategia de chunking no implementada: {strategy}"
    )
