import React from "react";

export function Separator({ 
    style = "", 
    testId = "unnamedSeparator" 
}) {
    
    return(
        <div data-test={testId}>
           {style === "thin" && <hr className="h-px my-4 w-full bg-gray-200"/>}
           {(style === "" || style === "regular") && <hr className="h-0.5 my-4 w-full bg-gray-200"/>}
           {style === "thick" && <hr className="h-1 my-4 w-full bg-gray-200"/>}
        </div>
    );
}