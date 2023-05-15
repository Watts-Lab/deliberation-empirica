import { useState } from "react";
import { useFileURL } from "../components/utils";

export function AudioElement({ file }) {
  const fileURL = useFileURL({ file });
  const [hasPlayed, setHasPlayed] = useState(false);

  if (!hasPlayed && fileURL) {
    const sound = new Audio(fileURL);
    // sound.play();
    // todo: catch "NotAllowedError: play() failed because the user didn't interact with the document first. https://goo.gl/xX8pDD"
    sound.addEventListener("canplaythrough", () => {
      sound.play();
      console.log(`Playing Audio`);
    });
    setHasPlayed(true);
  }
}
