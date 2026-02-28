import React from "react";

const ao3WorksRegex =
  /\bhttps?:\/\/(?:www\.)?(?:archiveofourown\.org)\/works\/\d+\b/gi;

export function linkifyText(text: string) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(ao3WorksRegex)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const end = start + raw.length;

    // Text before link
    if (start > lastIndex) {
      nodes.push(
        <React.Fragment key={`t-${lastIndex}`}>
          {text.slice(lastIndex, start)}
        </React.Fragment>
      );
    }

    nodes.push(
      <a
        key={`a-${start}`}
        href={raw}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2 break-all"
      >
        {raw}
      </a>
    );

    lastIndex = end;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(
      <React.Fragment key={`t-${lastIndex}`}>
        {text.slice(lastIndex)}
      </React.Fragment>
    );
  }

  return nodes;
}