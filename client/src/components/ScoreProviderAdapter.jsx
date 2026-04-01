/**
 * ScoreProviderAdapter
 *
 * Bridges Empirica's hooks and state to the ScoreContext interface expected
 * by @deliberation-lab/score components (Stage, Element, etc.).
 *
 * Must be rendered inside both an Empirica provider tree (usePlayer, useGame, etc.)
 * and a ProgressLabelProvider (StageProgressLabelProvider or IntroExitProgressLabelProvider).
 */

import React, { useCallback, useMemo } from "react";
// eslint-disable-next-line import/no-extraneous-dependencies
import { ScoreProvider } from "@deliberation-lab/score/components";
import {
  usePlayer,
  useGame,
  usePlayers,
} from "@empirica/core/player/classic/react";
import { useGlobal } from "@empirica/core/player/react";
import axios from "axios";
import { resolveReferenceValues } from "./referenceResolver";
import {
  useProgressLabel,
  useGetElapsedTime,
} from "./progressLabel";
import { useIdleContext } from "./IdleProvider";
import { Discussion } from "../elements/Discussion";
import { SharedNotepad } from "./SharedNotepad";
import { TalkMeter } from "../elements/TalkMeter";
import { Survey } from "../elements/Survey";

export function ScoreProviderAdapter({ children }) {
  const player = usePlayer();
  const game = useGame();
  const players = usePlayers();
  const globals = useGlobal();
  const progressLabel = useProgressLabel();
  const getElapsedTime = useGetElapsedTime();
  const { setAllowIdle } = useIdleContext();

  const batchConfig = globals?.get("recruitingBatchConfig");
  const cdnList = globals?.get("cdnList");

  // Resolve a DSL reference string into an array of values
  const resolve = useCallback(
    (reference, position) =>
      resolveReferenceValues({ reference, position, player, game, players }),
    [player, game, players]
  );

  // Write state to player or game scope
  const save = useCallback(
    (key, value, scope) => {
      if (scope === "shared") {
        game.set(key, value);
      } else {
        player.set(key, value);
      }
    },
    [player, game]
  );

  // Submit the current stage
  const submit = useCallback(() => {
    player.stage.set("submit", true);
  }, [player]);

  // Resolve a file path to a full CDN URL
  const getAssetURL = useCallback(
    (path) => {
      const cdn = batchConfig?.cdn;
      const cdnURL = cdnList?.[cdn] || cdn || cdnList?.prod;
      if (!cdnURL) return path;
      return encodeURI(`${cdnURL}/${path}`);
    },
    [batchConfig, cdnList]
  );

  // Fetch text content from CDN (promise-based, not a hook)
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
    ({ padName }) => <SharedNotepad padName={padName} />,
    []
  );

  const renderTalkMeter = useCallback(() => <TalkMeter />, []);

  const renderSurvey = useCallback(
    ({ surveyName, onComplete }) => (
      <Survey surveyName={surveyName} onSubmit={onComplete} />
    ),
    []
  );

  const isSubmitted = !!player?.stage?.get("submit");

  const contextValue = useMemo(
    () => ({
      resolve,
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
      renderTalkMeter,
      renderSurvey,
    }),
    [
      resolve,
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
      renderTalkMeter,
      renderSurvey,
    ]
  );

  return <ScoreProvider value={contextValue}>{children}</ScoreProvider>;
}
