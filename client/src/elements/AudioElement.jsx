import { useEffect } from "react";
import { useFileURL } from "../components/hooks";

export function AudioElement({ file }) {
  const fileURL = useFileURL({ file });

  useEffect(() => {
    if (!fileURL) return undefined;

    const sound = new Audio(fileURL);

    const handleCanPlay = () => {
      sound.play().catch((err) => {
        // NotAllowedError fires when autoplay is blocked by the browser
        console.warn("[AudioElement] Play failed:", err);
      });
      console.log("Playing Audio");
    };

    sound.addEventListener("canplaythrough", handleCanPlay);

    return () => {
      sound.removeEventListener("canplaythrough", handleCanPlay);
      sound.pause();
      sound.src = "";
    };
  }, [fileURL]);
}
