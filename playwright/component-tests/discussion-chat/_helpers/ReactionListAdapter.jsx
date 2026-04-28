import React from "react";
import { ReactionList } from "../../../../client/src/components/discussion/chat/ReactionList";

// Adapter component that builds Empirica-shaped player objects
// (`.get("position")` / `.get("name")`) inside the iframe. We can't
// pass methods directly as props to ReactionList — Playwright CT
// serializes object props via structured clone, which strips function
// properties — so tests send plain `{ position, name }` records and
// this adapter reconstructs the `.get()` shape where the real
// component will see them intact.
//
// Lives in its own file because Playwright CT can only mount
// components that are statically importable — inline-defined
// components in test files fail with "cannot be mounted".
export function ReactionListAdapter({ rawPlayers, ...rest }) {
  const players = (rawPlayers || []).map((p) => ({
    get: (key) => {
      if (key === "position") return p.position;
      if (key === "name") return p.name;
      return undefined;
    },
  }));
  return <ReactionList players={players} {...rest} />;
}
