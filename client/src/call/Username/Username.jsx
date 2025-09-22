import React from "react";
import { useParticipantProperty } from "@daily-co/daily-react";

export function Username({ id, isLocal }) {
  const username = useParticipantProperty(id, "user_name");

  return (
    <div className="absolute bottom-2 left-2 z-10 rounded bg-slate-900/80 px-2 py-1 text-xs font-medium text-slate-100">
      {username || id} {isLocal && "(you)"}
    </div>
  );
}
