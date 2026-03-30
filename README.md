# claude-onboard

**Instant AI-generated documentation for any codebase — drop a GitHub URL or local path, get a `CLAUDE.md` and `ARCHITECTURE.md` in seconds.**

[![npm version](https://img.shields.io/npm/v/claude-onboard)](https://www.npmjs.com/package/claude-onboard)
[![npm downloads](https://img.shields.io/npm/dm/claude-onboard)](https://www.npmjs.com/package/claude-onboard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/claude-onboard)](https://nodejs.org)

New to a codebase? `claude-onboard` reads your project — files, structure, configs, source code — and uses Claude AI to generate two documents that make onboarding and AI-assisted development dramatically faster:

- **`CLAUDE.md`** — the project brief that Claude Code reads before every session
- **`ARCHITECTURE.md`** — a technical map of your system with diagrams, data flow, and design decisions

No setup. No configuration. Works on any repo, any language.

![Demo](demo.gif)

---

## Installation

```bash
# Run directly with npx (no install needed)
npx claude-onboard <target>

# Or install globally
npm install -g claude-onboard
claude-onboard <target>
```

Requires `ANTHROPIC_API_KEY` in your environment:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Usage

```bash
# Document a GitHub repo
npx claude-onboard https://github.com/owner/repo

# Document your current directory
npx claude-onboard .

# Document a specific local folder
npx claude-onboard ./my-project

# Write output to a custom directory
npx claude-onboard . --output-dir ./docs

# Preview what would be generated without writing files
npx claude-onboard . --dry-run

# Skip the architecture document
npx claude-onboard . --no-architecture

# Access private repos
npx claude-onboard https://github.com/owner/private-repo --github-token ghp_...
```

---

## What Gets Generated

### `CLAUDE.md`

The context file that Claude Code (and other AI tools) reads at the start of every session. Includes:

- **Project overview** — what this thing is and what it does
- **Tech stack** — languages, frameworks, major dependencies
- **Key commands** — how to install, build, test, and run
- **Architecture summary** — the 30-second mental model
- **Conventions** — naming patterns, code style, PR norms
- **Important files** — entry points, config files, the files that matter most
- **Gotchas** — known quirks, non-obvious behaviors, things that bite new contributors

### `ARCHITECTURE.md`

A technical deep-dive for engineers who need to understand how the system actually works. Includes:

- **Component diagram** — ASCII or Mermaid diagram of the major components
- **Data flow** — how data moves through the system end to end
- **Key modules** — what each major module/package does and why it exists
- **Design decisions** — the architectural choices made and the tradeoffs accepted

---

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--output-dir <path>` | `.` (repo root) | Directory to write generated files into |
| `--dry-run` | `false` | Print generated content to stdout, don't write files |
| `--no-architecture` | `false` | Skip generating `ARCHITECTURE.md` |
| `--github-token <token>` | `$GITHUB_TOKEN` | Personal access token for private GitHub repos |
| `--model <model>` | `claude-opus-4-5` | Claude model to use |
| `--verbose` | `false` | Print detailed progress during generation |

---

## How It Works

1. **Fetches the codebase** — clones from GitHub or reads from the local filesystem, collecting file contents, directory structure, `package.json`, config files, and source files up to a token budget.
2. **Builds a context window** — intelligently selects which files to include, prioritizing entry points, configs, and heavily-imported modules.
3. **Calls Claude** — sends the full context to Claude with structured prompts tuned for each document type.
4. **Writes the files** — outputs `CLAUDE.md` and `ARCHITECTURE.md` to the target directory (with a backup if files already exist).

---

## Examples

### Document an open source project

```bash
npx claude-onboard https://github.com/expressjs/express --output-dir ./express-docs
```

### Preview without writing

```bash
npx claude-onboard . --dry-run
# → Prints CLAUDE.md and ARCHITECTURE.md content to stdout
```

### Regenerate only the CLAUDE.md

```bash
npx claude-onboard . --no-architecture
```

### Use in CI to keep docs fresh

```yaml
# .github/workflows/update-docs.yml
- name: Refresh onboarding docs
  run: npx claude-onboard . --output-dir ./docs
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## Contributing

Contributions are welcome. This tool is part of the [claude-tools](https://github.com/your-org/claude-tools) monorepo.

```bash
git clone https://github.com/your-org/claude-tools
cd claude-tools
npm install
cd packages/claude-onboard
npm run dev
```

Please open an issue before starting significant work. Include a test for any new behavior.

---

## License

MIT © claude-tools contributors
