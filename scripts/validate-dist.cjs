const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const distDirectory = resolve(process.cwd(), "dist");
const entryPoint = resolve(distDirectory, "index.html");

if (!existsSync(entryPoint)) {
  throw new Error("Build invalido: dist/index.html nao foi gerado.");
}

const html = readFileSync(entryPoint, "utf8");
const assetReferences = [...html.matchAll(/\b(?:src|href)=["']([^"'#?]+)["']/g)]
  .map((match) => match[1])
  .filter((reference) => !/^(?:data:|https?:|\/\/)/i.test(reference));

if (!assetReferences.some((reference) => reference.endsWith(".js"))) {
  throw new Error("Build invalido: index.html nao referencia o bundle JavaScript.");
}

const missingAssets = assetReferences.filter((reference) => {
  const relativePath = decodeURIComponent(reference).replace(/^\.\//, "").replace(/^\//, "");
  return !existsSync(resolve(distDirectory, relativePath));
});

if (missingAssets.length > 0) {
  throw new Error(
    `Build invalido: index.html referencia arquivos ausentes: ${missingAssets.join(", ")}`,
  );
}

console.log(`Build validado: ${assetReferences.length} recurso(s) referenciado(s) existem em dist.`);
