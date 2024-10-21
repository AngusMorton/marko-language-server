import fs from "fs";
import path from "path";
import snapshot from "mocha-snap";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position } from "vscode-languageserver";
import { codeFrame } from "./util/code-frame";
import { getLanguageService } from "./util/language-service";

// Project.setDefaultTypePaths({
//   internalTypesFile: require.resolve(
//     "@marko/language-tools/marko.internal.d.ts",
//   ),
//   markoTypesFile: require.resolve("marko/index.d.ts"),
// });

before(async () => {
  await getLanguageService();
  // TODO: Warm up the server?
});

after(async () => {
  const { serverHandle } = await getLanguageService();
  serverHandle.connection.dispose();
});

// const SHOULD_BENCH = process.env.BENCH;
// const BENCHED = new Set<string>();
const FIXTURE_DIR = path.join(__dirname, "fixtures");

for (const subdir of fs.readdirSync(FIXTURE_DIR)) {
  const fixtureSubdir = path.join(FIXTURE_DIR, subdir);

  if (!fs.statSync(fixtureSubdir).isDirectory()) continue;
  for (const entry of fs.readdirSync(fixtureSubdir)) {
    it(entry, async () => {
      const fixtureDir = path.join(fixtureSubdir, entry);

      for (const filename of loadMarkoFiles(fixtureDir)) {
        const { serverHandle } = await getLanguageService();
        const doc = await serverHandle.openTextDocument(filename, "marko");
        const code = doc.getText();
        let results = "";

        for (const position of getHovers(doc)) {
          const hoverInfo = await serverHandle.sendHoverRequest(
            doc.uri,
            position,
          );
          const loc = { start: position, end: position };

          let message = "";
          const contents = hoverInfo?.contents;
          if (contents) {
            if (Array.isArray(contents)) {
              message = "\n" + contents.join("\n  ");
            } else if (typeof contents === "object") {
              message = contents.value;
            } else {
              message = contents;
            }
          }

          if (message) {
            results += `### Ln ${position.line + 1}, Col ${
              position.character + 1
            }\n\`\`\`marko\n${codeFrame(
              code,
              message.replace(/```typescript\r?\n([\s\S]*)\r?\n```/gm, "$1"),
              loc,
            )}\n\`\`\`\n\n`;
          }
        }

        if (results.length) {
          results = `## Hovers\n${results}`;
        }

        const report = await serverHandle.sendDocumentDiagnosticRequest(
          doc.uri,
        );
        if (report.kind === "full" && report.items && report.items.length) {
          results += "## Diagnostics\n";

          for (const error of report.items) {
            const loc = {
              start: error.range.start,
              end: error.range.end,
            };
            results += `### Ln ${loc.start.line + 1}, Col ${
              loc.start.character + 1
            }\n\`\`\`marko\n${codeFrame(code, error.message, loc)}\n\`\`\`\n\n`;
          }
        }

        await serverHandle.closeTextDocument(doc.uri);

        await snapshot(results, {
          file: path.relative(fixtureDir, filename.replace(/\.marko$/, ".md")),
          dir: fixtureDir,
        });
      }
    });
  }
}

// if (SHOULD_BENCH) {
//   after(async function () {
//     this.timeout(0);
//     console.log();
//     await run();
//   });
// }

function* getHovers(doc: TextDocument): Generator<Position> {
  for (const { index } of doc.getText().matchAll(/\^\?/g)) {
    const pos = doc.positionAt(index!);
    yield {
      line: pos.line - 1,
      character: pos.character,
    };
  }
}

export function* loadMarkoFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir)) {
    const file = path.join(dir, entry);
    const stat = fs.statSync(file);
    if (stat.isFile()) {
      if (file.endsWith(".marko")) {
        yield file;
      }
    } else if (stat.isDirectory() && entry !== "__snapshots__") {
      yield* loadMarkoFiles(file);
    }
  }
}
