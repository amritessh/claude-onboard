#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

import { readGitHubRepo, readLocalRepo, resolveGitHubToken } from "./lib";
import { generateClaudeMd, generateArchitectureMd } from "./generator";

const program = new Command();

program
  .name("claude-onboard")
  .description("Generate CLAUDE.md and ARCHITECTURE.md for any GitHub repo or local project")
  .version("0.1.0")
  .argument("<source>", "GitHub URL (https://github.com/owner/repo) or local path (.)")
  .option("-o, --output-dir <path>", "Output directory", ".")
  .option("--dry-run", "Print to stdout instead of writing files")
  .option("--no-architecture", "Skip generating ARCHITECTURE.md")
  .option("--github-token <token>", "GitHub token (raises API rate limits)")
  .action(async (source: string, opts) => {
    try {
      console.log(`Reading repository: ${source}`);

      const isGitHub =
        source.startsWith("https://github.com") ||
        source.startsWith("github.com") ||
        /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(source);

      const ctx = isGitHub
        ? await readGitHubRepo(source, opts.githubToken ?? resolveGitHubToken())
        : await readLocalRepo(source);

      console.log(
        `Read ${ctx.files.length} files from ${ctx.owner}/${ctx.repo}` +
        (ctx.truncated ? " (truncated to fit context)" : "")
      );

      console.log("Generating CLAUDE.md...");
      const claudeMd = await generateClaudeMd(ctx);

      let architectureMd: string | null = null;
      if (opts.architecture !== false) {
        console.log("Generating ARCHITECTURE.md...");
        architectureMd = await generateArchitectureMd(ctx);
      }

      if (opts.dryRun) {
        console.log("\n========== CLAUDE.md ==========\n");
        console.log(claudeMd);
        if (architectureMd) {
          console.log("\n========== ARCHITECTURE.md ==========\n");
          console.log(architectureMd);
        }
      } else {
        const outDir = path.resolve(opts.outputDir);
        fs.mkdirSync(outDir, { recursive: true });

        const claudePath = path.join(outDir, "CLAUDE.md");
        const archPath = path.join(outDir, "ARCHITECTURE.md");

        fs.writeFileSync(claudePath, claudeMd, "utf-8");
        console.log(`Written: ${claudePath}`);

        if (architectureMd) {
          fs.writeFileSync(archPath, architectureMd, "utf-8");
          console.log(`Written: ${archPath}`);
        }

        console.log("\nDone! Your repo is ready for Claude Code.");
      }
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse();
