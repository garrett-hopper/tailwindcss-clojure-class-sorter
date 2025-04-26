const vscode = require("vscode");
const fs = require("node:fs");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { __unstable__loadDesignSystem } = require("tailwindcss");
const { CachedInputFileSystem, ResolverFactory } = require("enhanced-resolve");

const outputChannel = vscode.window.createOutputChannel(
  "Tailwind CSS Clojure Class Sorter"
);

const cssResolver = ResolverFactory.createResolver({
  fileSystem: new CachedInputFileSystem(fs, 4000),
  useSyncFileSystemCalls: true,
  extensions: [".css"],
  mainFields: ["style"],
  conditionNames: ["style"],
});

const moduleResolver = ResolverFactory.createResolver({
  fileSystem: new CachedInputFileSystem(fs, 4000),
  useSyncFileSystemCalls: true,
  extensions: [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"],
  mainFields: ["main", "module"],
  conditionNames: ["node", "import", "require"],
});

async function loadStylesheet(id, base) {
  outputChannel.appendLine(`Loading stylesheet: ${id} from ${base}`);
  return new Promise((resolve, reject) => {
    cssResolver.resolve({}, base, id, {}, async (err, resolvedPath) => {
      if (err || !resolvedPath) {
        return reject(err || new Error(`Could not resolve stylesheet: ${id}`));
      }
      try {
        resolve({
          content: await readFile(resolvedPath, "utf8"),
          base: path.dirname(resolvedPath),
        });
      } catch (error) {
        outputChannel.appendLine(
          `Error reading stylesheet: ${id} from ${resolvedPath}: ${error.message}`
        );
        reject(error);
      }
    });
  });
}

async function loadModule(id, base) {
  outputChannel.appendLine(`Loading module: ${id} from ${base}`);
  return new Promise((resolve, reject) => {
    moduleResolver.resolve({}, base, id, {}, async (error, resolvedPath) => {
      if (error) {
        outputChannel.appendLine(
          `Error resolving module: ${id} from ${base}: ${error.message}`
        );
        return reject(error);
      }

      outputChannel.appendLine(`Resolved module ${id} path: ${resolvedPath}`);
      try {
        const module = await import(resolvedPath);
        resolve({ module: module.default ?? module, base });
      } catch (error) {
        outputChannel.appendLine(
          `Error importing module: ${id} from ${resolvedPath}: ${error.message}`
        );
        reject(error);
      }
    });
  });
}

function sortClasses(designSystem, classes) {
  return designSystem
    .getClassOrder(classes)
    .sort(
      ([kA, vA], [kB, vB]) =>
        (vB === null) - (vA === null) || // sort nulls first
        (vA === null && vB === null
          ? kA.localeCompare(kB) // both null, sort by key
          : (vA > vB) - (vA < vB) || // sort by BigInt value
            kA.localeCompare(kB)) // values equal, sort by key
    )
    .map(([k]) => k);
}

async function getDesignSystem() {
  const tailwindCssPath = vscode.workspace
    .getConfiguration("tailwindCssClojureClassSorter")
    .get("tailwindCssPath", "");

  const baseWs = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  const resolvedCss = tailwindCssPath
    ? path.resolve(baseWs, tailwindCssPath)
    : path.join(baseWs, "node_modules", "tailwindcss", "theme.css");

  let cssContent;
  try {
    cssContent = await readFile(resolvedCss, "utf8");
    outputChannel.appendLine(`Read Tailwind CSS from: ${resolvedCss}`);
  } catch (error) {
    outputChannel.appendLine(`Error reading Tailwind CSS file: ${error}`);
    vscode.window.showErrorMessage(
      `Failed to read Tailwind CSS file at ${resolvedCss}. Please check the path and permissions. Error: ${error.message}`
    );
    return null;
  }

  const baseDir = path.dirname(resolvedCss);

  const designSystem = await __unstable__loadDesignSystem(cssContent, {
    base: baseDir,
    loadStylesheet,
    loadModule,
  });
  outputChannel.appendLine("Successfully loaded Tailwind design system.");
  return designSystem;
}

const RULES = [
  // outer, inner, delimiter
  [':class\\s+"([^"]+)"', "(\\S+)", " "],
  ['\\^:tw\\s+"([^"]+)"', "(\\S+)", " "],
  [":((?:\\.[\\w-]+)+)", "\\.([\\w-]+)", "."],
  [
    "\\[:[\\w-]*(?:#[\\w-]+)?((?:\\.[\\w-]+)+)(?=[\\s\\]])",
    "\\.([\\w-]+)",
    ".",
  ],
];

function getWorkspaceEdit(doc, designSystem) {
  const edit = new vscode.WorkspaceEdit();
  const text = doc.getText();
  for (const [_outer, _inner, delim] of RULES) {
    const outer = new RegExp(_outer, "g");
    const inner = new RegExp(_inner, "g");
    let match;
    while ((match = outer.exec(text))) {
      const [whole, captured] = match;
      const classes = Array.from(captured.matchAll(inner), (m) => m[1]);
      const prefix = delim === "." ? "." : "";
      const sorted = prefix + sortClasses(designSystem, classes).join(delim);
      if (sorted === captured) continue;
      const offset = match.index + whole.indexOf(captured);

      edit.replace(
        doc.uri,
        new vscode.Range(
          doc.positionAt(offset),
          doc.positionAt(offset + captured.length)
        ),
        sorted
      );
    }
  }
  return edit;
}

class SortTailwindClassesCodeActionProvider {
  static kind = vscode.CodeActionKind.Source.append("sortTailwindClasses");

  async provideCodeActions(doc) {
    if (doc.languageId !== "clojure") return;

    const designSystem = await getDesignSystem();
    if (!designSystem) return;

    const action = new vscode.CodeAction(
      "Sort Tailwind Classes",
      SortTailwindClassesCodeActionProvider.kind
    );
    action.edit = getWorkspaceEdit(doc, designSystem);
    return [action];
  }
}

exports.activate = (context) => {
  outputChannel.appendLine(
    "Tailwind CSS Clojure Class Sorter extension activated."
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      "clojure",
      new SortTailwindClassesCodeActionProvider(),
      {
        providedCodeActionKinds: [SortTailwindClassesCodeActionProvider.kind],
      }
    )
  );

  context.subscriptions.push(outputChannel);
};
