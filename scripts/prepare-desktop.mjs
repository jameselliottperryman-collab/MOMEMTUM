import { cp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
const root = process.cwd();
const source = join(root, ".next", "standalone");
await access(join(source, "server.js"));
const output = join(root, ".desktop", "app");
// Only generated desktop staging files are replaced. User data is never staged.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const filter = (path) =>
  ![".data", ".git"].includes(basename(path)) &&
  !basename(path).startsWith(".env");
await cp(source, join(output, "server"), {
  recursive: true,
  dereference: true,
  filter,
});
await cp(
  join(root, ".next", "static"),
  join(output, "server", ".next", "static"),
  { recursive: true },
);
await cp(join(root, "public"), join(output, "server", "public"), {
  recursive: true,
});
await cp(join(root, "desktop"), join(output, "desktop"), { recursive: true });
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
await writeFile(
  join(output, "package.json"),
  JSON.stringify(
    {
      name: "relaywork",
      productName: "Relaywork",
      version: pkg.version,
      description:
        "A little more in sync. Local desktop project collaboration.",
      main: "desktop/main.cjs",
      private: true,
    },
    null,
    2,
  ) + "\n",
);
await cp(join(root, "README.md"), join(output, "README.md"));
console.log(
  "Desktop server, interface, fonts, and native shell prepared in " +
    resolve(output),
);
