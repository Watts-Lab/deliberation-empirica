import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import {
  useGame,
  usePlayer,
  usePlayers,
  useRound,
  useStage,
} from "@empirica/core/player/classic/react";
import { diagnoseStageCoherent } from "./compute";

/**
 * Hook that runs the stage-coherence gate. Reads the five Empirica scope
 * hooks once and returns both the boolean and the full diagnosis so callers
 * can gate rendering AND drive stuck-state reporting without a second
 * round-trip through the hooks.
 */
export function useStageCoherent() {
  const player = usePlayer();
  const players = usePlayers();
  const game = useGame();
  const stage = useStage();
  const round = useRound();
  const diagnosis = diagnoseStageCoherent({
    player,
    players,
    game,
    stage,
    round,
  });

  // Per-mount memory of the most recent non-coherent reason, so we log on
  // transitions (e.g. `noPlayerStage` → `selfStageIdMismatch`) rather than on
  // every render while the gate is held. Stored in a ref — not module scope
  // — so multi-player test harnesses (Cypress) with several <Game> mounts in
  // the same tab don't share log state and silence each other.
  const lastLoggedReasonRef = useRef(null);

  // Console telemetry on each non-coherent reason change. Cheap, local-only
  // visibility into which race shape the gate is catching — if production
  // logs start showing one reason dominating, we know where the real risk
  // lives. No Sentry traffic: reload-on-stuck already escalates genuine
  // stalls; this is just a breadcrumb trail in devtools.
  if (!diagnosis.coherent && diagnosis.reason !== lastLoggedReasonRef.current) {
    lastLoggedReasonRef.current = diagnosis.reason;
    // eslint-disable-next-line no-console
    console.debug("[stageCoherence] gate held", diagnosis);
  } else if (diagnosis.coherent && lastLoggedReasonRef.current !== null) {
    lastLoggedReasonRef.current = null;
  }

  return { coherent: diagnosis.coherent, diagnosis };
}

const DEFAULT_STALE_TIMEOUT_MS = 5000;
const DEFAULT_RELOAD_SESSION_KEY = "gameStaleStateReload";

function safeSessionGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // storage unavailable (privacy mode) — fall through
  }
}
function safeSessionRemove(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // storage unavailable — fall through
  }
}

/**
 * Stuck-coherence recovery. When the gate has been non-coherent for
 * `timeoutMs` while the player is assigned, report to Sentry with the
 * diagnosis's reason code and reload once. Second stall stays on loading
 * rather than reload-looping — the Sentry report surfaces it.
 *
 * Consumers pass in the diagnosis from `useStageCoherent()` plus whatever
 * additional context they want on the Sentry payload. Kept as a separate
 * hook so tests / storybooks that just want the gate boolean don't get
 * dragged into Sentry + sessionStorage + reload territory.
 */
export function useStuckCoherenceRecovery({
  assigned,
  diagnosis,
  extraPayload,
  timeoutMs = DEFAULT_STALE_TIMEOUT_MS,
  sessionKey = DEFAULT_RELOAD_SESSION_KEY,
} = {}) {
  const timerRef = useRef(null);
  const diagnosisRef = useRef(diagnosis);
  const extraRef = useRef(extraPayload);
  diagnosisRef.current = diagnosis;
  extraRef.current = extraPayload;

  useEffect(() => {
    if (!assigned) return undefined;

    if (diagnosis?.coherent) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      safeSessionRemove(sessionKey);
      return undefined;
    }

    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        const d = diagnosisRef.current;
        const extra = extraRef.current;
        const alreadyReloaded = safeSessionGet(sessionKey);

        Sentry.captureMessage(
          `Game state stale: coherence gate stuck (${d?.reason ?? "unknown"})`,
          {
            level: "error",
            extra: {
              reason: d?.reason,
              stageId: d?.stageId,
              selfStageID: d?.selfStageID,
              peerId: d?.peerId,
              peerStageID: d?.peerStageID,
              alreadyReloaded: !!alreadyReloaded,
              ...(extra ?? {}),
            },
          },
        );

        if (!alreadyReloaded) {
          safeSessionSet(sessionKey, Date.now().toString());
          window.location.reload();
        }
      }, timeoutMs);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [assigned, diagnosis?.coherent, timeoutMs, sessionKey]);
}
