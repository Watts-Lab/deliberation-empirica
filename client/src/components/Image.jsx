import React from "react";
import { useFileURL } from "./hooks";

export function Image({ file, width }) {
  const url = useFileURL({ file });
  return (
    <div className="flex justify-center">
      <img src={url} alt="" width={width ? `${width}%` : "100%"} />
    </div>
  );
}
