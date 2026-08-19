---
name: homepage-deployment
description: "Build, verify, and deploy the personal homepage. Use when running local production builds, handling Node version issues, checking static export output, verifying GitHub Pages workflow deployment, diagnosing Jekyll or README-rendered Pages output, pushing homepage changes, or confirming the live site after deployment."
---

# Homepage Deployment

## Overview

Use this skill for build and deployment work on the static Next.js homepage. GitHub Pages should deploy from GitHub Actions, not from a branch. `npm run build` is the production static-export step for deployment or explicit static-export verification; ordinary content and CV maintenance should use the lighter checks in `AGENTS.md`.

## Preflight

- Inspect `git status --short` before build or deployment; do not overwrite unrelated user changes.
- Check Node.js before building:

```bash
node -v
```

- This project supports Node.js 22 through 25. `.node-version` and `.nvmrc` specify `22`.
- If the default Node.js version is `v26` or newer, do not use plain `npm run build`; use the Node 24 fallback below.

## Work

### Choose Deployment Mode

- Default to the normal deployment mode, which preserves Git history and existing GitHub deployment records.
- Use the reset deployment mode only when the user explicitly asks to delete remote commits/history, clear deployment history, or keep only a fresh deployment record.
- In reset deployment mode, use a normal initialization commit message such as `Initial commit`; do not use wording like `Reinitialize`, and do not include `[skip ci]`, because the reset commit must trigger deployment.

### Build Locally

- Stop any running `npm run dev` server before a production build. Dev and build both use `.next/`, and running them in parallel can break the dev server's temporary chunks. If a build was run while dev was open, stop dev, remove generated `.next/`, and restart `npm run dev`.

- Use the standard build when Node is supported:

```bash
npm run build
```

- Use the temporary Node 24 fallback when the default local Node version is unsupported:

```bash
npx -y node@24 /opt/homebrew/lib/node_modules/npm/bin/npm-cli.js run build
```

- Remember that `prebuild` runs:

```bash
node scripts/check-node-version.mjs
node scripts/clean-macos-artifacts.mjs
node scripts/update-last-updated.mjs
```

- Treat `content/config.toml` and `content_zh/config.toml` `last_updated` changes as normal build side effects.

### Preview Layout Or Navigation Changes

- Start local development only when visual layout or navigation needs inspection:

```bash
npm run dev
```

- Use the local preview URL reported by Next.js and inspect the affected page.

### Verify GitHub Pages Mode

- Check Pages configuration:

```bash
gh api repos/zhechen06/zhechen06.github.io/pages --jq '{build_type,source,status,html_url}'
```

- Expected `build_type` is `workflow`.
- If it shows `legacy`, or the public page renders the root `README.md` through Jekyll, switch Pages to GitHub Actions:

```bash
gh api --method PUT repos/zhechen06/zhechen06.github.io/pages \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  -f build_type=workflow
gh workflow run deploy.yml --ref main
```

### Push Changes

- Before pushing, run a local build unless the user explicitly asked to skip it or there is a clear blocker.
- Add only task-relevant tracked files. Do not commit generated local artifacts.
- Use a task-specific commit message rather than a generic one when possible.

### Preserve Records Deployment

Use this path by default.

- Commit the intended changes normally.
- Push to `origin/main` or to the requested branch without rewriting history.
- Let `.github/workflows/deploy.yml` run from the push, or trigger it manually when needed:

```bash
gh workflow run deploy.yml --ref main
```

- Keep existing GitHub deployment records unless the user explicitly asks to remove them.

### Reset History And Keep Only New Deployment

Use this destructive path only after an explicit user request. It deletes remote `main` history by force-pushing a new root commit, deploys that commit normally, and removes old GitHub deployment records and old GitHub Actions workflow runs while keeping the new deployment state.

1. Confirm the local checkout is clean and matches the desired site state:

```bash
git status -sb --untracked-files=no
git diff --stat origin/main HEAD --
```

2. Confirm `main` is the target branch and inspect current remote deployment records and workflow runs:

```bash
git branch --show-current
git ls-remote --heads origin
gh api repos/zhechen06/zhechen06.github.io/deployments --paginate \
  --jq '[.[] | {id, sha, environment, created_at}]'
gh api repos/zhechen06/zhechen06.github.io/actions/runs --paginate \
  --jq '[.workflow_runs[] | {id, name, status, conclusion, head_sha, created_at}]'
```

3. Create a new root commit from the current tracked file tree, using a normal initialization message:

```bash
new_commit=$(git commit-tree HEAD^{tree} -m "Initial commit")
git update-ref refs/heads/main "$new_commit"
git rev-list --count HEAD
git rev-list --parents -n 1 HEAD
```

4. Force-push with lease so the remote `main` history becomes the single new commit:

```bash
git push --force-with-lease origin main:main
```

5. Wait for the push-triggered deploy workflow for the new commit to succeed:

```bash
gh run list --repo zhechen06/zhechen06.github.io --limit 8 \
  --json databaseId,name,workflowName,event,status,conclusion,headBranch,headSha
gh run watch RUN_ID --repo zhechen06/zhechen06.github.io --interval 5 --exit-status
```

6. Remove old deployment records only after the new deployment exists. Keep records whose `sha` equals the new commit, and delete all others by first marking them inactive:

```bash
for id in $(gh api repos/zhechen06/zhechen06.github.io/deployments --paginate \
  --jq ".[] | select(.sha != \"$new_commit\") | .id"); do
  gh api -X POST "repos/zhechen06/zhechen06.github.io/deployments/${id}/statuses" \
    -f state=inactive \
    -f description='Clean old deployment history' \
    -F auto_inactive=false >/dev/null
  gh api -X DELETE "repos/zhechen06/zhechen06.github.io/deployments/${id}" >/dev/null
done
```

7. Delete old GitHub Actions workflow runs only after the new deployment succeeds. Keep runs whose `head_sha` equals the new commit, and delete all others:

```bash
for id in $(gh api repos/zhechen06/zhechen06.github.io/actions/runs --paginate \
  --jq ".workflow_runs[] | select(.head_sha != \"$new_commit\") | .id"); do
  gh api -X DELETE "repos/zhechen06/zhechen06.github.io/actions/runs/${id}" >/dev/null
done
```

8. Verify the remote history, remaining deployment records, remaining workflow runs, and live site:

```bash
git fetch --prune origin
git rev-list --count origin/main
git log --oneline --decorate --max-count=5 origin/main
gh api repos/zhechen06/zhechen06.github.io/deployments --paginate \
  --jq '[.[] | {id, sha, environment, created_at}]'
gh api repos/zhechen06/zhechen06.github.io/actions/runs --paginate \
  --jq '[.workflow_runs[] | {id, name, status, conclusion, head_sha, created_at}]'
curl -I -L --max-time 20 https://zhechen06.github.io/
```

- Expected result: `origin/main` has one commit, the commit message is `Initial commit`, deployments contains only the new deployment for that commit, workflow runs contain only runs for the new commit, and the live site returns HTTP 200.
- Keep the generated `google-scholar-stats` branch unless the user explicitly asks to remove or rebuild it; citation badges depend on that branch.

## Verify

- Confirm the static export completed without errors.
- Review the diff:

```bash
git diff --stat
git status --short
```

- Do not commit `.next/`, `out/`, `node_modules/`, `.venv/`, `.DS_Store`, or other generated local artifacts.
- After deployment, confirm the live site is the exported Next.js site:

```bash
curl -L https://zhechen06.github.io/ | head
```

- The HTML should include Next.js assets such as `/_next/static/`; it should not include Jekyll-rendered README output.

## Finish

- Summarize the Node version used, build command run, Pages `build_type`, push/deployment action if any, and live-site verification result.
- Mention any skipped build, failed workflow, or deployment mode mismatch explicitly.
