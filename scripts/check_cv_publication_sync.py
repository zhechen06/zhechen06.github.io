#!/usr/bin/env python3
"""Check whether CV journal-paper lists include all BibTeX publications.

This intentionally does not rewrite the CV files. The CV keeps manual item text
and notes, while journal papers are ordered by Zhe Chen's author role group and
impact factor, so the script reports missing BibTeX titles and prints draft
LaTeX items that can be reviewed before insertion.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from update_publication_ranks import BibEntry, parse_bib_entries


DEFAULT_BIB = Path("content/publications.bib")
DEFAULT_EN_CV = Path("public/cv/CV-Zhe-CHEN.tex")
DEFAULT_ZH_CV = Path("public/cv/CV-Zhe-CHEN-Chinese.tex")
SELF_NAMES = {"zhe chen", "chen zhe"}
NAME_OVERRIDES = {
    "Gu Jiefan": "Gu J",
    "Xu Peng": "Xu P",
    "Pang Zhihong": "Pang Z",
    "Chen Yongbao": "Chen Y",
    "Ji Ying": "Ji Y",
    "Chen Zhe": r"\me{Chen Z}",
}


@dataclass(frozen=True)
class Article:
    key: str
    title: str
    authors: str
    year: str
    journal: str
    volume: str
    pages: str
    sciif: str
    cvnote: str
    cvnote_zh: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check that CV journal-paper lists include all content/publications.bib articles."
    )
    parser.add_argument("--bib", default=DEFAULT_BIB, type=Path)
    parser.add_argument("--en-cv", default=DEFAULT_EN_CV, type=Path)
    parser.add_argument("--zh-cv", default=DEFAULT_ZH_CV, type=Path)
    return parser.parse_args()


def field(entry: BibEntry, name: str) -> str:
    value = entry.fields.get(name)
    return value.value if value else ""


def bib_articles(path: Path) -> list[Article]:
    text = path.read_text(encoding="utf-8")
    articles: list[Article] = []
    for entry in parse_bib_entries(text):
        if entry.entry_type != "article":
            continue
        title = field(entry, "title")
        if not title:
            continue
        articles.append(
            Article(
                key=entry.key,
                title=title,
                authors=field(entry, "author"),
                year=field(entry, "year"),
                journal=field(entry, "journal"),
                volume=field(entry, "volume"),
                pages=field(entry, "pages"),
                sciif=field(entry, "sciif"),
                cvnote=field(entry, "cvnote"),
                cvnote_zh=field(entry, "cvnote_zh"),
            )
        )
    return articles


def normalize_title(value: str) -> str:
    value = re.sub(r"\\[A-Za-z]+(?:\[[^\]]*\])?(?:\{([^{}]*)\})?", r"\1", value)
    value = re.sub(r"[^A-Za-z0-9]+", " ", value).lower()
    return " ".join(value.split())


def journal_publication_block(cv_path: Path) -> str:
    text = cv_path.read_text(encoding="utf-8")
    heading_positions = [pos for pos in (text.find("Journal Papers"), text.find("期刊论文")) if pos != -1]
    if not heading_positions:
        raise ValueError(f"Could not find the journal-paper subsection in {cv_path}")
    heading_pos = min(heading_positions)

    begin = text.find(r"\begin{enumerate}", heading_pos)
    if begin == -1:
        raise ValueError(f"Could not find the journal-paper enumerate block in {cv_path}")

    end = text.find(r"\end{enumerate}", begin)
    if end == -1:
        raise ValueError(f"Could not find the end of the journal-paper enumerate block in {cv_path}")

    return text[begin:end]


def missing_articles(articles: list[Article], cv_path: Path) -> list[Article]:
    cv_text = normalize_title(journal_publication_block(cv_path))
    return [article for article in articles if normalize_title(article.title) not in cv_text]


def split_author_marker(name: str) -> tuple[str, bool]:
    name = name.strip()
    return name.rstrip("*").strip(), name.endswith("*")


def initials(given_names: list[str]) -> str:
    parts: list[str] = []
    for name in given_names:
        for chunk in re.split(r"[-.\s]+", name):
            if chunk:
                parts.append(chunk[0].upper())
    return "".join(parts)


def format_author(raw_name: str) -> str:
    base_name, corresponding = split_author_marker(raw_name)
    marker = "*" if corresponding else ""
    if base_name in NAME_OVERRIDES:
        return NAME_OVERRIDES[base_name] + marker
    if base_name.lower() in SELF_NAMES:
        return r"\me{Chen Z}" + marker

    parts = base_name.split()
    if len(parts) < 2:
        return base_name + marker

    last = parts[-1].replace(".", "")
    given_initials = initials(parts[:-1])
    return f"{last} {given_initials}{marker}"


def format_authors(value: str) -> str:
    authors = [format_author(author) for author in value.split(" and ") if author.strip()]
    return ", ".join(authors)


def is_self_corresponding(value: str) -> bool:
    for author in value.split(" and "):
        base_name, corresponding = split_author_marker(author)
        if corresponding and base_name.lower() in SELF_NAMES:
            return True
    return False


def abbreviate_pages(value: str) -> str:
    match = re.fullmatch(r"(\d+)--(\d+)", value.strip())
    if not match:
        return value
    start, end = match.groups()
    common = 0
    for left, right in zip(start, end):
        if left != right:
            break
        common += 1
    return f"{start}--{end[common:] or end}"


def publication_locator(article: Article) -> str:
    pages = abbreviate_pages(article.pages)
    if article.volume and pages:
        return f"{article.year};{article.volume}:{pages}"
    if pages:
        return f"{article.year}:{pages}"
    if article.volume:
        return f"{article.year};{article.volume}"
    return article.year


def draft_cv_item(article: Article, *, zh: bool = False) -> str:
    notes: list[str] = []
    if article.sciif:
        notes.append(f"IF: {article.sciif}")
    if is_self_corresponding(article.authors):
        notes.append("通讯作者" if zh else "Corresponding author")
    custom_note = article.cvnote_zh if zh and article.cvnote_zh else article.cvnote
    if custom_note:
        notes.append(custom_note)
    suffix = f" ({', '.join(notes)})" if notes else ""
    return (
        rf"\item {format_authors(article.authors)}. {article.title}. "
        rf"\journal{{{article.journal}}} {publication_locator(article)}.{suffix}"
    )


def print_missing(label: str, missing: list[Article], *, zh: bool = False) -> None:
    if not missing:
        print(f"{label}: OK")
        return

    print(f"{label}: missing {len(missing)} article(s)")
    for article in missing:
        print(f"- {article.key}: {article.title}")
    print()
    print(f"Draft {label} CV item(s):")
    for article in missing:
        print(draft_cv_item(article, zh=zh))
    print()


def main() -> int:
    args = parse_args()
    articles = bib_articles(args.bib)
    if not articles:
        print(f"No article entries found in {args.bib}", file=sys.stderr)
        return 1

    missing_en = missing_articles(articles, args.en_cv)
    missing_zh = missing_articles(articles, args.zh_cv)

    print(f"Checked {len(articles)} BibTeX article entries.")
    print_missing("English CV", missing_en)
    print_missing("Chinese CV", missing_zh, zh=True)

    if missing_en or missing_zh:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
