import { copyFileSync, existsSync, writeFileSync } from "node:fs";

const clientDir = "dist/client";
const shell = existsSync(`${clientDir}/_shell.html`)
  ? `${clientDir}/_shell.html`
  : `${clientDir}/index.html`;

if (!existsSync(shell)) {
  throw new Error(`No SPA HTML found in ${clientDir}`);
}

copyFileSync(shell, `${clientDir}/index.html`);
copyFileSync(shell, `${clientDir}/404.html`);
writeFileSync(`${clientDir}/.nojekyll`, "");
