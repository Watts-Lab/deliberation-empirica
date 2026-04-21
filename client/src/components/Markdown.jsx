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
  const cdnList = globals?.get("cdnList");
  const batchConfig = globals?.get("recruitingBatchConfig");

  const resolveURL = (path) => {
    if (!cdnList || !batchConfig) return path;
    const cdn = batchConfig?.cdn;
    const cdnURL = cdnList?.[cdn] || cdn || cdnList?.prod;
    if (!cdnURL) return path;
    return encodeURI(`${cdnURL}/${path}`);
  };

  return <StagebookMarkdown text={text} resolveURL={resolveURL} />;
}
