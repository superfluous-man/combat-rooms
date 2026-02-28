import React from "react";

const urlRegex =
  /((https?:\/\/|www\.)[^\s]+)/gi;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
    }
  }
}

function normalizeUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}

export function linkifyText(text: string) {
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return React.createElement("a", {
        key: index,
        href: normalizeUrl(part),
        target: "_blank",
        rel: "noopener noreferrer",
        className: "text-indigo-600 hover:text-indigo-700 underline underline-offset-2 break-all"
      }, part);
    }
    return React.createElement(React.Fragment, { key: index }, part);
  });
}