import { useEffect } from "react";

// register a beforeunload handler to warn players who are
// trying to leave the page during the experiment

export function ConfirmLeave() {
  const beforeUnloadHandler = (event) => {
    event.preventDefault();
    // eslint-disable-next-line no-param-reassign
    event.returnValue = true; // for backwards compatibility
  };

  useEffect(() => {
    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    };
  }, []);

  return null;
}
