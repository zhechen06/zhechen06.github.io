#!/usr/bin/env python3
"""Update BibTeX accepted dates from Zotero PDF first pages."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from update_publication_ranks import BibEntry, Field, apply_edits, parse_bib_entries


DEFAULT_BIB = Path("content/publications.bib")
DEFAULT_ZOTERO_API = "http://127.0.0.1:23119/api/users/0"
MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}
ACCEPTED_PATTERNS = [
    re.compile(r"\bAccepted[:\s]+(\d{1,2}\s+[A-Za-z]+\s+\d{4})", re.IGNORECASE),
    re.compile(r"\bAccepted[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})", re.IGNORECASE),
    re.compile(r"\bDate accepted[:\s]+(\d{1,2}\s+[A-Za-z]+\s+\d{4})", re.IGNORECASE),
]


@dataclass(frozen=True)
class AcceptDateResult:
    key: str
    title: str
    status: str
    accepted: str
    source: str
    note: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Find accepted dates from Zotero PDF first pages and update content/publications.bib."
    )
    parser.add_argument("--bib", default=DEFAULT_BIB, type=Path)
    parser.add_argument("--zotero-api", default=DEFAULT_ZOTERO_API)
    parser.add_argument("--write", action="store_true", help="Write accepted fields to the BibTeX file.")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing accepted fields.")
    parser.add_argument("--key", action="append", help="Only process selected BibTeX key(s). May be repeated.")
    parser.add_argument("--limit", type=int, help="Maximum number of entries to process.")
    return parser.parse_args()


def clean_text(value: str) -> str:
    return " ".join(value.split())


def field(entry: BibEntry, name: str) -> str:
    value = entry.fields.get(name)
    return value.value.strip() if value else ""


def normalize_title(value: str) -> str:
    value = re.sub(r"\\[A-Za-z]+(?:\[[^\]]*\])?(?:\{([^{}]*)\})?", r"\1", value)
    value = re.sub(r"[^A-Za-z0-9]+", " ", value).lower()
    return " ".join(value.split())


def request_json(url: str, *, timeout: int = 20) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": "homepage-zotero-accept-date-updater"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def zotero_search(api_base: str, query: str) -> list[dict[str, Any]]:
    params = urllib.parse.urlencode(
        {
            "q": query,
            "qmode": "titleCreatorYear",
            "format": "json",
        }
    )
    return request_json(f"{api_base}/items?{params}")


def item_doi(item: dict[str, Any]) -> str:
    return str((item.get("data") or {}).get("DOI") or "").strip().lower()


def item_title(item: dict[str, Any]) -> str:
    return str((item.get("data") or {}).get("title") or "").strip()


def choose_zotero_item(candidates: list[dict[str, Any]], title: str, doi: str) -> dict[str, Any] | None:
    normalized_title = normalize_title(title)
    normalized_doi = doi.lower().strip()

    for item in candidates:
        if normalized_doi and item_doi(item) == normalized_doi:
            return item

    for item in candidates:
        candidate_title = normalize_title(item_title(item))
        if candidate_title and (candidate_title == normalized_title or normalized_title in candidate_title):
            return item

    return candidates[0] if len(candidates) == 1 else None


def attachment_from_item(api_base: str, item: dict[str, Any]) -> dict[str, Any] | None:
    attachment_link = (item.get("links") or {}).get("attachment") or {}
    href = attachment_link.get("href")
    if href:
        return request_json(href)

    key = item.get("key")
    if not key:
        return None

    children = request_json(f"{api_base}/items/{key}/children?format=json")
    for child in children:
        data = child.get("data") or {}
        if data.get("contentType") == "application/pdf" or data.get("filename", "").lower().endswith(".pdf"):
            return child
    return None


def attachment_file_path(attachment: dict[str, Any]) -> Path | None:
    enclosure = (attachment.get("links") or {}).get("enclosure") or {}
    href = enclosure.get("href", "")
    if href.startswith("file://"):
        return Path(urllib.parse.unquote(urllib.parse.urlparse(href).path))
    return None


def extract_pdf_first_page(pdf_path: Path) -> str:
    completed = subprocess.run(
        ["pdftotext", "-f", "1", "-l", "1", str(pdf_path), "-"],
        check=True,
        text=True,
        capture_output=True,
    )
    return completed.stdout


def normalize_date(value: str) -> str | None:
    cleaned = clean_text(value).replace(",", "")
    parts = cleaned.split()
    if len(parts) != 3:
        return None

    if parts[0].isdigit():
        day, month_name, year = parts
    else:
        month_name, day, year = parts

    month = MONTHS.get(month_name.lower())
    if not month or not day.isdigit() or not year.isdigit():
        return None
    return f"{int(year):04d}-{month:02d}-{int(day):02d}"


def parse_accepted_date(first_page_text: str) -> str | None:
    compact = clean_text(first_page_text)
    for pattern in ACCEPTED_PATTERNS:
        match = pattern.search(compact)
        if not match:
            continue
        parsed = normalize_date(match.group(1))
        if parsed:
            return parsed
    return None


def infer_indent(text: str, entry: BibEntry) -> str:
    anchor = entry.fields.get("year") or entry.fields.get("journal") or next(iter(entry.fields.values()), None)
    if anchor:
        line = text[anchor.line_start : anchor.line_end]
        return line[: len(line) - len(line.lstrip())]
    return "  "


def accepted_insertion(text: str, entry: BibEntry, accepted: str) -> tuple[int, int, str]:
    anchor = entry.fields.get("year") or entry.fields.get("journal")
    insert_at = anchor.line_end if anchor else entry.end
    indent = infer_indent(text, entry)
    return insert_at, insert_at, f"{indent}accepted = {{{accepted}}},\n"


def accepted_update(field_value: Field, accepted: str) -> tuple[int, int, str]:
    return field_value.value_start, field_value.value_end, accepted


def process_entry(api_base: str, entry: BibEntry) -> AcceptDateResult:
    title = field(entry, "title")
    doi = field(entry, "doi")
    queries = [query for query in [title, doi] if query]
    if not queries:
        return AcceptDateResult(entry.key, title, "SKIP", "", "", "missing DOI/title")

    item: dict[str, Any] | None = None
    last_error = ""
    for query in queries:
        try:
            candidates = zotero_search(api_base, query)
        except Exception as exc:
            last_error = f"Zotero search failed: {exc}"
            continue
        item = choose_zotero_item(candidates, title, doi)
        if item:
            break
    if not item:
        return AcceptDateResult(entry.key, title, "SKIP", "", "", last_error or "no confident Zotero match")

    try:
        attachment = attachment_from_item(api_base, item)
    except Exception as exc:
        return AcceptDateResult(entry.key, title, "SKIP", "", item.get("key", ""), f"attachment lookup failed: {exc}")

    if not attachment:
        return AcceptDateResult(entry.key, title, "SKIP", "", item.get("key", ""), "no PDF attachment")

    pdf_path = attachment_file_path(attachment)
    if not pdf_path or not pdf_path.exists():
        return AcceptDateResult(entry.key, title, "SKIP", "", item.get("key", ""), "PDF file is unavailable")

    try:
        first_page = extract_pdf_first_page(pdf_path)
    except Exception as exc:
        return AcceptDateResult(entry.key, title, "SKIP", "", str(pdf_path), f"pdftotext failed: {exc}")

    accepted = parse_accepted_date(first_page)
    if not accepted:
        return AcceptDateResult(entry.key, title, "SKIP", "", str(pdf_path), "accepted date not found on first page")

    return AcceptDateResult(entry.key, title, "FOUND", accepted, str(pdf_path), "")


def print_report(results: list[AcceptDateResult], *, write: bool) -> None:
    print(f"Checked {len(results)} BibTeX article entries.")
    print(f"File written: {'yes' if write else 'no (dry run)'}")
    print()
    print("| Key | Status | Accepted | Note |")
    print("|---|---|---:|---|")
    for result in results:
        note = result.note.replace("|", "\\|")
        accepted = result.accepted or ""
        print(f"| {result.key} | {result.status} | {accepted} | {note} |")


def main() -> int:
    args = parse_args()
    text = args.bib.read_text(encoding="utf-8")
    entries = [entry for entry in parse_bib_entries(text) if entry.entry_type == "article"]
    if args.key:
        selected = set(args.key)
        entries = [entry for entry in entries if entry.key in selected]
    if args.limit:
        entries = entries[: args.limit]

    edits: list[tuple[int, int, str]] = []
    results: list[AcceptDateResult] = []

    for entry in entries:
        existing = field(entry, "accepted")
        if existing and not args.overwrite:
            results.append(AcceptDateResult(entry.key, field(entry, "title"), "UNCHANGED", existing, "", "accepted already set"))
            continue

        result = process_entry(args.zotero_api.rstrip("/"), entry)
        existing_field = entry.fields.get("accepted")
        if result.status == "FOUND":
            if existing_field:
                if existing_field.value != result.accepted:
                    edits.append(accepted_update(existing_field, result.accepted))
                    result = AcceptDateResult(entry.key, result.title, "UPDATE", result.accepted, result.source, "")
                else:
                    result = AcceptDateResult(entry.key, result.title, "UNCHANGED", result.accepted, result.source, "same accepted date")
            else:
                edits.append(accepted_insertion(text, entry, result.accepted))
                result = AcceptDateResult(entry.key, result.title, "ADD", result.accepted, result.source, "")
        results.append(result)

    if args.write and edits:
        args.bib.write_text(apply_edits(text, edits), encoding="utf-8")

    print_report(results, write=args.write and bool(edits))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
