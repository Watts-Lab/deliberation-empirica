import React, { useState } from "react";

export function AudioElement({ file }) {
  const [hasPlayed, setHasPlayed] = useState(false);

  if (!hasPlayed) {
    const sound = new Audio(file);
    sound.play();
    setHasPlayed(true);
    console.log(`Playing Audio: ${file}`);
  }
}
