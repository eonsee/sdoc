// Vercel clones with a shallow history, and Nimbus skips git dates
// (`lastUpdated`, sitemap `lastmod`) for shallow clones. Deepen the clone
// before the build so those dates exist. Never fail the build over it:
// without history the pages still build, just without dates.
import { execFileSync } from "node:child_process";

try {
  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    timeout: 30_000,
  }).trim();

  if (shallow === "true") {
    execFileSync("git", ["fetch", "--unshallow"], {
      stdio: "inherit",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      timeout: 120_000,
    });
    console.log("Fetched full git history for last-updated dates.");
  }
} catch (error) {
  console.warn("Could not fetch full git history; pages build without last-updated dates.");
  console.warn(error instanceof Error ? error.message : String(error));
}
