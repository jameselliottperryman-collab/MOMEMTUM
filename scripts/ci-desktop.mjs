// Surface a bounded failure summary in GitHub annotations as well as the job log.
// This keeps native build failures diagnosable without publishing an untested app.
import { spawn } from "node:child_process";
const commands = {
  build: [["scripts/build-desktop.mjs"], ["scripts/package-desktop.mjs"]],
  test: [["--test", "tests/desktop.test.mjs"]],
};
const steps = commands[process.argv[2]];
if (!steps) throw new Error("Choose build or test.");
for (const args of steps) {
  let tail = "";
  const child = spawn(process.execPath, args, {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = (stream, data) => {
    stream.write(data);
    tail = (tail + data.toString()).slice(-24000);
  };
  child.stdout.on("data", (data) => capture(process.stdout, data));
  child.stderr.on("data", (data) => capture(process.stderr, data));
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (code !== 0) {
    const summary = tail
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-35)
      .join("\n")
      .slice(-14000);
    const escaped = summary
      .replaceAll("%", "%25")
      .replaceAll("\r", "%0D")
      .replaceAll("\n", "%0A");
    console.error(
      `::error title=Windows desktop ${process.argv[2]}::${escaped}`,
    );
    process.exit(typeof code === "number" ? code : 1);
  }
}
