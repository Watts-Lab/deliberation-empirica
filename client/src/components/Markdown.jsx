import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { H1, H2, H3, H4, UL, LI, P } from "./TextStyles";

// the components prop takes an object mapping tag names to React components
export function Markdown({ text }) {
  return (
    <div className="max-w-xl" id="markdown">
      <ReactMarkdown
        components={{ h1: H1, h2: H2, h3: H3, h4: H4, ul: UL, li: LI, p: P }}
        remarkPlugins={[remarkGfm]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
