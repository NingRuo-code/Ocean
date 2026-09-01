from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

KNOWLEDGE_ROOT = Path(__file__).resolve().parent / "knowledge"


@dataclass(frozen=True)
class KnowledgeEntry:
    id: str
    title: str
    content: str
    source_file: Path


def _parse_entry_block(block: str, source_file: Path, fallback_index: int) -> KnowledgeEntry:
    lines = [line.rstrip() for line in block.splitlines() if line.strip()]
    heading = lines[0].lstrip("#").strip() if lines else f"knowledge-{fallback_index}"
    if "|" in heading:
        entry_id, title = [part.strip() for part in heading.split("|", 1)]
    else:
        entry_id = f"{source_file.stem}-{fallback_index}"
        title = heading
    return KnowledgeEntry(
        id=entry_id,
        title=title,
        content="\n".join(lines[1:]).strip(),
        source_file=source_file,
    )


def load_knowledge_entries(root: Path | None = None) -> list[KnowledgeEntry]:
    root = root or KNOWLEDGE_ROOT
    if not root.exists():
        return []
    entries: list[KnowledgeEntry] = []
    for path in sorted(root.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        blocks = [block.strip() for block in text.split("\n## ") if block.strip()]
        for index, block in enumerate(blocks, 1):
            normalized = block if block.startswith("#") else f"## {block}"
            entries.append(_parse_entry_block(normalized, path, index))
    return entries


def source_files(root: Path | None = None) -> list[str]:
    root = root or KNOWLEDGE_ROOT
    if not root.exists():
        return []
    return [str(path) for path in sorted(root.glob("*.md"))]
