import type { Element, ElementContent, Text } from "hast";
import { h } from "hastscript";

/** SVG icon for a file */
function fileIcon(): Element {
  return h(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      class: "ft-icon",
    },
    [
      h("path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" }),
      h("path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }),
    ],
  );
}

/** SVG icon for a folder */
function folderIcon(): Element {
  return h(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      class: "ft-icon",
    },
    [
      h("path", {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
      }),
    ],
  );
}

/** Check if a node is an element with a given tag */
function isElement(node: ElementContent, tag: string): node is Element {
  return node.type === "element" && node.tagName === tag;
}

/** Check if text looks like a placeholder (... or ellipsis) */
function isPlaceholder(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === "..." || trimmed === "\u2026";
}

/** Get text content of a node (shallow) */
function getTextContent(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") {
    return node.children.map((c) => getTextContent(c)).join("");
  }
  return "";
}

/** Check if this li contains a nested ul (making it a directory) */
function hasNestedList(li: Element): boolean {
  return li.children.some((child) => isElement(child, "ul"));
}

/** Check if a name ends with / (directory marker) */
function isDirectoryName(name: string): boolean {
  return name.endsWith("/");
}

/**
 * Process a single <li> into a file tree entry.
 * Returns the transformed element.
 */
function processListItem(li: Element): Element {
  const children = li.children.filter(
    (c) => !(c.type === "text" && c.value.trim() === ""),
  );

  // Separate nested <ul> from inline content
  const inlineContent: ElementContent[] = [];
  let nestedList: Element | null = null;

  for (const child of children) {
    if (isElement(child, "ul")) {
      nestedList = child;
    } else {
      inlineContent.push(child);
    }
  }

  // Extract the file/folder name and detect features
  let isHighlighted = false;
  let isDirectory = nestedList !== null;
  const nameNodes: ElementContent[] = [];
  const commentNodes: ElementContent[] = [];
  let foundName = false;

  for (const node of inlineContent) {
    if (!foundName) {
      if (isElement(node, "strong")) {
        // Highlighted entry
        isHighlighted = true;
        nameNodes.push(...node.children);
        foundName = true;
      } else if (isElement(node, "a")) {
        nameNodes.push(node);
        foundName = true;
      } else if (node.type === "text") {
        const text = node.value;
        // The name is the first word/path segment
        if (!text.trim()) continue;
        nameNodes.push(node);
        foundName = true;
      } else if (isElement(node, "code")) {
        nameNodes.push(node);
        foundName = true;
      } else {
        nameNodes.push(node);
        foundName = true;
      }
    } else {
      commentNodes.push(node);
    }
  }

  // Check if the name text implies a directory
  const nameText = nameNodes.map((n) => getTextContent(n)).join("").trim();
  if (isDirectoryName(nameText)) {
    isDirectory = true;
  }

  // Check for placeholder
  if (isPlaceholder(nameText)) {
    return h("li", { class: "ft-entry ft-placeholder" }, [
      h("span", { class: "ft-entry-inner" }, [
        h("span", { class: "ft-name ft-placeholder-text" }, [
          { type: "text", value: "\u2026" } as Text,
        ]),
      ]),
    ]);
  }

  // Clean trailing slash from directory names for display
  const displayNameNodes: ElementContent[] = nameNodes.map((n) => {
    if (n.type === "text" && n.value.endsWith("/")) {
      return { ...n, value: n.value.slice(0, -1) } as Text;
    }
    return n;
  });

  // Build the icon
  const icon = isDirectory ? folderIcon() : fileIcon();

  // Build name span
  const nameSpan = h(
    "span",
    { class: isHighlighted ? "ft-name ft-highlight" : "ft-name" },
    displayNameNodes,
  );

  // Build comment span if present
  const commentSpan =
    commentNodes.length > 0
      ? h("span", { class: "ft-comment" }, commentNodes)
      : null;

  const entryInner: ElementContent[] = [icon, nameSpan];
  if (commentSpan) entryInner.push(commentSpan);

  if (isDirectory && nestedList) {
    // Process nested list recursively
    const processedList = processFileList(nestedList);

    // Directory with children: collapsible
    const summary = h("summary", { class: "ft-entry-inner ft-dir-summary" }, entryInner);
    const details = h("details", { open: true }, [summary, processedList]);

    return h("li", { class: "ft-entry ft-directory" }, [details]);
  } else if (isDirectory) {
    // Empty directory (name ended with / but no children)
    return h("li", { class: "ft-entry ft-directory" }, [
      h("span", { class: "ft-entry-inner" }, entryInner),
    ]);
  } else {
    // Regular file
    return h("li", { class: "ft-entry ft-file" }, [
      h("span", { class: "ft-entry-inner" }, entryInner),
    ]);
  }
}

/** Process a <ul> element, transforming all its <li> children */
function processFileList(ul: Element): Element {
  const processed = ul.children
    .filter((child): child is Element => isElement(child as ElementContent, "li"))
    .map((li) => processListItem(li));

  return h("ul", { class: "ft-list", role: "tree" }, processed);
}

/**
 * Transform raw HTML (from markdown list) into file tree HTML.
 * Takes the HTML string from the slot and returns transformed HTML.
 */
export async function transformFileTree(html: string): Promise<string> {
  const { rehype } = await import("rehype");
  const { toHtml } = await import("hast-util-to-html");
  const { visit } = await import("unist-util-visit");

  const processor = rehype().data("settings", { fragment: true });
  const tree = processor.parse(html);

  // Find the top-level <ul> and process it
  visit(tree, "element", (node, index, parent) => {
    if (node.tagName === "ul" && parent && index !== undefined) {
      const processed = processFileList(node);
      (parent.children as ElementContent[])[index] = processed;
      return "skip";
    }
  });

  return toHtml(tree);
}
