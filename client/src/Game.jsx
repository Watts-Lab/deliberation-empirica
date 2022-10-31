import React, { useEffect } from "react";
import { Profile } from "./Profile";
import { Stage } from "./Stage";

export function Game() {
  useEffect(() => {
    console.log(`Render Game`);
  }, []);
  return (
    <div>
      <Profile />
      <Stage />
    </div>
  );
}
