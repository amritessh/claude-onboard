# claude-onboard

**Generate a production-quality `CLAUDE.md` and `ARCHITECTURE.md` for any codebase in seconds.**

[![npm version](https://img.shields.io/npm/v/claude-onboard)](https://www.npmjs.com/package/claude-onboard)
[![npm downloads](https://img.shields.io/npm/dm/claude-onboard)](https://www.npmjs.com/package/claude-onboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

`claude-onboard` reads your repository — source files, configs, directory structure, git history — and uses Claude AI to generate two documents that make onboarding and AI-assisted development dramatically faster:

- **`CLAUDE.md`** — the context file Claude Code reads before every session. Tells AI assistants exactly how your project works, what commands to run, what conventions to follow, and what to avoid.
- **`ARCHITECTURE.md`** — a technical map of your system with component diagrams, data flow descriptions, and key design decisions.

Point it at any GitHub URL or local folder. Works on any language. No configuration needed.

![Demo](demo.gif)

---

## Why this exists

[Claude Code](https://claude.ai/code) and other AI coding tools work dramatically better when they understand your project's context. A good `CLAUDE.md` file can halve the number of back-and-forth messages needed to complete a task, prevent AI tools from violating your conventions, and give new contributors an immediate mental model of the codebase.

Writing a good `CLAUDE.md` manually takes 1–2 hours. `claude-onboard` does it in 30 seconds.

---

## Installation

```bash
# Run without installing (recommended)
npx claude-onboard <target>

# Or install globally
npm install -g claude-onboard
```

### Requirements

- Node.js 18+
- An Anthropic API key ([get one here](https://console.anthropic.com))

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Usage

### On a GitHub repository

```bash
# Full URL
npx claude-onboard https://github.com/expressjs/express

# Short form
npx claude-onboard expressjs/express

# Private repo (requires token)
npx claude-onboard https://github.com/your-org/private-repo --github-token ghp_...
```

### On a local project

```bash
# Current directory
npx claude-onboard .

# Specific path
npx claude-onboard ~/projects/my-app

# Write to a custom output directory
npx claude-onboard . --output-dir ./docs

# Preview without writing files
npx claude-onboard . --dry-run

# Only generate CLAUDE.md (skip ARCHITECTURE.md)
npx claude-onboard . --no-architecture
```

### In CI (keep docs fresh on every release)

```yaml
# .github/workflows/update-docs.yml
name: Update onboarding docs
on:
  push:
    branches: [main]

jobs:
  update-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate docs
        run: npx claude-onboard . --output-dir ./docs
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - name: Commit if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs/CLAUDE.md docs/ARCHITECTURE.md
          git diff --staged --quiet || git commit -m "docs: refresh onboarding docs"
          git push
```

---

## What gets generated

### `CLAUDE.md`

The project brief that Claude Code and other AI tools read at the start of every session. Generated sections:

| Section | What's in it |
|---|---|
| **Project Overview** | What the project does, who it's for, and its current state |
| **Tech Stack** | Languages, frameworks, key libraries, infrastructure |
| **Project Structure** | What each top-level directory contains and why |
| **Key Commands** | Install, dev, build, test, lint — everything you need to get running |
| **Architecture Overview** | The 3-paragraph mental model: what exists, how it connects, how data flows |
| **Coding Conventions** | Naming patterns, file organization, patterns found in the actual code |
| **Important Files** | Entry points, config files, the 10 files that matter most |
| **Gotchas & Notes** | Non-obvious behaviors, known quirks, things that trip up new contributors |

Example output:

```markdown
# Project Overview
Express is a minimal and flexible Node.js web application framework that provides
a robust set of features for web and mobile applications...

# Key Commands
\`\`\`bash
npm install        # Install dependencies
npm test           # Run test suite (mocha)
npm run lint       # ESLint
\`\`\`

# Gotchas & Notes
- Middleware order matters — error-handling middleware must have 4 arguments (err, req, res, next)
- `app.use()` vs `router.use()` have different mounting semantics
- The `trust proxy` setting must be configured when running behind a load balancer
```

### `ARCHITECTURE.md`

A technical deep-dive for engineers who need to understand the system. Generated sections:

| Section | What's in it |
|---|---|
| **Architecture Overview** | High-level explanation of how the system is structured and why |
| **Component Diagram** | ASCII or Mermaid diagram of major components and their relationships |
| **Data Flow** | Step-by-step walkthrough of the primary use case end-to-end |
| **Key Modules** | What each major module does, its public interface, and its dependencies |
| **External Dependencies** | External services, APIs, databases this project depends on |
| **Design Decisions** | Key architectural choices and the reasoning behind them |

---

## Options

| Flag | Default | Description |
|---|---|---|
| `--output-dir <path>` | `.` | Directory to write generated files |
| `--dry-run` | `false` | Print to stdout, don't write files |
| `--no-architecture` | `false` | Skip generating `ARCHITECTURE.md` |
| `--github-token <token>` | `$GITHUB_TOKEN` | Token for private repos or to raise API rate limits |
| `-h, --help` | | Show help |
| `-V, --version` | | Show version number |

### Environment variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | **Required.** Your Anthropic API key |
| `GITHUB_TOKEN` | Optional. GitHub personal access token. Raises rate limit from 60 to 5,000 req/hr |

---

## How it works

```
Input (GitHub URL or local path)
  ↓
Read repository
  - GitHub repos: fetched via GitHub REST API (no cloning needed)
  - Local repos:  walks filesystem, reads git log
  - Prioritizes: package.json, README, CLAUDE.md, entry points, config files
  - Applies token budget: reads up to ~80,000 chars of source code
  ↓
Build context
  - Directory tree
  - File contents (prioritized by importance)
  - Recent git commits
  - Language/framework detection
  ↓
Call Claude
  - Two separate prompts: one for CLAUDE.md, one for ARCHITECTURE.md
  - Model: claude-opus-4-5
  - Structured output with exact sections
  ↓
Write output
  - Writes to --output-dir (default: current directory)
  - Existing files are overwritten (no merge — regenerate cleanly)
```

### File prioritization

When a repo is too large to fit in one context window, `claude-onboard` prioritizes files in this order:

1. `package.json`, `README.md`, `CLAUDE.md`, `Makefile`, `Dockerfile`
2. Top-level source files
3. Source files by directory depth (shallower = more important)
4. Skipped entirely: `node_modules`, `dist`, `build`, `.git`, binary files, files over 100KB

---

## Supported languages & stacks

Works on any codebase. Especially well-tested on:

- **JavaScript / TypeScript** (Node.js, React, Next.js, Express, NestJS)
- **Python** (FastAPI, Django, Flask, data science)
- **Go** (standard library, Gin, Echo)
- **Rust** (Cargo projects)
- **Ruby** (Rails, Sinatra)
- **Java / Kotlin** (Spring Boot, Android)

---

## Cost estimate

Generating both documents on a typical medium-sized repo (~50 files) costs approximately **$0.05–0.15** in Claude API credits.

---

## Troubleshooting

**Rate limit errors from GitHub**

```bash
# Add a GitHub token to get 5,000 requests/hour instead of 60
npx claude-onboard https://github.com/owner/repo --github-token $(gh auth token)
```

**ANTHROPIC_API_KEY not found**

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# Or add it to .env in your current directory
```

**Output is too generic / not accurate**

This usually means the repo is large and only a sample was read. Try running on a specific subdirectory, or use `--dry-run` to inspect what was generated.

---

## Contributing

```bash
git clone https://github.com/amritessh/claude-onboard
cd claude-onboard
npm install
npm run dev        # watch mode
node dist/index.js . --dry-run   # test on this repo
```

Please open an issue before starting significant work. PRs welcome.

---

## License

MIT
