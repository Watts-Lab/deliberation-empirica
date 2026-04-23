import React, { createContext, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { MockPlayer } from './MockPlayer.js';
import { MockStage } from './MockStage.js';
import { MockGame } from './MockGame.js';

/**
 * SplitEmitEmpiricaProvider — mock provider that reproduces Empirica's
 * cross-hook coherence races.
 *
 * The default MockEmpiricaProvider updates every hook atomically in a single
 * render, so any gate that depends on existence/identity checks will appear
 * to work even if its logic is wrong. This provider lets tests drive stage
 * transitions with explicit control over WHICH hook's state is updated in
 * WHICH React commit, reproducing all three race shapes:
 *
 *   Race 1 — mutable ctx vs React state.
 *     ctxStage is advanced synchronously (before any hook emit), so
 *     `player.stage` (which reads through ctx) resolves to the new stage
 *     while `useStage()` (which reads emittedStage via useState) still
 *     returns the old one. Same commit, mismatched ids.
 *
 *   Race 2 — fan-out across the top-level observables.
 *     emittedStage and emittedPlayer (and friends) can be updated in
 *     separate ticks / separate React commits, so any render in between
 *     sees a partial snapshot (new stage, old player, or vice versa).
 *
 *   Race 3 — scope hydration lag.
 *     playerStageMap can be empty for the new stage id when ctxStage
 *     advances, so `player.stage` returns null even though ctxStage is
 *     already B. Simulated by omitting the new stage id from
 *     playerStageMap at advance time and filling it later.
 *
 * Test shape:
 *   const ref = React.createRef();
 *   render(<SplitEmitEmpiricaProvider ref={ref} initial={...}>...</SplitEmitEmpiricaProvider>);
 *   ref.current.advance({ toStageId: 'B', race: 'race-1' });
 *
 * The provider's `advance(opts)` helper drives a transition with the specific
 * race shape requested. See the jsdoc on `advance` for the knobs.
 *
 * Contract with the hooks file:
 *   The shared hooks.js prefers SplitEmitContext when present and falls back
 *   to MockEmpiricaContext otherwise. So existing tests continue to use the
 *   atomic mock; split-emit tests opt in by mounting this provider.
 */

export const SplitEmitContext = createContext(null);

/**
 * Build a MockPlayer whose `.stage` getter resolves dynamically against the
 * provider's current ctxStage + playerStageMap. This mirrors real Empirica's
 * player.stage getter, which reads `ctx.stage` synchronously and then does a
 * scope lookup — so the getter's return value changes as soon as we mutate
 * ctxStage, even before the observable has emitted.
 */
function buildSplitPlayer(id, getProviderState, onChange) {
  const player = new MockPlayer(id, {}, onChange);
  // Remove the statically-assigned `.stage` and replace with a getter.
  // (MockPlayer's constructor assigns `this.stage = new MockStage(...)`;
  // we overwrite with a getter that looks up the current PlayerStage.)
  Object.defineProperty(player, 'stage', {
    configurable: true,
    get() {
      const { ctxStage, playerStageMap } = getProviderState();
      if (!ctxStage) return null;
      return playerStageMap.get(`${id}:${ctxStage.id}`) ?? null;
    },
  });
  // Alias .game and .round to similar lookups. For now we keep them simple:
  // always return the current game/round if present. Extend as needed.
  Object.defineProperty(player, 'game', {
    configurable: true,
    get() {
      return getProviderState().ctxGame ?? null;
    },
  });
  Object.defineProperty(player, 'round', {
    configurable: true,
    get() {
      return getProviderState().ctxRound ?? null;
    },
  });
  return player;
}

/**
 * Normalize a config into a MockStage instance. Accepts either a MockStage
 * or a plain `{ id, attrs }` object.
 */
function toMockStage(config) {
  if (!config) return null;
  if (config instanceof MockStage) return config;
  const stage = new MockStage({ id: config.id, ...(config.attrs ?? {}) });
  // Ensure id is on the instance (MockStage copies initialAttributes.id onto
  // `this.id`, so this is belt-and-suspenders).
  stage.id = config.id;
  // Write the stageID attribute so `.get("stageID")` returns the stage's own
  // id — matches how real Empirica seeds PlayerStage.stageID. Tests that want
  // to simulate the "stageID attribute not yet hydrated" sub-case of Race 3
  // can pass `attrs: { stageID: null }` to override.
  if (stage._attributes.stageID === undefined) {
    stage._attributes.stageID = config.id;
  }
  return stage;
}

function toMockPlayerStage(stageId, attrs = {}) {
  const playerStage = new MockStage({ id: `ps-${stageId}`, ...attrs });
  playerStage.id = `ps-${stageId}`;
  if (playerStage._attributes.stageID === undefined) {
    playerStage._attributes.stageID = stageId;
  }
  return playerStage;
}

/**
 * Provider component. Holds:
 *   - emitted* (React state):  what the hooks return
 *   - ctx* (refs):              the mutable truth (player.stage reads through)
 *   - playerStageMap (Map):     keyed by `${playerId}:${stageId}` -> MockStage
 *
 * Exposes `advance({...})` via forwardRef.
 */
export const SplitEmitEmpiricaProvider = React.forwardRef(function SplitEmitEmpiricaProvider(
  {
    currentPlayerId,
    initialStage,          // { id, attrs } or MockStage
    initialGame,           // { attrs } or MockGame
    initialPlayerIds = [], // [id, id, ...]
    initialPlayerStages,   // optional Map-like: { [playerId]: { [stageId]: attrs } }
    children,
  },
  ref
) {
  // ===== ctx (mutable truth, read through player.* getters) =====
  // We seed a minimal Round by default so the coherence gate's existence
  // check passes. Tests that want to simulate Race-2-style round staleness
  // can clear it via the advance() helper; otherwise it stays constant.
  const defaultRound = { id: "r-default", get: () => null };
  const ctxRef = useRef({
    ctxStage: toMockStage(initialStage),
    ctxGame: initialGame ? (initialGame instanceof MockGame ? initialGame : new MockGame(initialGame.attrs ?? {})) : null,
    ctxRound: defaultRound,
    playerStageMap: new Map(),
  });

  // ===== React state (what hooks emit) =====
  const [emittedStage, setEmittedStage] = useState(() => ctxRef.current.ctxStage);
  const [emittedGame, setEmittedGame] = useState(() => ctxRef.current.ctxGame);
  const [emittedRound, setEmittedRound] = useState(() => ctxRef.current.ctxRound);
  // Version counter — incremented on bump() to force context consumers to
  // re-render even when none of the emitted* values have changed. This is
  // how Race 1 surfaces: ctx mutates, emitted state doesn't, but we still
  // want the probe to render against the torn snapshot.
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((n) => n + 1);

  // ===== Players =====
  // Players are built once on mount, stable instances. Each has getters for
  // stage/game/round that read through ctxRef.
  const players = useMemo(() => {
    const getState = () => ctxRef.current;
    return initialPlayerIds.map((id) => buildSplitPlayer(id, getState, bump));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only

  const [emittedPlayers, setEmittedPlayers] = useState(players);

  // ===== Seed initial PlayerStages =====
  useLayoutEffect(() => {
    if (!initialPlayerStages || !ctxRef.current.ctxStage) return;
    const stageId = ctxRef.current.ctxStage.id;
    for (const playerId of initialPlayerIds) {
      const stageAttrs = initialPlayerStages?.[playerId]?.[stageId] ?? {};
      const playerStage = toMockPlayerStage(stageId, stageAttrs);
      ctxRef.current.playerStageMap.set(`${playerId}:${stageId}`, playerStage);
    }
    bump();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== advance() — the race simulator =====
  // Exposed via ref. See jsdoc on the imperative handle below.
  React.useImperativeHandle(ref, () => ({
    /**
     * Drive a stage transition with a specific race shape.
     *
     * @param {Object} opts
     * @param {string} opts.toStageId        — id of the new stage
     * @param {Object} [opts.toStageAttrs]   — attrs for the new stage (discussion, name, etc)
     * @param {Object} [opts.perPlayerStageAttrs] — { [playerId]: attrs } for new PlayerStages
     * @param {'race-1'|'race-2'|'race-3'|'clean'} [opts.race='clean']
     *     race-1 — mutate ctx synchronously, delay emitStage (useStage lags)
     *     race-2 — emit scopes in separate ticks (stage first, player later)
     *     race-3 — mutate ctx synchronously, DO NOT populate playerStageMap
     *              for the new stage, then later hydrate + emit
     *     clean  — single atomic update (baseline / no race)
     * @param {number} [opts.gapMs=20] — how long the race window lasts
     *     before the lagging emit fires
     */
    async advance(opts) {
      const {
        toStageId,
        toStageAttrs = {},
        perPlayerStageAttrs = {},
        race = 'clean',
        gapMs = 20,
      } = opts;

      const newStage = toMockStage({ id: toStageId, attrs: toStageAttrs });

      // Race 1: mutate ctx first, emit stage later.
      // Race 2: mutate ctx + emit stage first, emit players later (different tick).
      // Race 3: mutate ctx WITHOUT hydrating playerStageMap for new stage, then
      //         hydrate + emit later.
      // Clean: everything in one synchronous block.

      const hydratePlayerStagesForNewStage = () => {
        for (const player of players) {
          const attrs = perPlayerStageAttrs[player.id] ?? {};
          const playerStage = toMockPlayerStage(toStageId, attrs);
          ctxRef.current.playerStageMap.set(`${player.id}:${toStageId}`, playerStage);
        }
      };

      const commitStageEmit = () => setEmittedStage(newStage);
      const commitPlayerEmit = () => setEmittedPlayers([...players]);

      if (race === 'clean') {
        ctxRef.current.ctxStage = newStage;
        hydratePlayerStagesForNewStage();
        commitStageEmit();
        commitPlayerEmit();
        return;
      }

      if (race === 'race-1') {
        // mutable ctx advances + PlayerStages hydrate synchronously, but
        // useStage() doesn't emit until after a gap. So during the gap:
        //   useStage().id === oldStageId
        //   player.stage.get("stageID") === newStageId (new PlayerStage wired up)
        ctxRef.current.ctxStage = newStage;
        hydratePlayerStagesForNewStage();
        bump(); // force a render so observers can see the torn state
        await new Promise((r) => setTimeout(r, gapMs));
        commitStageEmit();
        commitPlayerEmit();
        return;
      }

      if (race === 'race-2') {
        // fan-out: one top-level scope emits new, another briefly drops out.
        // Simulate: ctx advances, stage emits new, round briefly goes null
        // (as if round's observable hadn't emitted the new round yet), then
        // round is restored.
        ctxRef.current.ctxStage = newStage;
        hydratePlayerStagesForNewStage();
        const savedRound = ctxRef.current.ctxRound;
        ctxRef.current.ctxRound = null;
        setEmittedRound(null);
        commitStageEmit();
        await new Promise((r) => setTimeout(r, gapMs));
        ctxRef.current.ctxRound = savedRound;
        setEmittedRound(savedRound);
        commitPlayerEmit();
        return;
      }

      if (race === 'race-3') {
        // scope hydration lag: ctx advances, stage emits, but PlayerStages
        // for the new stage aren't in the map yet. player.stage returns null.
        ctxRef.current.ctxStage = newStage;
        commitStageEmit();
        bump();
        await new Promise((r) => setTimeout(r, gapMs));
        hydratePlayerStagesForNewStage();
        commitPlayerEmit();
        return;
      }

      throw new Error(`Unknown race shape: ${race}`);
    },

    getState() {
      return {
        ...ctxRef.current,
        emittedStage,
        emittedGame,
        emittedRound,
        emittedPlayers,
      };
    },
  }), [players, emittedStage, emittedGame, emittedRound, emittedPlayers]);

  // ===== Build the context value =====
  // Include `version` in the memo deps so bump() -> setVersion -> new
  // contextValue reference -> React Context notifies consumers. Without
  // version, a bump() that doesn't touch emitted* would not propagate to
  // consumers and Race 1 would be unobservable.
  const contextValue = useMemo(() => {
    const me = players.find((p) => p.id === currentPlayerId) ?? players[0] ?? null;
    return {
      currentPlayerId,
      player: me,
      players: emittedPlayers,
      game: emittedGame,
      stage: emittedStage,
      round: emittedRound,
      __version: version,
      __ctxRef: ctxRef,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayerId, players, emittedPlayers, emittedGame, emittedStage, emittedRound, version]);

  // Expose on window for cross-iframe introspection (Playwright evaluate())
  if (typeof window !== 'undefined') {
    window.splitEmitContext = contextValue;
  }

  return (
    <SplitEmitContext.Provider value={contextValue}>
      {children}
    </SplitEmitContext.Provider>
  );
});
