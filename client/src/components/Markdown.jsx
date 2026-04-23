/**
 * Markdown wrapper that provides CDN URL resolution for images.
 * Uses stagebook's Markdown component with the Empirica CDN resolver.
 */
import React from "react";
import { useGlobal } from "@empirica/core/player/react";
import { Markdown as StagebookMarkdown, Loading } from "stagebook/components";

export function Markdown({ text }) {
  const globals = useGlobal();

  if (!globals) return <Loading />;
  const cdnURL = globals?.get("recruitingBatchConfig")?.cdnURL;

  const resolveURL = (path) => {
    if (!cdnURL) return path;
    return encodeURI(`${cdnURL}/${path}`);
  };

  return <StagebookMarkdown text={text} resolveURL={resolveURL} />;
}
