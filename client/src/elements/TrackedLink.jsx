import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useGame,
  usePlayer,
  usePlayers,
} from "@empirica/core/player/classic/react";
import { useIdleContext } from "../components/IdleProvider";
import { resolveReferenceValues as resolveReferences } from "../components/referenceResolver";
import {
  useProgressLabel,
  useGetElapsedTime,
} from "../components/progressLabel";

function ExternalLinkIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.5 2a.75.75 0 0 0 0 1.5h3.19L9.97 8.22a.75.75 0 1 0 1.06 1.06l4.72-4.72v3.19a.75.75 0 0 0 1.5 0V2.75A.75.75 0 0 0 16.5 2h-5z" />
      <path d="M5.25 4A2.25 2.25 0 0 0 3 6.25v8.5A2.25 2.25 0 0 0 5.25 17h8.5A2.25 2.25 0 0 0 16 14.75V11.5a.75.75 0 0 0-1.5 0v3.25c0 .414-.336.75-.75.75h-8.5a.75.75 0 0 1-.75-.75v-8.5c0-.414.336-.75.75-.75H9.5a.75.75 0 0 0 0-1.5H5.25z" />
    </svg>
  );
}

const serializeParamValue = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return value.toString();
};

const pickFirstDefined = (values) =>
  values?.find((val) => val !== undefined && val !== null);

/**
 * Instrumented external link element.
 * - Opens the destination in a new tab
 * - Logs click/blur/focus events with stage timestamps so we know whether participants completed the task
 * - Temporarily allows idle while the participant is away to suppress reminder modals
 * - Builds the final URL by resolving any reference-driven params (participant info, prompt answers, etc.)
 *
 * Testing: exercised end-to-end in cypress/e2e/01_Normal_Paths_Omnibus.js, which clicks the link,
 * simulates focus changes, submits the stage, and asserts that science data contains the recorded events.
 */

export function TrackedLink({ name, url, urlParams = [], displayText }) {
  const game = useGame();
  const player = usePlayer();
  const players = usePlayers();
  const progressLabel = useProgressLabel();
  const getElapsedTime = useGetElapsedTime();
  const { setAllowIdle } = useIdleContext();
  const awayTrackerRef = useRef(null);
  const lastClickRef = useRef(null);
  const recordKey = useMemo(() => `trackedLink_${name}`, [name]);

  useEffect(
    () => () => {
      setAllowIdle(false);
    },
    [setAllowIdle]
  );

  const buildEvent = useCallback(
    (type, extra = {}) => ({
      type,
      timestamp: Date.now(),
      stage: progressLabel,
      stageTimeSeconds: getElapsedTime(),
      ...extra,
    }),
    [getElapsedTime, progressLabel]
  );

  const appendEvent = useCallback(
    (event) => {
      const previousRecord = player.get(recordKey) || {
        name,
        url,
        displayText,
        events: [],
        totalTimeAwaySeconds: 0,
      };

      const updatedEvents = [...(previousRecord.events || []), event];
      const totalTimeAwaySeconds =
        (previousRecord.totalTimeAwaySeconds || 0) +
        (event.timeAwaySeconds || 0);

      player.set(recordKey, {
        ...previousRecord,
        url,
        displayText,
        events: updatedEvents,
        lastEventType: event.type,
        lastTimeAwaySeconds:
          event.timeAwaySeconds ?? previousRecord.lastTimeAwaySeconds,
        totalTimeAwaySeconds,
        lastUpdated: event.timestamp,
      });
    },
    [displayText, name, player, recordKey, url]
  );

  const logEvent = useCallback(
    (type, extra) => {
      const event = buildEvent(type, extra);
      appendEvent(event);
    },
    [appendEvent, buildEvent]
  );

  const resolvedParams = useMemo(
    () =>
      urlParams.map((param) => {
        if (!param.reference) {
          const normalizedValue =
            param.value === undefined ? "" : serializeParamValue(param.value);
          return {
            key: param.key,
            value: normalizedValue,
          };
        }

        // We can't call useReferenceValues inside a loop (hooks rules), so we fetch the
        // player/game context once above and call the pure resolver here.
        const referenceValues = resolveReferences({
          reference: param.reference,
          position: param.position,
          player,
          game,
          players,
        });
        const pickedValue = pickFirstDefined(referenceValues);
        const resolvedValue =
          pickedValue === undefined ? "" : serializeParamValue(pickedValue);

        if (resolvedValue === "" && referenceValues?.length) {
          console.warn(
            `TrackedLink ${name}: reference ${param.reference} resolved to undefined.`,
            referenceValues
          );
        }

        return {
          key: param.key,
          value: resolvedValue,
        };
      }),
    [game, name, player, players, urlParams]
  );

  const href = useMemo(() => {
    if (!resolvedParams.length) return url;
    const params = new URLSearchParams();
    resolvedParams.forEach(({ key, value }) => {
      params.append(key, value ?? "");
    });
    const queryString = params.toString();
    if (!queryString) return url;
    return url.includes("?")
      ? `${url}&${queryString}`
      : `${url}?${queryString}`;
  }, [resolvedParams, url]);

  const handleClick = useCallback(() => {
    lastClickRef.current = Date.now();
    logEvent("click");
  }, [logEvent]);

  const handleBlur = useCallback(() => {
    if (awayTrackerRef.current || !lastClickRef.current) return;
    awayTrackerRef.current = {
      startedAt: Date.now(),
      clickAt: lastClickRef.current,
    };
    lastClickRef.current = null;
    setAllowIdle(true);
    logEvent("blur");
  }, [logEvent, setAllowIdle]);

  const handleFocus = useCallback(() => {
    const awayContext = awayTrackerRef.current;
    if (awayContext) {
      awayTrackerRef.current = null;
      const timeAwaySeconds = (Date.now() - awayContext.startedAt) / 1000;
      logEvent("focus", { timeAwaySeconds });
    } else {
      logEvent("focus");
    }
    setAllowIdle(false);
  }, [logEvent, setAllowIdle]);

  useEffect(() => {
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [handleBlur, handleFocus]);

  return (
    <div className="flex flex-col space-y-1" data-test={`trackedLink-${name}`}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={handleClick}
        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
      >
        <span>{displayText}</span>
        <ExternalLinkIcon />
      </a>
      <p className="text-xs text-gray-500">
        Link opens in a new tab. Return to this tab to complete the study.
      </p>
    </div>
  );
}
