import { Octokit } from "@octokit/rest";

export interface RepoFile {
  path: string;
  content: string;
  size: number;
}

export interface GitCommit {
  sha: string;
  message: string;
  date: string;
  author: string;
}

export interface RepoContext {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string;
  stars: number;
  language: string;
  files: RepoFile[];
  directoryTree: string;
  languages: Record<string, number>;
  recentCommits: GitCommit[];
  truncated: boolean;
}

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "__pycache__",
  ".cache", "coverage", ".nyc_output", "vendor", ".turbo",
]);

const PRIORITY_FILES = new Set([
  "package.json", "README.md", "README.rst", "README.txt",
  "CLAUDE.md", "ARCHITECTURE.md", "Makefile", "Dockerfile",
  "docker-compose.yml", "pyproject.toml", "go.mod", "Cargo.toml",
  "tsconfig.json", ".env.example",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
  ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".swift", ".kt",
  ".md", ".yaml", ".yml", ".toml", ".json", ".sh", ".sql",
]);

const MAX_FILE_SIZE = 100 * 1024; // 100KB
const TOKEN_BUDGET = 80_000; // ~80K chars

function parseGitHubUrl(input: string): { owner: string; repo: string } {
  // Handle: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const cleaned = input
    .replace(/^https?:\/\//, "")
    .replace(/^github\.com\//, "")
    .replace(/\.git$/, "")
    .split("#")[0]
    .split("?")[0]
    .trim();

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error(`Cannot parse GitHub URL: ${input}`);
  return { owner: parts[0], repo: parts[1] };
}

function buildTree(paths: string[]): string {
  const tree: Record<string, unknown> = {};
  for (const p of paths) {
    const parts = p.split("/");
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        node[part] = null;
      } else {
        if (!node[part]) node[part] = {};
        node = node[part] as Record<string, unknown>;
      }
    }
  }

  function render(node: Record<string, unknown>, indent = ""): string {
    return Object.entries(node)
      .map(([key, val]) => {
        if (val === null) return `${indent}${key}`;
        return `${indent}${key}/\n${render(val as Record<string, unknown>, indent + "  ")}`;
      })
      .join("\n");
  }

  return render(tree);
}

export async function readGitHubRepo(
  input: string,
  githubToken?: string
): Promise<RepoContext> {
  const { owner, repo } = parseGitHubUrl(input);
  const octokit = new Octokit({ auth: githubToken });

  // Fetch repo metadata, tree, languages, and commits in parallel
  const [repoData, langData, commitsData] = await Promise.all([
    octokit.repos.get({ owner, repo }),
    octokit.repos.listLanguages({ owner, repo }),
    octokit.repos.listCommits({ owner, repo, per_page: 15 }),
  ]);

  const defaultBranch = repoData.data.default_branch;

  // Get full file tree
  const treeData = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: defaultBranch,
    recursive: "1",
  });

  const allFiles = treeData.data.tree.filter((f) => f.type === "blob" && f.path);

  // Filter out skipped directories and non-source files
  const eligible = allFiles.filter((f) => {
    const parts = f.path!.split("/");
    if (parts.some((p) => SKIP_DIRS.has(p))) return false;
    if ((f.size ?? 0) > MAX_FILE_SIZE) return false;
    const ext = "." + f.path!.split(".").pop()!;
    const basename = f.path!.split("/").pop()!;
    return PRIORITY_FILES.has(basename) || SOURCE_EXTENSIONS.has(ext);
  });

  // Sort: priority files first, then by path length (shorter = closer to root)
  eligible.sort((a, b) => {
    const aName = a.path!.split("/").pop()!;
    const bName = b.path!.split("/").pop()!;
    const aPriority = PRIORITY_FILES.has(aName) ? 0 : 1;
    const bPriority = PRIORITY_FILES.has(bName) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.path!.split("/").length - b.path!.split("/").length;
  });

  // Fetch file contents up to token budget
  const files: RepoFile[] = [];
  let totalChars = 0;
  let truncated = false;

  for (const file of eligible) {
    if (totalChars >= TOKEN_BUDGET) {
      truncated = true;
      break;
    }
    try {
      const contentData = await octokit.repos.getContent({
        owner,
        repo,
        path: file.path!,
      });
      const data = contentData.data as { content?: string; encoding?: string; size?: number };
      if (!data.content || data.encoding !== "base64") continue;
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      files.push({ path: file.path!, content: decoded, size: decoded.length });
      totalChars += decoded.length;
    } catch {
      // Skip files that fail to fetch
    }
  }

  const recentCommits: GitCommit[] = commitsData.data.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0],
    date: c.commit.author?.date ?? "",
    author: c.commit.author?.name ?? "unknown",
  }));

  return {
    owner,
    repo,
    defaultBranch,
    description: repoData.data.description ?? "",
    stars: repoData.data.stargazers_count ?? 0,
    language: repoData.data.language ?? "",
    files,
    directoryTree: buildTree(allFiles.map((f) => f.path!).slice(0, 200)),
    languages: langData.data as Record<string, number>,
    recentCommits,
    truncated,
  };
}
