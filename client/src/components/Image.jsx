import React from "react";
import { Loading } from "@empirica/core/player/react";
import { useFileURL } from "./hooks";

export function Image({ file, width }) {
  const url = useFileURL({ file });
  if (!url) return <Loading />;
  return (
    <div className="flex justify-center">
      <img src={url} alt="" width={width ? `${width}%` : "100%"} />
    </div>
  );
}
