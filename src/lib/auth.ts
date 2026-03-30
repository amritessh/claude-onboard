import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    result[key] = val;
  }
  return result;
}

export function resolveAnthropicKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  const envFile = readEnvFile(path.join(process.cwd(), ".env"));
  if (envFile.ANTHROPIC_API_KEY) return envFile.ANTHROPIC_API_KEY;

  const credFile = path.join(os.homedir(), ".anthropic", "credentials");
  if (fs.existsSync(credFile)) {
    const creds = readEnvFile(credFile);
    if (creds.ANTHROPIC_API_KEY) return creds.ANTHROPIC_API_KEY;
  }

  throw new Error(
    "ANTHROPIC_API_KEY not found.\n" +
    "Set it via:\n" +
    "  export ANTHROPIC_API_KEY=sk-ant-...\n" +
    "  or add it to .env in your current directory"
  );
}

export function resolveGitHubToken(): string | undefined {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;

  const envFile = readEnvFile(path.join(process.cwd(), ".env"));
  if (envFile.GITHUB_TOKEN) return envFile.GITHUB_TOKEN;

  try {
    const { execSync } = require("child_process");
    const token = execSync("gh auth token 2>/dev/null", { encoding: "utf-8" }).trim();
    if (token) return token;
  } catch {
    // gh CLI not available or not logged in
  }

  return undefined;
}
