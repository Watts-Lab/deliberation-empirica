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
import {
  getFromEmpiricaState,
  saveToEmpiricaState,
  resolveAssetURL,
} from "./stagebookAdapterHelpers";
import { Discussion } from "./discussion/Discussion";
import { SharedNotepad } from "./SharedNotepad";
import { Survey } from "./Survey";

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

  const get = useCallback(
    (key, scope) =>
      getFromEmpiricaState(key, scope, { player, game, players }),
    [player, game, players]
  );

  const save = useCallback(
    (key, value, scope) =>
      saveToEmpiricaState(key, value, scope, { player, game }),
    [player, game]
  );

  const submit = useCallback(() => {
    player.stage.set("submit", true);
  }, [player]);

  const getAssetURL = useCallback(
    (path) => resolveAssetURL(path, { batchConfig, cdnList }),
    [batchConfig, cdnList]
  );

  // Fetch text content from CDN (promise-based, not a hook). Delegates
  // path resolution to getAssetURL.
  const getTextContent = useCallback(
    async (path) => {
      const url = getAssetURL(path);
      const { data } = await axios.get(url);
      return typeof data === "string" ? data : JSON.stringify(data);
    },
    [getAssetURL]
  );

  // Render slots for service-coupled components
  const renderDiscussion = useCallback(
    (config) => <Discussion discussion={config} />,
    []
  );

  const renderSharedNotepad = useCallback(
    ({ padName, defaultText, rows }) => (
      <SharedNotepad padName={padName} defaultText={defaultText} rows={rows} />
    ),
    []
  );

  // renderTalkMeter is intentionally omitted. Stagebook's schema accepts
  // `type: talkMeter`, but we do not ship a renderer on this platform;
  // stagebook handles an undefined slot gracefully (renders nothing).
  // Re-add when a talk-meter implementation is ready.

  const renderSurvey = useCallback(
    ({ surveyName, onComplete }) => (
      <Survey surveyName={surveyName} onSubmit={onComplete} />
    ),
    []
  );

  const isSubmitted = !!player?.stage?.get("submit");

  const contextValue = useMemo(
    () => ({
      get,
      save,
      getElapsedTime,
      submit,
      getAssetURL,
      getTextContent,
      progressLabel,
      playerId: player?.id,
      position: player?.get("position"),
      playerCount: players?.length,
      isSubmitted,
      setAllowIdle,
      renderDiscussion,
      renderSharedNotepad,
      renderSurvey,
    }),
    [
      get,
      save,
      getElapsedTime,
      submit,
      getAssetURL,
      getTextContent,
      progressLabel,
      player,
      players,
      isSubmitted,
      setAllowIdle,
      renderDiscussion,
      renderSharedNotepad,
      renderSurvey,
    ]
  );

  return <StagebookProvider value={contextValue}>{children}</StagebookProvider>;
}
