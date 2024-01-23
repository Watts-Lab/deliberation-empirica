import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useGlobal, Loading } from "@empirica/core/player/react";
import { H1, H2, H3, H4, UL, LI, P, A } from "./TextStyles";

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
      <ReactMarkdown
        components={{
          h1: H1,
          h2: H2,
          h3: H3,
          h4: H4,
          ul: UL,
          li: LI,
          p: P,
          a: A,
        }}
        remarkPlugins={[remarkGfm]}
      >
        {displayText}
      </ReactMarkdown>
    </div>
  );
}
