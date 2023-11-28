import React, { useEffect } from "react";

// register a beforeunload handler to warn players who are
// trying to leave the page during the experiment

export function ConfirmLeave() {
  const beforeUnloadHandler = (event) => {
    event.preventDefault();
    event.returnValue = true;
  };

  useEffect(() => {
    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    };
  }, []);

  return null;
}
