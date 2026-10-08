import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runGit = (args) => execFileSync("git", args, { cwd: root, encoding: "buffer" });
const splitNul = (buffer) => buffer.toString("utf8").split("\0").filter(Boolean);
const staged = splitNul(runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]));
const candidates = new Set([
  ...splitNul(runGit(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])),
  ...staged,
]);

const sensitivePath = (file) => {
  const base = path.posix.basename(file);
  if (base === ".env.example") return false;
  return /^\.env(?:\.|$)/i.test(base)
    || /\.(?:pem|p12|pfx|key)$/i.test(base)
    || /(^|\.)(?:credentials|secrets?)(\.|$)/i.test(base);
};

const patterns = [
  /AIza[0-9A-Za-z_-]{30,}/,
  /\bAQ\.[A-Za-z0-9_-]{30,}/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /\bsb_secret_[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /postgres(?:ql)?:\/\/[^\s/:@]+:[^\s/@]+@/i,
];

const findings = [];
for (const file of candidates) {
  if (sensitivePath(file)) {
    findings.push(`${file}: secret-bearing filename`);
    continue; // Never open secret-bearing files, even if they were force-added.
  }

  let contents;
  try {
    contents = await readFile(path.join(root, file));
  } catch {
    continue; // Deleted or inaccessible paths are not scanned as working-tree files.
  }
  if (contents.includes(0)) continue;
  const source = contents.toString("utf8");
  if (patterns.some((pattern) => pattern.test(source))) findings.push(`${file}: possible credential pattern`);
}

if (findings.length) {
  console.error("Secret-safety check failed. Finding locations only; file contents are never displayed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secret-safety check passed (${candidates.size} eligible paths; ignored local environment files were not read).`);
