import React, { useRef } from "react";
import {
  DailyAudio,
  useDaily,
  useDevices,
  useLocalSessionId,
} from "@daily-co/daily-react";
import {
  useGame,
  usePlayer,
  useStage,
  useStageTimer,
} from "@empirica/core/player/classic/react";

import { Tray } from "./Tray";
import { Call } from "./Call";
import { useDailyEventLogger, useStageEventLogger } from "./hooks/eventLogger";
import { useAutoDiagnostics } from "./hooks/useAutoDiagnostics";
import { useAudioContextMonitor } from "./hooks/useAudioContextMonitor";
import { useDisplayNameSync } from "./hooks/useDisplayNameSync";
import { useDailyIdTracking } from "./hooks/useDailyIdTracking";
import { useCallStartSignaling } from "./hooks/useCallStartSignaling";
import { useVisibilityTracking } from "./hooks/useVisibilityTracking";
import { useTrackMonitor } from "./hooks/useTrackMonitor";
import { usePermissionMonitor } from "./hooks/usePermissionMonitor";
import { useCallLifecycle } from "./hooks/useCallLifecycle";
import { useDeviceErrors } from "./hooks/useDeviceErrors";
import { useGesturePrompt } from "./hooks/useGesturePrompt";
import { useDeviceRecovery } from "./hooks/useDeviceRecovery";
import { useDeviceAlignment } from "./hooks/useDeviceAlignment";
import { useDeviceBanners } from "./hooks/useDeviceBanners";
import { UserMediaError } from "./UserMediaError";
import { CallBanner, DeviceFallbackBanners, BannerStack } from "./CallBanner";
import {
  useProgressLabel,
  useGetElapsedTime,
} from "../../progressLabel";
import { Modal } from "../../Modal";

const fatalErrorMessages = {
  "connection-error": {
    title: "Connection lost",
    subtitle: "Your connection to the call was interrupted.",
    showRejoin: true,
  },
  ejected: {
    title: "Removed from call",
    subtitle: "You were removed by the moderator.",
    showRejoin: false,
  },
  "exp-room": {
    title: "Session expired",
    subtitle: "This call session has expired.",
    showRejoin: false,
  },
  "exp-token": {
    title: "Session expired",
    subtitle: "Your meeting token has expired.",
    showRejoin: false,
  },
  "meeting-full": {
    title: "Call is full",
    subtitle: "The call has reached its participant limit.",
    showRejoin: false,
  },
  "not-allowed": {
    title: "Not authorized",
    subtitle: "You are not authorized to join this call.",
    showRejoin: false,
  },
};

function FatalErrorOverlay({ error, onRejoin }) {
  const msg = fatalErrorMessages[error.type] || {
    title: "Call error",
    subtitle: error.message || "An unexpected error occurred.",
    showRejoin: true,
  };

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">{msg.title}</h2>
        <p className="mt-2 text-slate-600">{msg.subtitle}</p>
        {msg.showRejoin && (
          <button
            type="button"
            data-testid="rejoinCall"
            onClick={onRejoin}
            className="mt-4 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
          >
            Rejoin Call
          </button>
        )}
      </div>
    </div>
  );
}

export function VideoCall({
  showNickname,
  showTitle,
  showSelfView = true,
  showReportMissing = true,
  showAudioMute = true,
  showVideoMute = true,
  layout,
  rooms,
}) {
  // ------------------- load Empirica + Daily context ---------------------
  const game = useGame();
  const player = usePlayer();
  const callObject = useDaily();
  const stage = useStage();
  const stageTimer = useStageTimer();

  useDailyEventLogger();

  // Pause all <audio> elements on unmount to prevent the browser's audio
  // pipeline from looping the last buffered chunk after the call ends.
  // callObject.leave() is fire-and-forget in useCallLifecycle's cleanup, so
  // Daily may not have torn down tracks before React removes DailyAudio from
  // the DOM. Explicitly pausing first breaks the loop.
  React.useEffect(
    () => () => {
      // Only target audio elements backed by a MediaStream (Daily tracks).
      // Checking srcObject avoids accidentally pausing unrelated page audio.
      document.querySelectorAll("audio").forEach((el) => {
        if (el.srcObject) {
          el.pause();
          // eslint-disable-next-line no-param-reassign
          el.srcObject = null;
        }
      });
    },
    []
  );

  // ------------------- monitor AudioContext state for autoplay debugging ---------------------
  // Browsers (especially Safari) may suspend AudioContext due to autoplay policies.
  // This hook monitors AudioContext state and provides controls to resume it.
  const {
    audioContextState,
    needsUserInteraction,
    blurredWhileSuspended,
    resumeAudioContext,
    audioContext,
  } = useAudioContextMonitor();

  // ------------------- auto-respond to diagnostic requests from roommates ---------------------
  // When another participant reports an A/V issue, they may request diagnostics from us.
  // This hook listens for those requests and automatically sends our diagnostic data to Sentry.
  useAutoDiagnostics(audioContext);

  // ------------------- mirror Nickname into the Daily room ---------------------
  useDisplayNameSync(callObject, player, showNickname, showTitle);

  // ------------------- remember player Daily IDs for layout + UI ---------------------
  const dailyId = useLocalSessionId();
  const progressLabel = useProgressLabel();
  const getElapsedTime = useGetElapsedTime();
  const stageElapsed = (stageTimer?.elapsed || 0) / 1000;

  useDailyIdTracking(
    callObject,
    dailyId,
    player,
    progressLabel,
    getElapsedTime
  );

  // ------------------- manage room joins/leaves ---------------------
  const roomUrl = game.get("dailyUrl");
  const { joinStalled, clearJoinStalled } = useCallLifecycle(
    callObject,
    roomUrl,
    player
  );

  // ------------------- start recording when participant joins ---------------------
  const recordingEnabled = game.get("recordingEnabled") === true;
  useCallStartSignaling(callObject, recordingEnabled, stage?.id);

  // ------------------- device fallback banners ---------------------
  const {
    deviceBanners,
    addDeviceBanner,
    clearDeviceBanner,
    clearBannersForDevice,
  } = useDeviceBanners();

  const logEvent = useStageEventLogger();

  // ------------------- device errors + Daily event listeners ---------------------
  const {
    cameraError,
    setCameraError,
    micError,
    setMicError,
    speakerError,
    setSpeakerError,
    deviceError,
    fatalError,
    setFatalError,
    networkInterrupted,
  } = useDeviceErrors(callObject, { addDeviceBanner });

  // ------------------- gesture-gated operations ---------------------
  const devices = useDevices();
  const {
    setPendingGestureOperations,
    setPendingOperationDetails,
    handleAudioPlayFailed,
    handleEnableAudio,
    handleSetupFailure,
    handleCompleteSetup,
    showGesturePrompt,
    hasSetupOperations,
    gesturePromptMessage,
    gesturePromptButtonLabel,
  } = useGesturePrompt({
    devices,
    resumeAudioContext,
    needsUserInteraction,
    blurredWhileSuspended,
    joinStalled,
    clearJoinStalled,
    audioContextState,
  });

  // ------------------- W4: device reconnected — clear banners ---------------------
  useDeviceRecovery(player, deviceBanners, clearBannersForDevice);

  // ------------------- W7: proactive track monitoring ---------------------
  useTrackMonitor(callObject);

  // ------------------- monitor browser permissions during call ---------------------
  usePermissionMonitor(setCameraError, setMicError);

  // ------------------- track page visibility/focus for debugging ---------------------
  useVisibilityTracking(player, getElapsedTime, progressLabel);

  // ------------------- align Daily devices with Empirica preferences ---------------------
  const { handleSwitchDevice } = useDeviceAlignment(
    callObject,
    devices,
    player,
    { setCameraError, setMicError, setSpeakerError },
    {
      handleSetupFailure,
      setPendingGestureOperations,
      setPendingOperationDetails,
    },
    { cameraError, micError, speakerError },
    { addDeviceBanner, clearBannersForDevice, logEvent }
  );

  // ------------------- Fix A/V ref for banner → modal link ---------------------
  const fixAVRef = useRef(null);

  // ------------------- render call surface + tray ---------------------
  // On narrow layouts (< md) the discussion column stacks vertically, so ensure
  // we keep some vertical space reserved for the call; larger breakpoints can
  // continue to stretch based on the surrounding flex layout.

  return (
    <div className="flex h-full w-full flex-col min-h-[320px] md:min-h-0">
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/30 shadow-lg">
        <div className="flex-1 overflow-hidden relative">
          <BannerStack>
            <CallBanner visible={networkInterrupted}>Reconnecting…</CallBanner>
            <DeviceFallbackBanners
              banners={deviceBanners}
              onDismiss={clearDeviceBanner}
              onOpenFixAV={() => fixAVRef.current?.()}
            />
          </BannerStack>
          {fatalError ? (
            <FatalErrorOverlay
              error={fatalError}
              onRejoin={() => {
                setFatalError(null);
                callObject.join({ url: roomUrl });
              }}
            />
          ) : (
            <Call
              showNickname={showNickname}
              showTitle={showTitle}
              showSelfView={showSelfView}
              layout={layout}
              rooms={rooms}
            />
          )}
          <Modal
            isOpen={!!deviceError && !fatalError}
            onClose={() => {
              if (deviceError?.type === "mic-error") setMicError(null);
              else if (deviceError?.type === "speaker-error")
                setSpeakerError(null);
              else setCameraError(null);
            }}
            maxWidth="xl"
          >
            <UserMediaError
              error={deviceError}
              onSwitchDevice={handleSwitchDevice}
            />
          </Modal>
        </div>
        <Tray
          showReportMissing={showReportMissing}
          showAudioMute={showAudioMute}
          showVideoMute={showVideoMute}
          player={player}
          stageElapsed={stageElapsed}
          progressLabel={progressLabel}
          audioContext={audioContext}
          resumeAudioContext={resumeAudioContext}
          roomUrl={roomUrl}
          fixAVRef={fixAVRef}
        />
      </div>
      <DailyAudio onPlayFailed={handleAudioPlayFailed} />
      {/* Unified setup completion prompt - shows when any operations require user gesture */}
      <Modal isOpen={showGesturePrompt} maxWidth="sm">
        <div className="text-center">
          <p className="mb-4 text-slate-900">{gesturePromptMessage}</p>
          <button
            type="button"
            onClick={
              hasSetupOperations ? handleCompleteSetup : handleEnableAudio
            }
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
          >
            {gesturePromptButtonLabel}
          </button>
        </div>
      </Modal>
    </div>
  );
}
