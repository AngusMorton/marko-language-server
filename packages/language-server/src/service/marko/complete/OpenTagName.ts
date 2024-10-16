import type { CompletionItem } from "vscode-languageserver";
import { type Node, NodeType } from "@marko/language-tools";
import getTagNameCompletion from "../util/get-tag-name-completion";
import { MarkoVirtualCode } from "../../core/marko-plugin";

export function OpenTagName(
  node: Node.OpenTagName,
  file: MarkoVirtualCode,
): CompletionItem[] | undefined {
  const tag = node.parent;
  const range = file.markoAst.locationAt(node);
  const isAttrTag = tag.type === NodeType.AttrTag;
  const result: CompletionItem[] = [];

  if (isAttrTag) {
    let parentTag = tag.owner;
    while (parentTag?.type === NodeType.AttrTag) parentTag = parentTag.owner;
    const parentTagDef =
      parentTag &&
      parentTag.nameText &&
      file.tagLookup.getTag(parentTag.nameText);

    if (parentTagDef) {
      const { nestedTags } = parentTagDef;
      for (const key in nestedTags) {
        if (key !== "*") {
          const tag = nestedTags[key];
          result.push(
            getTagNameCompletion({
              tag,
              range,
              importer: file.fileName,
              showAutoComplete: true,
            }),
          );
        }
      }
    }
  } else {
    const skipStatements = !(
      tag.concise && tag.parent.type === NodeType.Program
    );
    for (const tag of file.tagLookup.getTagsSorted()) {
      if (
        !(
          tag.name === "*" ||
          tag.isNestedTag ||
          (skipStatements && tag.parseOptions?.statement) ||
          (tag.name[0] === "_" &&
            /^@?marko[/-]|[\\/]node_modules[\\/]/.test(tag.filePath))
        )
      ) {
        const completion = getTagNameCompletion({
          tag,
          range,
          importer: file.fileName,
          showAutoComplete: true,
        });
        completion.sortText = `0${completion.label}`; // Ensure higher priority than typescript.
        result.push(completion);
      }
    }
  }

  return result;
}
