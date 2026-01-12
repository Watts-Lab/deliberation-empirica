import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useGlobal, Loading } from "@empirica/core/player/react";

// the components prop takes an object mapping tag names to React components
export function Markdown({ text }) {
  const globals = useGlobal();

  if (!globals) return <Loading />;
  const cdnList = globals?.get("cdnList");
  const batchConfig = globals?.get("recruitingBatchConfig");

  // Render immediately; when cdnList + batchConfig are present we can rewrite
  // image URLs to absolute CDN URLs. Without them (e.g., NoGames screen),
  // render the markdown as-is.
  let displayText = text;

  if (cdnList && batchConfig) {
    const cdn = batchConfig?.cdn;
    const cdnURL = cdnList?.[cdn] || cdn || cdnList?.prod;

    displayText = text?.replace(/!\[(.*)\]\((.*)\)/g, (match, mouseover, path) => {
      if (!cdnURL) return match;
      const url = encodeURI(`${cdnURL}/${path}`);
      return `![${mouseover}](${url})`;
    });
  }

  return (
    <div className="max-w-xl" id="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
    </div>
  );
}
