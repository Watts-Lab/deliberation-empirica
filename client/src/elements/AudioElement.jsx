import { useState } from "react";
import { getFileURL } from "../components/utils";

export function AudioElement({ file }) {
  const fileURL = getFileURL(file);
  const [hasPlayed, setHasPlayed] = useState(false);

  if (!hasPlayed) {
    const sound = new Audio(fileURL);
    sound.play(); // todo: catch "NotAllowedError: play() failed because the user didn't interact with the document first. https://goo.gl/xX8pDD"
    setHasPlayed(true);
    console.log(`Playing Audio: ${file}`);
  }
}
