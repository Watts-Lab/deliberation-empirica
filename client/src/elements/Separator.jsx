import React from "react";

export function Separator({ 
    style, 
    testId = "unnamedSeparator" 
}) {
    return(
        <div data-test={testId}>
        {style === "thin" && (
            <span className="h-px w-full lg:w-2/3"></span>
        )}

        { style === "regular" && (
            <span className="h-0.5 w-full lg:w-2/3"></span>
        )}

        {style === "thick" && (
            <span className="h-1 w-full lg:w-23"></span> 
        )}
        </div>
    );
}