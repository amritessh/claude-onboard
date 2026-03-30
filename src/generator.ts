import { generateText } from "./lib/client";
import type { RepoContext } from "./lib";
import { buildPromptContext } from "./collector";

const SYSTEM_PROMPT = `You are an expert software architect who deeply understands codebases.
Your job is to generate clear, accurate, and useful documentation for developers.
Be specific, concrete, and base everything strictly on the actual code provided.
Do not invent features or make assumptions beyond what the code shows.`;

export async function generateClaudeMd(ctx: RepoContext): Promise<string> {
  const context = buildPromptContext(ctx);

  const prompt = `Analyze this repository and generate a CLAUDE.md file.

${context}

Generate a CLAUDE.md file with exactly these sections:

# Project Overview
A 2-3 sentence summary of what this project does and its purpose.

# Tech Stack
Bullet list of key technologies, frameworks, and tools used.

# Project Structure
Brief description of the main directories and what they contain.

# Key Commands
\`\`\`bash
# How to install dependencies
# How to run in development
# How to build
# How to run tests
# Any other frequently used commands
\`\`\`

# Architecture Overview
2-3 paragraphs explaining how the system works, key design decisions, and data flow.

# Coding Conventions
Bullet list of conventions found in the code (naming, file organization, patterns used).

# Important Files
List of the most important files to understand the codebase, with one-line descriptions.

# Gotchas & Notes
Any non-obvious things a developer should know before working on this codebase.

Write the CLAUDE.md content only. No preamble.`;

  return generateText(SYSTEM_PROMPT, prompt, 4096);
}

export async function generateArchitectureMd(ctx: RepoContext): Promise<string> {
  const context = buildPromptContext(ctx);

  const prompt = `Analyze this repository and generate an ARCHITECTURE.md file.

${context}

Generate an ARCHITECTURE.md file with exactly these sections:

# Architecture Overview
High-level explanation of how this system is structured and why.

# Component Diagram
An ASCII diagram showing the main components and how they relate.

# Data Flow
Step-by-step description of how data flows through the system for the primary use case.

# Key Modules
For each major module/package/directory, explain:
- What it does
- Its public interface
- Its dependencies

# External Dependencies
List of external services, APIs, or systems this project depends on.

# Design Decisions
Key architectural decisions and the reasoning behind them (inferred from the code).

Write the ARCHITECTURE.md content only. No preamble.`;

  return generateText(SYSTEM_PROMPT, prompt, 4096);
}
