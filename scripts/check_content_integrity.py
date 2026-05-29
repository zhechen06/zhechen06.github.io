#!/usr/bin/env python3
"""Run consistency checks for homepage content and generated assets."""

from __future__ import annotations

import re
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from update_publication_ranks import BibEntry, parse_bib_entries


ROOT = Path.cwd()
CONTENT_DIR = ROOT / "content"
CONTENT_ZH_DIR = ROOT / "content_zh"
PUBLIC_DIR = ROOT / "public"
PUBLICATION_BIB = CONTENT_DIR / "publications.bib"
CV_PDFS = [
    PUBLIC_DIR / "cv" / "CV-Zhe-CHEN.pdf",
    PUBLIC_DIR / "cv" / "CV-Zhe-CHEN-Chinese.pdf",
]
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass
class CheckResult:
    errors: list[str]
    warnings: list[str]

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warning(self, message: str) -> None:
        self.warnings.append(message)


def load_toml(path: Path, result: CheckResult) -> dict[str, Any]:
    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        result.error(f"{path}: TOML parse failed: {exc}")
        return {}


def compare_shapes(en: Any, zh: Any, label: str, result: CheckResult) -> None:
    if isinstance(en, dict) and isinstance(zh, dict):
        en_keys = set(en)
        zh_keys = set(zh)
        for key in sorted(en_keys - zh_keys):
            result.error(f"{label}: missing Chinese key `{key}`")
        for key in sorted(zh_keys - en_keys):
            result.error(f"{label}: extra Chinese key `{key}`")
        for key in sorted(en_keys & zh_keys):
            compare_shapes(en[key], zh[key], f"{label}.{key}", result)
        return

    if isinstance(en, list) and isinstance(zh, list):
        if len(en) != len(zh):
            result.error(f"{label}: list length mismatch ({len(en)} vs {len(zh)})")
            return
        for index, (en_item, zh_item) in enumerate(zip(en, zh)):
            compare_shapes(en_item, zh_item, f"{label}[{index}]", result)
        return

    if type(en) is not type(zh):
        result.error(f"{label}: type mismatch ({type(en).__name__} vs {type(zh).__name__})")


def check_bilingual_toml(result: CheckResult) -> None:
    for en_path in sorted(CONTENT_DIR.glob("*.toml")):
        zh_path = CONTENT_ZH_DIR / en_path.name
        if not zh_path.exists():
            result.error(f"{zh_path}: missing localized TOML file")
            continue

        en_data = load_toml(en_path, result)
        zh_data = load_toml(zh_path, result)
        if not en_data or not zh_data:
            continue

        if en_path.name == "config.toml":
            check_navigation_alignment(en_data, zh_data, result)
            continue

        compare_shapes(en_data, zh_data, en_path.name, result)


def check_navigation_alignment(en_data: dict[str, Any], zh_data: dict[str, Any], result: CheckResult) -> None:
    en_nav = en_data.get("navigation", [])
    zh_nav = zh_data.get("navigation", [])
    if not isinstance(en_nav, list) or not isinstance(zh_nav, list):
        result.error("config.toml: navigation must be a list in both locales")
        return
    if len(en_nav) != len(zh_nav):
        result.error(f"config.toml: navigation length mismatch ({len(en_nav)} vs {len(zh_nav)})")
        return

    for index, (en_item, zh_item) in enumerate(zip(en_nav, zh_nav)):
        for key in ("type", "target", "href"):
            if en_item.get(key) != zh_item.get(key):
                result.error(
                    f"config.toml: navigation[{index}].{key} mismatch "
                    f"({en_item.get(key)!r} vs {zh_item.get(key)!r})"
                )


def iter_strings(value: Any, path: str = ""):
    if isinstance(value, dict):
        for key, nested in value.items():
            yield from iter_strings(nested, f"{path}.{key}" if path else str(key))
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            yield from iter_strings(nested, f"{path}[{index}]")
    elif isinstance(value, str):
        yield path, value


def resolve_referenced_path(key_path: str, value: str, toml_path: Path) -> Path | None:
    key = key_path.split(".")[-1].split("[")[0]
    if key not in {"image", "source", "avatar", "favicon"}:
        return None

    if value.startswith("http://") or value.startswith("https://"):
        return None

    if value.startswith("/"):
        return PUBLIC_DIR / value.lstrip("/")

    if value.endswith(".bib"):
        return CONTENT_DIR / value

    if value.endswith(".md"):
        return toml_path.parent / value

    return None


def check_toml_references(result: CheckResult) -> None:
    for toml_path in sorted([*CONTENT_DIR.glob("*.toml"), *CONTENT_ZH_DIR.glob("*.toml")]):
        data = load_toml(toml_path, result)
        for key_path, value in iter_strings(data):
            referenced = resolve_referenced_path(key_path, value, toml_path)
            if referenced and not referenced.exists():
                result.error(f"{toml_path}:{key_path} references missing file `{referenced.relative_to(ROOT)}`")


def field(entry: BibEntry, name: str) -> str:
    value = entry.fields.get(name)
    return value.value.strip() if value else ""


def normalize_title(value: str) -> str:
    value = re.sub(r"\\[A-Za-z]+(?:\[[^\]]*\])?(?:\{([^{}]*)\})?", r"\1", value)
    value = re.sub(r"[^A-Za-z0-9]+", " ", value).lower()
    return " ".join(value.split())


def check_publications(result: CheckResult) -> None:
    text = PUBLICATION_BIB.read_text(encoding="utf-8")
    entries = parse_bib_entries(text)
    keys: set[str] = set()
    titles: dict[str, str] = {}
    dois: dict[str, str] = {}

    for entry in entries:
        if entry.key in keys:
            result.error(f"content/publications.bib: duplicate BibTeX key `{entry.key}`")
        keys.add(entry.key)

        title = field(entry, "title")
        normalized_title = normalize_title(title)
        if normalized_title:
            previous = titles.get(normalized_title)
            if previous:
                result.error(f"content/publications.bib: duplicate title `{entry.key}` and `{previous}`")
            titles[normalized_title] = entry.key

        doi = field(entry, "doi").lower()
        if doi:
            previous = dois.get(doi)
            if previous:
                result.error(f"content/publications.bib: duplicate DOI `{doi}` in `{entry.key}` and `{previous}`")
            dois[doi] = entry.key

        preview = field(entry, "preview")
        if preview and not (PUBLIC_DIR / "papers" / preview).exists():
            result.error(f"content/publications.bib:{entry.key} preview missing `public/papers/{preview}`")

        year = field(entry, "year")
        if not re.fullmatch(r"\d{4}", year):
            result.error(f"content/publications.bib:{entry.key} invalid year `{year}`")

        accepted = field(entry, "accepted")
        if accepted and not DATE_RE.fullmatch(accepted):
            result.error(f"content/publications.bib:{entry.key} accepted must use YYYY-MM-DD, got `{accepted}`")


def check_cv_pdfs(result: CheckResult) -> None:
    try:
        from pypdf import PdfReader
    except ImportError:
        result.warning("pypdf is unavailable; skipped CV PDF outline checks")
        return

    for pdf_path in CV_PDFS:
        if not pdf_path.exists():
            result.error(f"{pdf_path.relative_to(ROOT)}: missing CV PDF")
            continue
        try:
            reader = PdfReader(str(pdf_path))
            if len(reader.pages) == 0:
                result.error(f"{pdf_path.relative_to(ROOT)}: PDF has no pages")
            if len(reader.outline) == 0:
                result.error(f"{pdf_path.relative_to(ROOT)}: PDF outline is missing")
        except Exception as exc:
            result.error(f"{pdf_path.relative_to(ROOT)}: PDF check failed: {exc}")


def main() -> int:
    result = CheckResult(errors=[], warnings=[])
    check_bilingual_toml(result)
    check_toml_references(result)
    check_publications(result)
    check_cv_pdfs(result)

    if result.warnings:
        print("Warnings:")
        for warning in result.warnings:
            print(f"- {warning}")
        print()

    if result.errors:
        print("Content integrity check failed:")
        for error in result.errors:
            print(f"- {error}")
        return 1

    print("Content integrity check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
