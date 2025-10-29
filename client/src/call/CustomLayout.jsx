import React from "react";

import { Tile } from "./Tile";
import { MicrophoneOn, MissingParticipant } from "./Icons";

export function CustomLayout({ plan, showNickname, showTitle }) {
  if (!plan) return null;

  const { grid, items } = plan;
  const backgroundStyle =
    grid.options?.background != null
      ? { background: grid.options.background }
      : undefined;

  return (
    <div
      className="relative h-full w-full bg-slate-950/30 p-4 pb-1"
      style={backgroundStyle}
    >
      <div
        className="grid h-full w-full gap-3"
        style={{
          gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
          gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => (
          <div
            key={item.key}
            className="relative flex h-full w-full"
            style={{
              gridRow: `${item.gridArea.rowStart} / ${item.gridArea.rowEnd}`,
              gridColumn: `${item.gridArea.colStart} / ${item.gridArea.colEnd}`,
              zIndex: 10 + (item.zIndex ?? 0),
            }}
          >
            {renderCustomLayoutItem({
              item,
              showNickname,
              showTitle,
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderCustomLayoutItem({ item, showNickname, showTitle }) {
  switch (item.renderType) {
    case "tile":
      if (!item.sessionId) {
        return <WaitingTile label={item.label} />;
      }
      return (
        <Tile
          id={item.sessionId}
          isLocal={item.isLocal}
          isScreenShare={item.isScreenShare}
          showNickname={showNickname}
          showTitle={showTitle}
        />
      );
    case "audio":
      if (!item.sessionId) {
        return (
          <WaitingTile
            label={item.label}
            message="Audio feed unavailable yet"
          />
        );
      }
      return <AudioOnlyTile label={item.label} />;
    case "waiting":
    default:
      return <WaitingTile label={item.label} />;
  }
}

function AudioOnlyTile({ label }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-500 bg-slate-900/50 p-4 text-center text-slate-100">
      <div className="text-emerald-300">
        <MicrophoneOn />
      </div>
      <p className="mt-2 text-sm font-semibold">{label ?? "Audio feed"}</p>
      <p className="text-xs text-slate-300">Video unavailable</p>
    </div>
  );
}

function WaitingTile({ label, message }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-500 bg-slate-900/40 p-4 text-center text-slate-200">
      <div className="text-slate-200">
        <MissingParticipant />
      </div>
      <p className="mt-3 text-sm font-medium">
        {label ? `Waiting for ${label}` : "Waiting for participant"}
      </p>
      {message ? (
        <p className="mt-1 text-xs text-slate-400">{message}</p>
      ) : null}
    </div>
  );
}
