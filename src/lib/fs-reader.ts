import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type { RepoContext, RepoFile, GitCommit } from "./github-reader";

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__",
  ".cache", "coverage", ".nyc_output", "vendor", ".turbo",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".swift", ".kt",
  ".md", ".yaml", ".yml", ".toml", ".json", ".sh", ".sql",
]);

const PRIORITY_FILES = new Set([
  "package.json", "README.md", "README.rst", "README.txt",
  "CLAUDE.md", "ARCHITECTURE.md", "Makefile", "Dockerfile",
  "docker-compose.yml", "pyproject.toml", "go.mod", "Cargo.toml",
  "tsconfig.json", ".env.example",
]);

const MAX_FILE_SIZE = 100 * 1024;
const TOKEN_BUDGET = 80_000;

function walkDir(dir: string, base: string, results: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    if (entry.isDirectory()) {
      walkDir(full, base, results);
    } else if (entry.isFile()) {
      results.push(rel);
    }
  }
}

function buildTree(paths: string[]): string {
  const lines: string[] = [];
  for (const p of paths.slice(0, 200)) {
    const depth = p.split(path.sep).length - 1;
    const indent = "  ".repeat(depth);
    lines.push(`${indent}${path.basename(p)}`);
  }
  return lines.join("\n");
}

function getGitLog(dir: string): GitCommit[] {
  try {
    const out = execSync(
      'git log --oneline --format="%h|%s|%ai|%an" -20',
      { cwd: dir, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    );
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, message, date, ...authorParts] = line.split("|");
        return { sha, message, date, author: authorParts.join("|") };
      });
  } catch {
    return [];
  }
}

function detectLanguage(files: string[]): string {
  const extCount: Record<string, number> = {};
  for (const f of files) {
    const ext = path.extname(f);
    if (ext) extCount[ext] = (extCount[ext] ?? 0) + 1;
  }
  const sorted = Object.entries(extCount).sort((a, b) => b[1] - a[1]);
  const extToLang: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript",
    ".py": "Python", ".go": "Go", ".rs": "Rust", ".java": "Java",
    ".rb": "Ruby", ".php": "PHP",
  };
  return sorted.length > 0 ? (extToLang[sorted[0][0]] ?? sorted[0][0]) : "Unknown";
}

export async function readLocalRepo(dirPath: string): Promise<RepoContext> {
  const absPath = path.resolve(dirPath);
  if (!fs.existsSync(absPath)) throw new Error(`Path not found: ${absPath}`);

  const allPaths: string[] = [];
  walkDir(absPath, absPath, allPaths);

  const eligible = allPaths.filter((p) => {
    const ext = path.extname(p);
    const basename = path.basename(p);
    const stat = fs.statSync(path.join(absPath, p));
    if (stat.size > MAX_FILE_SIZE) return false;
    return PRIORITY_FILES.has(basename) || SOURCE_EXTENSIONS.has(ext);
  });

  eligible.sort((a, b) => {
    const aPriority = PRIORITY_FILES.has(path.basename(a)) ? 0 : 1;
    const bPriority = PRIORITY_FILES.has(path.basename(b)) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.split(path.sep).length - b.split(path.sep).length;
  });

  const files: RepoFile[] = [];
  let totalChars = 0;
  let truncated = false;

  for (const rel of eligible) {
    if (totalChars >= TOKEN_BUDGET) { truncated = true; break; }
    try {
      const content = fs.readFileSync(path.join(absPath, rel), "utf-8");
      files.push({ path: rel, content, size: content.length });
      totalChars += content.length;
    } catch {
      // skip unreadable files
    }
  }

  const repoName = path.basename(absPath);
  let packageJson: { description?: string; name?: string } = {};
  const pkgFile = files.find((f) => f.path === "package.json");
  if (pkgFile) {
    try { packageJson = JSON.parse(pkgFile.content); } catch { /* ignore */ }
  }

  return {
    owner: "local",
    repo: repoName,
    defaultBranch: "main",
    description: packageJson.description ?? "",
    stars: 0,
    language: detectLanguage(allPaths),
    files,
    directoryTree: buildTree(allPaths),
    languages: {},
    recentCommits: getGitLog(absPath),
    truncated,
  };
}
