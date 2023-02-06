import React from "react";

export function Separator({ style = "", testId = "unnamedSeparator" }) {
  return (
    <div data-test={testId}>
      {style === "thin" && <hr className="h-1px my-4 w-full bg-gray-400" />}
      {(style === "" || style === "regular") && (
        <hr className="h-3px my-4 w-full bg-gray-400" />
      )}
      {style === "thick" && <hr className="h-5px my-4 w-full bg-gray-500" />}
    </div>
  );
}
