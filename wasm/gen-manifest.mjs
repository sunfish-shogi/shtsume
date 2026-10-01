// ビルドした WebAssembly モジュールを Node.js で起動し、
// usi コマンドへの応答 (id name / id author / option) を wasm/manifest.json に
// 書き加えて engine.json を生成する。
//
// マニフェストの name / author / options はエンジンの申告と一致している必要があるため
// (ShogiHome の適合性テストが検証する)、手で写さずに実物から取得する。
//
// 使い方: node wasm/gen-manifest.mjs <template> <module.js> <output>
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [templatePath, modulePath, outputPath] = process.argv.slice(2);
if (!templatePath || !modulePath || !outputPath) {
  console.error("usage: node gen-manifest.mjs <template> <module.js> <output>");
  process.exit(1);
}

const template = JSON.parse(fs.readFileSync(templatePath, "utf-8"));
const createEngine = (await import(pathToFileURL(path.resolve(modulePath)).href)).default;
const engine = await createEngine({
  print: () => {},
  printErr: (line) => console.error(line),
});

const lines = await new Promise((resolve, reject) => {
  const received = [];
  const timer = setTimeout(() => reject(new Error("usiok was not received")), 10000);
  engine.addMessageListener((line) => {
    received.push(line);
    if (line.trim() === "usiok") {
      clearTimeout(timer);
      resolve(received);
    }
  });
  engine.postMessage("usi");
});
engine.terminate();

let name;
let author;
const declared = new Map();
for (const line of lines) {
  if (line.startsWith("id name ")) {
    name = line.substring("id name ".length).trim();
  } else if (line.startsWith("id author ")) {
    author = line.substring("id author ".length).trim();
  } else if (line.startsWith("option ")) {
    const option = parseOption(line);
    declared.set(option.name, option);
  }
}
if (!name || !author) {
  throw new Error("id name / id author was not received");
}

const options = template.optionNames.map((optionName) => {
  const option = declared.get(optionName);
  if (!option) {
    throw new Error(`option ${optionName} is not declared by the engine`);
  }
  return option;
});

const { abi, module, moduleFormat, optionNames: _, presets, ...rest } = template;
const manifest = { abi, module, moduleFormat, name, author, ...rest, options, presets };
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`generated ${outputPath}`);
process.exit(0);

// "option name <name> type <type> default <value> [min <n> max <n>] [var <v> ...]"
function parseOption(line) {
  const tokens = line.trim().split(/\s+/);
  const option = {};
  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case "name":
        option.name = tokens[++i];
        break;
      case "type":
        option.type = tokens[++i];
        break;
      case "default":
        option.default = tokens[++i];
        break;
      case "min":
        option.min = Number(tokens[++i]);
        break;
      case "max":
        option.max = Number(tokens[++i]);
        break;
      case "var":
        (option.vars ||= []).push(tokens[++i]);
        break;
    }
  }
  if (option.type === "spin") {
    option.default = Number(option.default);
  }
  return option;
}
