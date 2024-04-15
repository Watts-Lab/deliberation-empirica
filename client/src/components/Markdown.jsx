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
  const cdn = batchConfig?.cdn;
  const cdnURL = cdnList[cdn] || cdnList?.prod;

  const displayText = text?.replace(
    /\!\[(.*)\]\((.*)\)/g,
    (match, mouseover, path) => {
      const url = encodeURI(`${cdnURL}/${path}`);
      return `![${mouseover}](${url})`;
    }
  );

  // if (displayText.includes("![")) {
  //   console.log("displayText", displayText);
  // }

  return (
    <div className="max-w-xl" id="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
    </div>
  );
}
