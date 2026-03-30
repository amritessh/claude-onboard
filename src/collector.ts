import type { RepoContext } from "./lib";

export function buildPromptContext(ctx: RepoContext): string {
  const parts: string[] = [];

  parts.push(`# Repository: ${ctx.owner}/${ctx.repo}`);
  if (ctx.description) parts.push(`Description: ${ctx.description}`);
  if (ctx.stars) parts.push(`Stars: ${ctx.stars}`);
  parts.push(`Primary language: ${ctx.language}`);
  if (Object.keys(ctx.languages).length > 0) {
    const langs = Object.entries(ctx.languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([l, b]) => `${l}: ${(b / 1024).toFixed(0)}KB`)
      .join(", ");
    parts.push(`Languages: ${langs}`);
  }

  parts.push("\n## Directory Structure");
  parts.push("```");
  parts.push(ctx.directoryTree);
  parts.push("```");

  if (ctx.recentCommits.length > 0) {
    parts.push("\n## Recent Commits");
    for (const c of ctx.recentCommits.slice(0, 10)) {
      parts.push(`- ${c.sha} ${c.message} (${c.author}, ${c.date.slice(0, 10)})`);
    }
  }

  parts.push("\n## File Contents");
  for (const file of ctx.files) {
    const ext = file.path.split(".").pop() ?? "";
    parts.push(`\n### ${file.path}`);
    parts.push("```" + ext);
    parts.push(file.content.slice(0, 8000)); // cap per-file at 8K
    parts.push("```");
  }

  if (ctx.truncated) {
    parts.push("\n> Note: Repository was truncated due to size. Above is a representative sample.");
  }

  return parts.join("\n");
}
