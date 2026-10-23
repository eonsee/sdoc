// Vercel clones with a shallow history, and Nimbus skips git dates
// (`lastUpdated`, sitemap `lastmod`) for shallow clones. Deepen the clone
// before the build so those dates exist. Never fail the build over it:
// without history the pages still build, just without dates.
import { execFileSync } from "node:child_process";

const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
const git = (args, options = {}) =>
  execFileSync("git", args, { encoding: "utf8", env, timeout: 120_000, ...options }).trim();

try {
  if (git(["rev-parse", "--is-shallow-repository"]) === "true") {
    // Vercel's origin is a shallow mirror, so unshallowing it fetches
    // nothing. The GitHub URL built from Vercel's environment has the real
    // history. Elsewhere, origin is the right remote.
    const owner = process.env.VERCEL_GIT_REPO_OWNER;
    const slug = process.env.VERCEL_GIT_REPO_SLUG;
    const remote = owner && slug ? `https://github.com/${owner}/${slug}.git` : "origin";
    execFileSync("git", ["fetch", "--unshallow", remote], {
      stdio: "inherit",
      env,
      timeout: 120_000,
    });
    console.log("Fetched full git history for last-updated dates.");
  }
} catch (error) {
  console.warn("Could not fetch full git history; pages build without last-updated dates.");
  const message = error instanceof Error ? error.message : String(error);
  console.warn(message.replace(/https?:\/\/\S+/g, "<url>"));
}
