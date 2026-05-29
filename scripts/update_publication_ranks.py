#!/usr/bin/env python3
"""Update publication SCI quartiles and impact factors from EasyScholar.

The script reads content/publications.bib, looks up each unique journal through
EasyScholar's open API, updates the custom `sci` and `sciif` fields in place,
and prints a before/after comparison table.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


API_URL = "https://www.easyscholar.cc/open/getPublicationRank"
SECRET_ENV = "EASY_SCHOLAR_SECRET_KEY"
MIN_REQUEST_DELAY = 0.5
FIELD_RE = re.compile(r"([A-Za-z][A-Za-z0-9_-]*)\s*=\s*", re.ASCII)
ENTRY_RE = re.compile(r"@(?P<type>\w+)\s*\{\s*(?P<key>[^,\s]+)\s*,", re.ASCII)


@dataclass(frozen=True)
class Field:
    name: str
    value: str
    value_start: int
    value_end: int
    line_start: int
    line_end: int


@dataclass(frozen=True)
class BibEntry:
    key: str
    entry_type: str
    start: int
    end: int
    fields: dict[str, Field]


@dataclass(frozen=True)
class RankInfo:
    sci: str
    sciif: str


@dataclass(frozen=True)
class EntryComparison:
    key: str
    journal: str
    before_sci: str
    before_sciif: str
    after_sci: str
    after_sciif: str

    @property
    def changed(self) -> bool:
        return self.before_sci != self.after_sci or self.before_sciif != self.after_sciif


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch update sci/sciif in content/publications.bib from EasyScholar."
    )
    parser.add_argument(
        "--bib",
        default="content/publications.bib",
        type=Path,
        help="BibTeX file to update. Default: content/publications.bib",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the comparison without writing changes.",
    )
    parser.add_argument(
        "--delay",
        default=MIN_REQUEST_DELAY,
        type=float,
        help="Delay in seconds between EasyScholar requests. Values below 0.5 are raised to 0.5 to respect the 2 requests/second API limit. Default: 0.5",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional path for writing the Markdown comparison report.",
    )
    return parser.parse_args()


def find_matching_entry_brace(text: str, open_brace: int) -> int:
    depth = 0
    in_quote = False
    escaped = False

    for index in range(open_brace, len(text)):
        char = text[index]
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            in_quote = not in_quote
            continue
        if in_quote:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index

    raise ValueError(f"Unclosed BibTeX entry starting at offset {open_brace}")


def parse_braced_value(text: str, value_start: int) -> tuple[str, int, int]:
    depth = 1
    cursor = value_start + 1
    while cursor < len(text) and depth:
        if text[cursor] == "{":
            depth += 1
        elif text[cursor] == "}":
            depth -= 1
        cursor += 1

    if depth:
        raise ValueError(f"Unclosed braced value starting at offset {value_start}")

    return text[value_start + 1 : cursor - 1], value_start + 1, cursor - 1


def parse_quoted_value(text: str, value_start: int) -> tuple[str, int, int]:
    cursor = value_start + 1
    escaped = False
    value_chars: list[str] = []

    while cursor < len(text):
        char = text[cursor]
        if escaped:
            value_chars.append(char)
            escaped = False
        elif char == "\\":
            escaped = True
        elif char == '"':
            return "".join(value_chars), value_start + 1, cursor
        else:
            value_chars.append(char)
        cursor += 1

    raise ValueError(f"Unclosed quoted value starting at offset {value_start}")


def parse_bare_value(text: str, value_start: int, entry_end: int) -> tuple[str, int, int]:
    cursor = value_start
    while cursor < entry_end and text[cursor] not in ",\r\n":
        cursor += 1
    return text[value_start:cursor].strip(), value_start, cursor


def parse_fields(text: str, body_start: int, entry_end: int) -> dict[str, Field]:
    fields: dict[str, Field] = {}
    cursor = body_start

    while cursor < entry_end:
        match = FIELD_RE.search(text, cursor, entry_end)
        if not match:
            break

        name = match.group(1).lower()
        value_start = match.end()
        while value_start < entry_end and text[value_start].isspace():
            value_start += 1

        if value_start >= entry_end:
            break
        if text[value_start] == "{":
            value, content_start, content_end = parse_braced_value(text, value_start)
            cursor = content_end + 1
        elif text[value_start] == '"':
            value, content_start, content_end = parse_quoted_value(text, value_start)
            cursor = content_end + 1
        else:
            value, content_start, content_end = parse_bare_value(text, value_start, entry_end)
            cursor = content_end

        line_start = text.rfind("\n", 0, match.start()) + 1
        next_line = text.find("\n", content_end, entry_end)
        line_end = entry_end if next_line == -1 else next_line + 1
        fields[name] = Field(
            name=name,
            value=" ".join(value.split()),
            value_start=content_start,
            value_end=content_end,
            line_start=line_start,
            line_end=line_end,
        )

    return fields


def parse_bib_entries(text: str) -> list[BibEntry]:
    entries: list[BibEntry] = []

    for match in ENTRY_RE.finditer(text):
        open_brace = text.find("{", match.start())
        entry_end = find_matching_entry_brace(text, open_brace)
        body_start = text.find(",", open_brace, entry_end) + 1
        entries.append(
            BibEntry(
                key=match.group("key"),
                entry_type=match.group("type").lower(),
                start=match.start(),
                end=entry_end,
                fields=parse_fields(text, body_start, entry_end),
            )
        )

    return entries


def fetch_rank(secret_key: str, journal: str) -> RankInfo:
    query = urllib.parse.urlencode({"secretKey": secret_key, "publicationName": journal})
    request = urllib.request.Request(
        f"{API_URL}?{query}",
        headers={"User-Agent": "Mozilla/5.0 publication-rank-updater"},
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if payload.get("code") != 200:
        raise RuntimeError(f"{journal}: EasyScholar returned {payload.get('code')} {payload.get('msg')}")

    official = (payload.get("data") or {}).get("officialRank") or {}
    selected = official.get("select") or {}
    all_rank = official.get("all") or {}
    sci = selected.get("sci", all_rank.get("sci", ""))
    sciif = selected.get("sciif", all_rank.get("sciif", ""))
    return RankInfo(sci=str(sci or "").strip(), sciif=str(sciif or "").strip())


def unique_journals(entries: list[BibEntry]) -> list[str]:
    journals = {
        entry.fields["journal"].value
        for entry in entries
        if entry.entry_type == "article" and "journal" in entry.fields
    }
    return sorted(journals)


def fetch_all_ranks(journals: list[str], secret_key: str, delay: float) -> dict[str, RankInfo]:
    ranks: dict[str, RankInfo] = {}
    for index, journal in enumerate(journals):
        ranks[journal] = fetch_rank(secret_key, journal)
        if delay > 0 and index < len(journals) - 1:
            time.sleep(delay)
    return ranks


def infer_indent(text: str, entry: BibEntry) -> str:
    journal = entry.fields.get("journal")
    if journal:
        line = text[journal.line_start : journal.line_end]
        return line[: len(line) - len(line.lstrip())]
    return "  "


def insert_missing_fields(
    text: str,
    entry: BibEntry,
    rank: RankInfo,
    missing_sci: bool,
    missing_sciif: bool,
) -> tuple[int, str]:
    anchor = (
        entry.fields.get("preview")
        or entry.fields.get("url")
        or entry.fields.get("doi")
        or entry.fields.get("journal")
    )
    insert_at = anchor.line_end if anchor else entry.end
    indent = infer_indent(text, entry)
    lines: list[str] = []
    if missing_sci:
        lines.append(f"{indent}sci = {{{rank.sci}}},\n")
    if missing_sciif:
        lines.append(f"{indent}sciif = {{{rank.sciif}}},\n")
    return insert_at, "".join(lines)


def build_updates(
    text: str,
    entries: list[BibEntry],
    ranks: dict[str, RankInfo],
) -> tuple[list[tuple[int, int, str]], list[EntryComparison]]:
    edits: list[tuple[int, int, str]] = []
    comparisons: list[EntryComparison] = []

    for entry in entries:
        journal_field = entry.fields.get("journal")
        if entry.entry_type != "article" or journal_field is None:
            continue

        journal = journal_field.value
        rank = ranks[journal]
        sci_field = entry.fields.get("sci")
        sciif_field = entry.fields.get("sciif")
        before_sci = sci_field.value if sci_field else ""
        before_sciif = sciif_field.value if sciif_field else ""
        comparisons.append(
            EntryComparison(
                key=entry.key,
                journal=journal,
                before_sci=before_sci,
                before_sciif=before_sciif,
                after_sci=rank.sci,
                after_sciif=rank.sciif,
            )
        )

        if sci_field and sci_field.value != rank.sci:
            edits.append((sci_field.value_start, sci_field.value_end, rank.sci))
        if sciif_field and sciif_field.value != rank.sciif:
            edits.append((sciif_field.value_start, sciif_field.value_end, rank.sciif))
        if not sci_field or not sciif_field:
            insert_at, insertion = insert_missing_fields(
                text,
                entry,
                rank,
                missing_sci=not sci_field,
                missing_sciif=not sciif_field,
            )
            edits.append((insert_at, insert_at, insertion))

    return edits, comparisons


def apply_edits(text: str, edits: list[tuple[int, int, str]]) -> str:
    updated = text
    for start, end, replacement in sorted(edits, reverse=True):
        updated = updated[:start] + replacement + updated[end:]
    return updated


def format_value(value: str) -> str:
    return value if value else "空"


def journal_rows(comparisons: list[EntryComparison]) -> list[tuple[str, int, str, str, str, str, str]]:
    grouped: dict[str, list[EntryComparison]] = {}
    for comparison in comparisons:
        grouped.setdefault(comparison.journal, []).append(comparison)

    rows = []
    for journal in sorted(grouped):
        items = grouped[journal]
        before_sci = sorted({item.before_sci for item in items})
        before_sciif = sorted({item.before_sciif for item in items})
        after_sci = sorted({item.after_sci for item in items})
        after_sciif = sorted({item.after_sciif for item in items})
        changed = any(item.changed for item in items)
        inconsistent = len(before_sci) > 1 or len(before_sciif) > 1
        status = "UPDATED" if changed else "OK"
        if inconsistent:
            status = f"{status}; BEFORE_INCONSISTENT"
        rows.append(
            (
                journal,
                len(items),
                " / ".join(format_value(value) for value in before_sci),
                " / ".join(format_value(value) for value in before_sciif),
                " / ".join(format_value(value) for value in after_sci),
                " / ".join(format_value(value) for value in after_sciif),
                status,
            )
        )
    return rows


def build_report(
    bib_path: Path,
    comparisons: list[EntryComparison],
    changed_file: bool,
    dry_run: bool,
) -> str:
    changed_entries = [item for item in comparisons if item.changed]
    lines = [
        f"Checked `{bib_path}`.",
        "",
        f"- Entries checked: {len(comparisons)}",
        f"- Journals checked: {len(journal_rows(comparisons))}",
        f"- Entries needing updates: {len(changed_entries)}",
        f"- File written: {'no (dry run)' if dry_run else ('yes' if changed_file else 'no changes needed')}",
        "",
        "| Journal | Entries | Before sci | Before sciif | After sci | After sciif | Status |",
        "|---|---:|---:|---:|---:|---:|---|",
    ]
    for row in journal_rows(comparisons):
        lines.append("| " + " | ".join(str(cell) for cell in row) + " |")

    if changed_entries:
        lines.extend(
            [
                "",
                "Changed entries:",
                "",
                "| Key | Journal | Before | After |",
                "|---|---|---:|---:|",
            ]
        )
        for item in changed_entries:
            before = f"{format_value(item.before_sci)} / {format_value(item.before_sciif)}"
            after = f"{format_value(item.after_sci)} / {format_value(item.after_sciif)}"
            lines.append(f"| {item.key} | {item.journal} | {before} | {after} |")

    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    args.delay = max(args.delay, MIN_REQUEST_DELAY)
    bib_path = args.bib
    secret_key = os.environ.get(SECRET_ENV)
    if not secret_key:
        print(f"Missing environment variable: {SECRET_ENV}", file=sys.stderr)
        return 2

    text = bib_path.read_text(encoding="utf-8")
    entries = parse_bib_entries(text)
    journals = unique_journals(entries)
    if not journals:
        print(f"No journal articles found in {bib_path}", file=sys.stderr)
        return 1

    try:
        ranks = fetch_all_ranks(journals, secret_key, args.delay)
    except Exception as exc:
        print(f"EasyScholar lookup failed: {exc}", file=sys.stderr)
        return 1

    edits, comparisons = build_updates(text, entries, ranks)
    changed_file = bool(edits)
    if edits and not args.dry_run:
        bib_path.write_text(apply_edits(text, edits), encoding="utf-8")

    report = build_report(bib_path, comparisons, changed_file, args.dry_run)
    print(report)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(report + "\n", encoding="utf-8")
        print(f"\nReport written to `{args.report}`.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
