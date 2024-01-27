import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// import { H1, H2, H3, H4, UL, LI, P, A} from "./TextStyles";

function CustomList({ children, start, depth, ordered }) {
  const marginLeft = (depth + 1) * 20;

  const listStyleType = ordered ? 'decimal' : 'disc';

  const style = {
    marginLeft,
    listStyleType,
  };

  if (ordered) {
    return <ol start={start} style={style}>{children}</ol>;
  } 
  return <ul style={style}>{children}</ul>;
}

function CustomListItem({ children }) {
  return <li className="mt-2 font-normal text-base text-gray-600">{children}</li>;
}

// the components prop takes an object mapping tag names to React components
export function Markdown({ text }) {
  return (
    <div className="max-w-xl" id="markdown">
      <ReactMarkdown
        // components={{ h1: H1, h2: H2, h3: H3, h4: H4, ul: UL, li: LI, p: P, a: A}}
        components={{ ul: CustomList, ol: CustomList, li: CustomListItem }}
        remarkPlugins={[remarkGfm]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
