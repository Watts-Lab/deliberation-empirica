import { useState } from "react";
import { getFileURL } from "../components/utils";

export function AudioElement({ file }) {
  const fileURL = getFileURL(file);
  const [hasPlayed, setHasPlayed] = useState(false);

  if (!hasPlayed) {
    const sound = new Audio(fileURL);
    sound.play();
    setHasPlayed(true);
    console.log(`Playing Audio: ${file}`);
  }
}
