import {
  LanguageServicePlugin,
  LanguageServicePluginInstance,
} from "@volar/language-service";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";
import { MarkoVirtualCode } from "../core/marko-plugin";
import { provideCompletions } from "./complete";
import { provideHover } from "./hover";
import { provideValidations } from "./validate";
import { provideDefinitions } from "./definition";

export const create = (
  _: typeof import("typescript"),
): LanguageServicePlugin => {
  return {
    capabilities: {
      hoverProvider: true,
      definitionProvider: true,
      diagnosticProvider: {
        interFileDependencies: true,
        workspaceDiagnostics: false,
      },
      completionProvider: {
        triggerCharacters: [
          ".",
          ":",
          "<",
          ">",
          "@",
          "/",
          '"',
          "'",
          "`",
          " ",
          "=",
          "*",
          "#",
          "$",
          "+",
          "^",
          "(",
          "[",
          "-",
        ],
      },
    },
    create(context): LanguageServicePluginInstance {
      return {
        provideDefinition(document, position, token) {
          if (token.isCancellationRequested) return;
          return worker(document, (virtualCode) => {
            const offset = document.offsetAt(position);
            return provideDefinitions(virtualCode, offset);
          });
        },
        provideDiagnostics(document, token) {
          if (token.isCancellationRequested) return;
          return worker(document, (virtualCode) => {
            return provideValidations(virtualCode);
          });
        },
        provideHover(document, position, token) {
          if (token.isCancellationRequested) return;
          return worker(document, (virtualCode) => {
            const offset = document.offsetAt(position);
            return provideHover(virtualCode, offset);
          });
        },
        provideCompletionItems(document, position, _, token) {
          if (token.isCancellationRequested) return;
          return worker(document, (virtualCode) => {
            const offset = document.offsetAt(position);
            const completions = provideCompletions(virtualCode, offset);

            if (completions) {
              return {
                isIncomplete: false,
                items: completions,
              };
            }

            return {
              items: [],
              isIncomplete: true,
            };
          });
        },
      };

      async function worker<T>(
        document: TextDocument,
        callback: (markoDocument: MarkoVirtualCode) => T,
      ): Promise<Awaited<T> | undefined> {
        const decoded = context.decodeEmbeddedDocumentUri(
          URI.parse(document.uri),
        );
        const sourceScript =
          decoded && context.language.scripts.get(decoded[0]);
        const virtualCode =
          decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
        if (!(virtualCode instanceof MarkoVirtualCode)) return;

        return await callback(virtualCode);
      }
    },
  };
};

// export default {
//   findDefinition,
//   findDocumentLinks,
//   findDocumentSymbols,
//   format,
//   commands: {
//     "$/formatWithMode": async ({
//       doc: docURI,
//       options,
//     }: {
//       doc: string;
//       options: FormatOptions;
//     }) => {
//       const doc = documents.get(docURI)!;
//       const formatted = await formatDocument(doc, options);
//       return formatted;
//     },
//   },
// } as Partial<Plugin>;
