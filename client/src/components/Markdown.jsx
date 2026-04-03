/**
 * Markdown wrapper that provides CDN URL resolution for images.
 * Uses SCORE's Markdown component with the Empirica CDN resolver.
 */
import React from "react";
import { useGlobal } from "@empirica/core/player/react";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Markdown as ScoreMarkdown, Loading } from "@deliberation-lab/score/components";

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

  return <ScoreMarkdown text={text} resolveURL={resolveURL} />;
}
