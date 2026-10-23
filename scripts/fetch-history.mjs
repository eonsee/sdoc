// Vercel clones with a shallow history, and Nimbus skips git dates
// (`lastUpdated`, sitemap `lastmod`) for shallow clones. Deepen the clone
// before the build so those dates exist. Never fail the build over it:
// without history the pages still build, just without dates.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const status = {
  shallowBefore: null,
  shallowAfter: null,
  unshallowed: false,
  commits: null,
  lastCommit: null,
  error: null,
};

const sanitize = (value) => String(value).replace(/https?:\/\/\S+/g, "<url>");
const git = (args, options = {}) =>
  execFileSync("git", args, {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    timeout: 120_000,
    ...options,
  }).trim();

try {
  status.shallowBefore = git(["rev-parse", "--is-shallow-repository"]);
  if (status.shallowBefore === "true") {
    // No `.trim()` here: this call inherits stdio and returns null.
    execFileSync("git", ["fetch", "--unshallow"], {
      stdio: "inherit",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      timeout: 120_000,
    });
    status.unshallowed = true;
    console.log("Fetched full git history for last-updated dates.");
  }
  status.shallowAfter = git(["rev-parse", "--is-shallow-repository"]);
  status.commits = Number(git(["rev-list", "--count", "HEAD"]));
  status.lastCommit = git(["log", "-1", "--format=%cI"]);
} catch (error) {
  status.error = sanitize(error instanceof Error ? error.message : String(error));
  console.warn("Could not fetch full git history; pages build without last-updated dates.");
  console.warn(status.error);
} finally {
  // Temporary diagnostics: readable from the deployed site at
  // /__build-status.json. Remove along with this block once fixed.
  if (process.env.VERCEL) {
    try {
      mkdirSync("public", { recursive: true });
      writeFileSync("public/__build-status.json", `${JSON.stringify(status, null, 2)}\n`);
    } catch {
      // Diagnostics must never break the build.
    }
  }
}
