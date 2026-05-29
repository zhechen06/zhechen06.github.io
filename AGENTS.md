# Personal Homepage Maintenance Notes

## Project Overview

This is a personal academic homepage customized from [PRISM](https://github.com/xyjoey/PRISM). It is built with Next.js and exported as a static site.

- Main content lives in `content/`.
- Chinese content lives in `content_zh/`.
- Static assets live in `public/`.
- Publication data is configured by `content/publications.toml`, which points to `content/publications.bib`.
- Journal covers and publication preview images live in `public/papers/`.
- The CV pages point to PDFs under `public/cv/`.
- Use `uv` for all Python-related tasks.

## Project Skills

Read the matching skill before running a long maintenance workflow. Keep this file as the routing layer and the skills as the procedural source of truth.

| Task | Skill |
| --- | --- |
| Add or update publications, Zotero metadata, journal covers, SCI quartiles, impact factors, or Google Scholar stats | `skills/homepage-publications/SKILL.md` |
| Update CV TeX sources, regenerate CV PDFs, add PDF outline/bookmarks, or sync publications/awards into the CV | `skills/homepage-cv/SKILL.md` |
| Add or update awards, award dates, award ordering, award news, or CV award entries | `skills/homepage-cv/SKILL.md` |
| Build, verify, push, or debug GitHub Pages deployment | `skills/homepage-deployment/SKILL.md` |

## Content Source Of Truth

Use this table first when deciding which file to edit. Do not treat generated build output as the source of truth.

| Update target | Source file(s) | Asset folder | Verify page |
| --- | --- | --- | --- |
| Site metadata and footer date | `content/config.toml`, `content_zh/config.toml` | `public/` | Every page footer |
| About / bio | `content/about.toml`, `content_zh/about.toml`, `content/bio.md`, `content_zh/bio.md` | `public/` | `/`, `/about` |
| Publications | `content/publications.bib`, `content/publications.toml`, `content_zh/publications.toml` | `public/papers/` | `/publications` |
| Awards | `content/awards.toml`, `content_zh/awards.toml` | `public/awards/` | `/awards` |
| News | `content/news.toml`, `content_zh/news.toml` | `public/` | `/news` |
| Talks | `content/talks.toml`, `content_zh/talks.toml` | `public/` | `/talks` |
| Services | `content/services.toml`, `content_zh/services.toml` | `public/` | `/services` |
| CV | `public/cv/CV-Zhe-CHEN.tex`, `public/cv/CV-Zhe-CHEN-Chinese.tex` | `public/cv/` | `/cv`, `/zh/cv` |

## Python And Scripts

Use `uv` for Python commands, including repo scripts and one-off Python checks.

Common script entrypoints:

```bash
npm run scholar:stats
npm run publication:ranks
npm run publication:accepted-dates
npm run cv:publication-sync-check
npm run content:check
```

Their Python commands are managed through `uv` in `package.json`.

## Bilingual Content Updates

Most visible content has both English and Chinese versions. When editing a file under `content/`, check the matching file under `content_zh/` in the same task, and vice versa.

- Keep structures aligned between English and Chinese TOML files whenever possible, including item order, section names, dates, links, image filenames, and visibility flags.
- Translate user-facing text only when the meaning is clear. If the wording is uncertain, keep the confirmed source-language update and mention the missing translation in the final response.
- Preserve shared identifiers and asset filenames exactly across languages.
- For publications, update the shared `content/publications.bib`; do not duplicate publication entries under `content_zh/`.
- For CV changes, update both CV TeX sources and regenerate both PDFs unless the user explicitly requests a draft-only source edit.

## Cross-Content Synchronization

Before editing, identify every public surface that shows the same real-world item. Do not leave conflicting page-only and CV-only versions unless the user explicitly requests a narrow draft.

- Publications: `content/publications.bib` is the source of truth. For new publications or metadata changes, use `skills/homepage-publications/SKILL.md`, check Zotero when a title/DOI is available and Zotero is running, then run `npm run cv:publication-sync-check`. If title, authors, venue, year, DOI, corresponding-author marker, `sciif`, or ordering changes affect the CV, update both CV TeX files, apply the CV ordering rules, and regenerate both PDFs.
- Awards: `content/awards.toml` and `content_zh/awards.toml` are the source of truth. When adding, deleting, renaming, redating, reordering, hiding, or unhiding an award, inspect `content/news.toml`, `content_zh/news.toml`, and both CV TeX files in the same task. Add or update matching award news when the award is public/newsworthy or an existing related news item exists; if news is intentionally skipped, mention that in the final response.
- CV-first requests: when the user asks to edit the CV, first decide whether the same item belongs in website source content. Publications should flow through `content/publications.bib`; awards should flow through awards/news TOML; talks, invited talks, services, and bio/profile material should be checked against their matching `content/` and `content_zh/` files before compiling PDFs.
- Page-first requests: when the user asks to update a page that has a CV counterpart, update the website source first, then sync the CV section and regenerate PDFs if the visible CV content changes.

## Award Dates And Ordering

Award source files use month-level dates even when the public display shows only the year.

- Store award dates in `content/awards.toml` and `content_zh/awards.toml` as `YYYY-MM`.
- Keep English and Chinese award item order aligned and sort awards by the stored `YYYY-MM` date from newest to oldest.
- Keep `content/news.toml` and `content_zh/news.toml` award news dates aligned with the matching award month when a corresponding news item exists or is added.
- The website awards page should display only the year for award dates. Do not change the TOML date back to `YYYY` just to alter display.
- When syncing awards into the CV award section, use the month-level source date for ordering but keep the visible CV date as `YYYY`.
- `Distinguished Postdoctoral Fellowship` uses the award/notification month `2024-11` in awards data and appears as `2024` in the CV award section.

## CV Publication Ordering

In the CV journal-paper section, sort entries by Zhe Chen's author role first, then by impact factor within each role group.

- Role group order is: first author, corresponding author, second author, third author, fourth author, and so on.
- Treat these groups as exclusive: first-author papers stay in the first-author group even if another author is marked corresponding; non-first-author papers where `Zhe Chen`/`Chen Zhe` has a `*` marker go in the corresponding-author group before ordinary second-author papers.
- For ordinary coauthored papers, determine the group from Zhe Chen's position in the BibTeX `author` field.
- Within each group, sort by `sciif` from `content/publications.bib` in descending numeric order. If two entries have the same `sciif`, preserve their existing relative CV order unless the user asks for a different tie-breaker.
- Keep English and Chinese CV journal-paper ordering aligned.
- In the CV `Conference Papers and Presentations`, `Conference Session Chairs`, and `Invited Talks` sections, sort entries by event date from newest to oldest and keep English and Chinese ordering aligned.

## Build And Verification

This project supports Node.js 22 through 25. The repository's `.node-version` and `.nvmrc` both specify `22`. For deployment builds, if the default `node -v` is `v26` or newer, `npm run build` will be rejected by `scripts/check-node-version.mjs`; use the Node 24 fallback documented in `skills/homepage-deployment/SKILL.md`.

Before finishing an ordinary content or CV update:

- Run `git diff --stat` and review whether the changed files match the task scope.
- Check the relevant source files from the table above, including the matching `content/` or `content_zh/` file when the update is bilingual.
- Confirm referenced assets exist under `public/`, such as publication previews in `public/papers/`, award images in `public/awards/`, and CV PDFs in `public/cv/`.
- Run `npm run content:check`.
- Run task-specific checks, such as `npm run cv:publication-sync-check` for publication/CV publication changes, and PDF outline/page checks after regenerating CV PDFs.
- If the task changes visual layout, navigation, or page placement, use `npm run dev` and check the affected page.

Do not run `npm run build` for ordinary content or CV maintenance. `npm run build` performs the production static export and is reserved for deployment/publish/static-export verification, or when the user explicitly asks for a build/export.

If a dev server is running, do not run `npm run build` in parallel with it; both use `.next/`, and a build can break the dev server's temporary chunks. Stop dev before a deployment build, or after an accidental build cleanly restart dev by stopping it, removing generated `.next/`, and running `npm run dev` again.

Treat `content/config.toml` and `content_zh/config.toml` `last_updated` changes as normal `prebuild` side effects only when a deployment/static-export build is intentionally run.

## Git Hygiene

- Do not commit `.next/`, `out/`, `node_modules/`, `.venv/`, `.DS_Store`, or other generated local artifacts.
- When running `git add`, add only files changed in the current task that should enter version control.
- Do not manually commit `out/`; GitHub Pages deploys from the static export generated in CI.
