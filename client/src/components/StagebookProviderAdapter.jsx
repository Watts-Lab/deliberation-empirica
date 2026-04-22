/**
 * StagebookProviderAdapter
 *
 * Bridges Empirica's hooks and state to the StagebookContext interface expected
 * by stagebook components (Stage, Element, etc.).
 *
 * Must be rendered inside both an Empirica provider tree (usePlayer, useGame, etc.)
 * and a ProgressLabelProvider (StageProgressLabelProvider or IntroExitProgressLabelProvider).
 *
 * StagebookContext uses `get(key, scope)` for state reads — a flat key/value
 * lookup. Stagebook internally handles DSL reference parsing and nested-path
 * extraction, so this adapter only needs to return raw stored values by key.
 *
 * The pure translation logic lives in ./stagebookAdapterHelpers so it can be
 * unit-tested without jsdom. This component is just the React glue.
 */

import React, { useCallback, useMemo } from "react";
import { StagebookProvider } from "stagebook/components";
import {
  usePlayer,
  useGame,
  usePlayers,
} from "@empirica/core/player/classic/react";
import { useGlobal } from "@empirica/core/player/react";
import axios from "axios";
import {
  useProgressLabel,
  useGetElapsedTime,
} from "./progressLabel";
import { useIdleContext } from "./IdleProvider";
import { buildStagebookContextValue } from "./stagebookAdapterHelpers";
import { Discussion } from "./discussion/Discussion";
import { SharedNotepad } from "./SharedNotepad";
import { Survey } from "./Survey";

// Render slots for service-coupled components — defined as module-level
// constants so buildStagebookContextValue receives stable references.
const renderDiscussion = (config) => <Discussion discussion={config} />;
const renderSharedNotepad = ({ padName, defaultText, rows }) => (
  <SharedNotepad padName={padName} defaultText={defaultText} rows={rows} />
);
const renderSurvey = ({ surveyName, onComplete }) => (
  <Survey surveyName={surveyName} onSubmit={onComplete} />
);

// renderTalkMeter is intentionally omitted. Stagebook's schema accepts
// `type: talkMeter`, but we do not ship a renderer on this platform;
// stagebook handles an undefined slot gracefully (renders nothing).

export function StagebookProviderAdapter({ children }) {
  const player = usePlayer();
  const game = useGame();
  const players = usePlayers();
  const globals = useGlobal();
  const progressLabel = useProgressLabel();
  const getElapsedTime = useGetElapsedTime();
  const { setAllowIdle } = useIdleContext();

  const batchConfig = globals?.get("recruitingBatchConfig");
  const cdnList = globals?.get("cdnList");

  const axiosGet = useCallback((url) => axios.get(url), []);

  const contextValue = useMemo(
    () =>
      buildStagebookContextValue({
        player,
        game,
        players,
        progressLabel,
        getElapsedTime,
        setAllowIdle,
        batchConfig,
        cdnList,
        axiosGet,
        renderDiscussion,
        renderSharedNotepad,
        renderSurvey,
      }),
    [
      player,
      game,
      players,
      progressLabel,
      getElapsedTime,
      setAllowIdle,
      batchConfig,
      cdnList,
      axiosGet,
    ]
  );

  return <StagebookProvider value={contextValue}>{children}</StagebookProvider>;
}
