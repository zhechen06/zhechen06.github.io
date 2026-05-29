---
name: homepage-cv
description: "Maintain homepage CV sources and PDFs. Use when editing public/cv/CV-Zhe-CHEN.tex or public/cv/CV-Zhe-CHEN-Chinese.tex, regenerating CV PDFs, adding PDF outlines or bookmarks, syncing publication or award entries into the CV, adding or updating awards and award news that affect the CV, checking CV footer dates, or verifying the CV pages."
---

# Homepage CV

## Overview

Use this skill for CV source edits, award-to-CV sync, and PDF regeneration. Always treat the English and Chinese CVs as a paired deliverable unless the user explicitly asks for a draft-only source edit. For publications and awards, the CV is downstream of the website source data; update the source data first, then sync the CV.

## Preflight

- Inspect both source files before editing:
  - `public/cv/CV-Zhe-CHEN.tex`
  - `public/cv/CV-Zhe-CHEN-Chinese.tex`
- Confirm the CV pages still point to the expected PDF paths:
  - `content/cv.toml`: `/cv/CV-Zhe-CHEN.pdf`
  - `content_zh/cv.toml`: `/cv/CV-Zhe-CHEN-Chinese.pdf`
- For award-related edits, inspect `content/awards.toml`, `content_zh/awards.toml`, `content/news.toml`, and `content_zh/news.toml` before editing the CV.
- For CV-first edits, check whether the same item belongs in a website source file:
  - Journal papers: `content/publications.bib`
  - Awards: `content/awards.toml`, `content_zh/awards.toml`, and possibly news TOML
  - Talks or invited talks: `content/talks.toml` and `content_zh/talks.toml`
  - Services: `content/services.toml` and `content_zh/services.toml`
  - Bio/profile text: `content/about.toml`, `content_zh/about.toml`, `content/bio.md`, and `content_zh/bio.md`
- For publication-related CV edits, first run or inspect the output from:

```bash
npm run cv:publication-sync-check
```

- Use the current working timezone date unless the user specifies another date.

## Work

### Add Or Update Awards

- Treat `content/awards.toml` and `content_zh/awards.toml` as the award source of truth. Update these before editing the CV award section unless the user explicitly requests a CV-only draft.
- Store award dates as `YYYY-MM`, keep English and Chinese item order aligned, and sort awards from newest to oldest by the stored month.
- Preserve shared image filenames, links, visibility flags, and identifiers across languages. Confirm referenced award images exist under `public/awards/`.
- Inspect `content/news.toml` and `content_zh/news.toml` for a related award news item. Add or update one when the award is public/newsworthy or a related item already exists; align the news date with the award month. If no news item is added, mention why in the final response.
- Sync both CV award sections after the award TOML/news decision. Keep visible CV dates as `YYYY` and sort by the month-level source date.

### Edit CV Sources

- Update both English and Chinese `.tex` sources when content has bilingual equivalents.
- For publication and award changes, do not edit only the TeX when a website source file should also change. Update the source of truth first, then reflect the result in the CV.
- In the awards section, use the month-level award dates from `content/awards.toml` and `content_zh/awards.toml` for ordering, keep English and Chinese ordering aligned, and sort awards from newest to oldest by `YYYY-MM`.
- Keep visible CV award dates as `YYYY` only, even when the awards TOML source date is `YYYY-MM`.
- Treat `Distinguished Postdoctoral Fellowship` as a 2024 award in the CV award section because the awards source date is `2024-11`.
- In the journal-paper section, keep English and Chinese ordering aligned and sort entries by Zhe Chen's role group first, then by impact factor:
  - Role group order: first author, corresponding author, second author, third author, fourth author, and so on.
  - Groups are exclusive. First-author papers remain in the first-author group. Non-first-author papers where `Zhe Chen`/`Chen Zhe` has a `*` marker go in the corresponding-author group before ordinary second-author papers. All other papers use Zhe Chen's position in the BibTeX `author` field.
  - Within each role group, sort by numeric `sciif` from `content/publications.bib` in descending order. Preserve existing relative order for exact IF ties unless the user specifies another tie-breaker.
- In the `Conference Papers and Presentations`, `Conference Session Chairs`, and `Invited Talks` sections, keep English and Chinese ordering aligned and sort entries by event date from newest to oldest.
- Preserve award notes, corresponding-author notes, manual `et al.` shortening, and other CV-specific formatting while reordering items.
- Update footer dates before compiling:
  - English: `Last updated: Month DD, YYYY`
  - Chinese: `最近更新：YYYY年M月D日`
- Keep output PDF filenames unchanged:
  - `public/cv/CV-Zhe-CHEN.pdf`
  - `public/cv/CV-Zhe-CHEN-Chinese.pdf`

### Sync CV Changes Back To Website Sources

- If a CV-first request adds, removes, renames, or redates an award, update the award TOML files and related news before compiling.
- If a CV-first request changes a publication entry, use `skills/homepage-publications/SKILL.md` and update `content/publications.bib` before editing the CV item.
- If a CV-first request changes talks, invited talks, services, or bio/profile material that is also displayed on the website, update the matching English and Chinese content files from `AGENTS.md` in the same task.
- If the user explicitly wants a CV-only change, keep it limited to the TeX/PDF files and state that the website source files were intentionally not changed.

### Add Or Maintain PDF Outlines

- Prefer source-level LaTeX outline/bookmark definitions over post-processing PDFs, so future compilations preserve the outline.
- Keep visible heading style unchanged when adding bookmark helpers.
- Use Unicode-capable PDF bookmarks for Chinese text, such as `\usepackage[unicode,hidelinks]{hyperref}` plus `bookmark` when appropriate.
- Include top-level section bookmarks and useful nested bookmarks for long sections such as publications.

### Compile PDFs

- Build both PDFs together with `tectonic`:

```bash
cd public/cv
tectonic CV-Zhe-CHEN.tex
tectonic CV-Zhe-CHEN-Chinese.tex
```

- Treat fatal LaTeX errors as blockers.
- Treat small overfull/underfull box warnings as non-blocking unless they indicate visible layout damage.

## Verify

- Confirm both PDF files were regenerated under `public/cv/`.
- For outline/bookmark work, verify with `pypdf`:

```bash
uv run --with pypdf python - <<'PY'
from pathlib import Path
from pypdf import PdfReader

for path in [
    Path("public/cv/CV-Zhe-CHEN.pdf"),
    Path("public/cv/CV-Zhe-CHEN-Chinese.pdf"),
]:
    reader = PdfReader(str(path))
    root = reader.trailer["/Root"]
    outline = reader.outline
    print(f"{path}: pages={len(reader.pages)} PageMode={root.get('/PageMode')} top_level_outlines={len(outline)}")
PY
```

- When a detailed outline listing is useful, walk `reader.outline` and print titles with page numbers.
- Confirm footer dates in both TeX sources match the intended update date.
- Confirm `content/cv.toml` and `content_zh/cv.toml` still point to the expected PDF paths.
- If awards, talks, services, or bio/profile source files changed as part of the CV work, verify the matching English and Chinese files remain structurally aligned.
- For ordinary CV/content maintenance, do not run `npm run build`; use source checks, PDF regeneration/outline checks, and `npm run content:check` instead.
- Run `npm run build` only through `skills/homepage-deployment/SKILL.md`, or when the user explicitly requests deployment, publishing, or static-export verification.
- Review `git diff --stat` and ensure no generated local build output is included.

## Finish

- Summarize source changes, any website content synchronized from CV edits, regenerated PDFs, PDF verification results, and whether the deployment/static-export build was intentionally skipped or run.
- Mention any non-blocking LaTeX warnings if they remain relevant to the user.
