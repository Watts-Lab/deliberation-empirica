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
import { Discussion } from "../elements/Discussion";
import { SharedNotepad } from "./SharedNotepad";
import { TalkMeter } from "../elements/TalkMeter";
import { Survey } from "../elements/Survey";

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

  // Look up raw stored values by storage key.
  // scope values (from stagebook docs):
  //   undefined or "player" → current participant's state (one value)
  //   "shared"              → shared/game state (one value)
  //   "all"                 → array with one value per participant
  //   "0", "1", ...         → specific participant(s) by position index
  // Stagebook normalizes "any" and "percentAgreement" to "all" before calling get.
  const get = useCallback(
    (key, scope) => {
      if (scope === "shared") {
        return [game?.get ? game.get(key) : undefined];
      }
      if (scope === "all") {
        return (players || []).map((p) => (p?.get ? p.get(key) : undefined));
      }
      if (scope !== undefined && scope !== "player") {
        const parsedPosition = Number.parseInt(scope);
        if (!Number.isNaN(parsedPosition)) {
          return (players || [])
            .filter(
              (p) => Number.parseInt(p?.get && p.get("position")) === parsedPosition
            )
            .map((p) => p.get(key));
        }
      }
      return [player?.get ? player.get(key) : undefined];
    },
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

  // Resolve a file path to a full CDN URL. Per stagebook's contract,
  // paths in treatment files are relative to the treatment file's location,
  // so we join them with the treatment file's directory before prepending
  // the CDN base URL.
  const getAssetURL = useCallback(
    (path) => {
      const cdn = batchConfig?.cdn;
      const cdnURL = cdnList?.[cdn] || cdn || cdnList?.prod;
      if (!cdnURL) return path;
      const treatmentFile = batchConfig?.treatmentFile || "";
      // Directory of the treatment file, relative to the CDN root.
      const lastSlash = treatmentFile.lastIndexOf("/");
      const treatmentDir =
        lastSlash >= 0 ? treatmentFile.slice(0, lastSlash) : "";
      // Normalize the reference: join with treatmentDir and collapse `.`/`..`
      // segments. Paths that already start with a slash or have no `..`/`.`
      // components are common — we handle them with a simple segment walk.
      const combined = treatmentDir ? `${treatmentDir}/${path}` : path;
      const segments = combined.split("/").reduce((acc, seg) => {
        if (seg === "" || seg === ".") return acc;
        if (seg === "..") {
          acc.pop();
          return acc;
        }
        acc.push(seg);
        return acc;
      }, []);
      return encodeURI(`${cdnURL}/${segments.join("/")}`);
    },
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
      renderTalkMeter,
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
      renderTalkMeter,
      renderSurvey,
    ]
  );

  return <StagebookProvider value={contextValue}>{children}</StagebookProvider>;
}
