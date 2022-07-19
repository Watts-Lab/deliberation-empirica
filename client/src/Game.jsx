import React from "react";
import { Profile } from "./Profile";
import { Stage } from "./Stage";

const gameStyle = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'flex-start'
}

export function Game() {
  return (
    <div style={gameStyle}>
      <Profile />
      <div className="h-full flex items-center justify-center">
        <Stage />
      </div>
    </div>
  );
}
