import { packager } from "@electron/packager";
import { downloadArtifact } from "@electron/get";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const electron = JSON.parse(
  await readFile("node_modules/electron/package.json", "utf8"),
);
const checksums = JSON.parse(
  await readFile("node_modules/electron/checksums.json", "utf8"),
);
// Use @electron/get's verified official archive, never an unchecked mirror.
const zip = await downloadArtifact({
  version: electron.version,
  artifactName: "electron",
  platform: process.platform,
  arch: process.arch,
  checksums,
});
await mkdir("release", { recursive: true });
const paths = await packager({
  dir: ".desktop/app",
  out: "release",
  name: "Relaywork",
  executableName: "relaywork",
  appBundleId: "app.relaywork.desktop",
  appVersion: pkg.version,
  platform: process.platform,
  arch: process.arch,
  electronVersion: electron.version,
  electronZipDir: dirname(zip),
  icon: `desktop/assets/icon.${process.platform === "darwin" ? "icns" : process.platform === "win32" ? "ico" : "png"}`,
  asar: false,
  overwrite: true,
  prune: false,
});
if (process.platform === "linux") {
  const archive = join(
    "release",
    `Relaywork-${pkg.version}-linux-${process.arch}.tar.gz`,
  );
  execFileSync("tar", ["-czf", archive, "-C", "release", basename(paths[0])], {
    stdio: "inherit",
  });
  const hash = createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
  await writeFile(archive + ".sha256", `${hash}  ${basename(archive)}\n`);
  console.log("Portable desktop archive: " + archive);
}
console.log("Packaged app: " + paths.join(", "));
