import path from "path";
import {
  type CodeMapping,
  type LanguagePlugin,
  type VirtualCode,
  forEachEmbeddedCode,
} from "@volar/language-core";
import type { URI } from "vscode-uri";
import type ts from "typescript";
import { Project, extractHTML, parse } from "@marko/language-tools";
import { TaglibLookup } from "@marko/babel-utils";
import { CompileResult, Config } from "@marko/compiler";
import { parseScripts } from "./parseScript";
import { parseStyles } from "./parseStyles";

export function getMarkoLanguagePlugin(
  ts: typeof import("typescript"),
): LanguagePlugin<URI, MarkoVirtualCode> {
  return {
    getLanguageId(uri) {
      if (uri.path.endsWith(".marko")) {
        return "marko";
      }
    },
    createVirtualCode(uri, languageId, snapshot) {
      if (languageId === "marko") {
        const fileName = uri.fsPath.replace(/\\/g, "/");
        return new MarkoVirtualCode(fileName, snapshot, ts);
      }
    },
    typescript: {
      extraFileExtensions: [
        { extension: "marko", isMixedContent: true, scriptKind: 7 },
      ],
      getServiceScript(markoCode) {
        for (const code of forEachEmbeddedCode(markoCode)) {
          if (code.id === "script") {
            return {
              code,
              extension: ".ts",
              scriptKind: 3 satisfies ts.ScriptKind.TS,
            };
          }
        }
      },
    },
  };
}

export class MarkoVirtualCode implements VirtualCode {
  id = "root";
  languageId = "marko";
  mappings!: CodeMapping[];
  embeddedCodes!: VirtualCode[];
  markoAst: ReturnType<typeof parse>;
  tagLookup: TaglibLookup;
  htmlAst?: ReturnType<typeof extractHTML>;
  compilerResult?: CompileResult;
  compilerError?: unknown;

  constructor(
    public fileName: string,
    public snapshot: ts.IScriptSnapshot,
    public ts: typeof import("typescript"),
  ) {
    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [this.snapshot.getLength()],
        data: {
          verification: true,
          completion: true,
          semantic: true,
          navigation: true,
          structure: true,
          format: true,
        },
      },
    ];

    this.embeddedCodes = [];

    const text = this.snapshot.getText(0, this.snapshot.getLength());
    this.markoAst = parse(text, this.fileName);

    const dirname = path.dirname(fileName);
    this.tagLookup = Project.getTagLookup(dirname);

    const scripts = parseScripts(this.markoAst, this.ts, this.tagLookup);
    this.embeddedCodes.push(...scripts);

    const styles = parseStyles(this.markoAst, this.tagLookup);
    this.embeddedCodes.push(...styles);

    // Performance problems...
    // this.htmlAst = extractHTML(this.markoAst);
    // const html = parseHtml(this.htmlAst);
    // this.embeddedCodes.push(...html);

    try {
      this.compilerResult = Project.getCompiler(
        this.fileName && path.dirname(this.fileName),
      ).compileSync(text, this.fileName || "untitled.marko", compilerConfig);
    } catch (err) {
      this.compilerError = err;
    }
  }
}

const compilerConfig: Config = {
  code: false,
  output: "migrate",
  sourceMaps: false,
  errorRecovery: true,
  babelConfig: {
    babelrc: false,
    configFile: false,
    browserslistConfigFile: false,
    caller: {
      name: "@marko/language-server",
      supportsStaticESM: true,
      supportsDynamicImport: true,
      supportsTopLevelAwait: true,
      supportsExportNamespaceFrom: true,
    },
  },
};
