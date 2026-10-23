// Vercel clones with a shallow history, and Nimbus skips git dates
// (`lastUpdated`, sitemap `lastmod`) for shallow clones. Deepen the clone
// before the build so those dates exist. Never fail the build over it:
// without history the pages still build, just without dates.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const status = {
  shallowBefore: null,
  unshallowedOrigin: false,
  shallowAfterOrigin: null,
  unshallowedGithub: false,
  shallowAfterGithub: null,
  commits: null,
  lastCommit: null,
  error: null,
};

const sanitize = (value) => String(value).replace(/https?:\/\/\S+/g, "<url>");
const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
const git = (args, options = {}) =>
  execFileSync("git", args, { encoding: "utf8", env, timeout: 120_000, ...options }).trim();
const isShallow = () => git(["rev-parse", "--is-shallow-repository"]);
const unshallow = (remote) =>
  execFileSync("git", ["fetch", "--unshallow", remote], {
    stdio: "inherit",
    env,
    timeout: 120_000,
  });

try {
  status.shallowBefore = isShallow();

  if (status.shallowBefore === "true") {
    try {
      unshallow("origin");
      status.unshallowedOrigin = true;
    } catch (error) {
      status.error = sanitize(error instanceof Error ? error.message : String(error));
    }
    status.shallowAfterOrigin = isShallow();
  }

  // Vercel's origin can itself be a shallow mirror, so unshallowing it can be
  // a no-op. The repo is public, so fetch the real history straight from
  // GitHub, built from the environment Vercel exposes.
  if (status.shallowAfterOrigin === "true") {
    const owner = process.env.VERCEL_GIT_REPO_OWNER;
    const slug = process.env.VERCEL_GIT_REPO_SLUG;
    if (owner && slug) {
      try {
        unshallow(`https://github.com/${owner}/${slug}.git`);
        status.unshallowedGithub = true;
      } catch (error) {
        status.error = sanitize(error instanceof Error ? error.message : String(error));
      }
      status.shallowAfterGithub = isShallow();
    }
  }

  status.commits = Number(git(["rev-list", "--count", "HEAD"]));
  status.lastCommit = git(["log", "-1", "--format=%cI"]);
  console.log(`Git history: shallow ${isShallow()}, ${status.commits} commit(s).`);
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
