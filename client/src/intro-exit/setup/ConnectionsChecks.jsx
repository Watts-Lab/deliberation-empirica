import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDaily } from "@daily-co/daily-react";
import { usePlayer } from "@empirica/core/player/classic/react";

// Simple countdown component for quality checks
function QualityCheckCountdown({ duration }) {
  const [remaining, setRemaining] = useState(Math.ceil(duration / 1000));

  useEffect(() => {
    setRemaining(Math.ceil(duration / 1000));
  }, [duration]);

  useEffect(() => {
    if (remaining <= 0) {
      return () => {};
    }

    const timer = setTimeout(() => {
      setRemaining(remaining - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [remaining]);

  return <span>({remaining} seconds remaining)</span>;
}

export function TestNetworkConnectivity({ networkStatus, setNetworkStatus }) {
  // Check that we can establish a connection to daily.co turn server (
  // see: https://docs.daily.co/reference/daily-js/instance-methods/test-network-connectivity

  const callObject = useDaily();
  const player = usePlayer();

  useEffect(() => {
    const runTest = async (retriesRemaining = 1) => {
      const logEntry = {
        step: "cameraCheck",
        event: "networkConnectivityTest",
        errors: [],
        debug: {
          retriesRemaining,
        },
        timestamp: new Date().toISOString(),
      };

      if (retriesRemaining < 1) {
        logEntry.value = "failed";
        player.append("setupSteps", "failed");
        console.log("Network connectivity test failed", logEntry);
        setNetworkStatus("fail");
        return;
      }

      try {
        const videoTrack =
          callObject.participants()?.local?.tracks?.video.persistentTrack;
        logEntry.debug.videoTrack = videoTrack;

        const testResult = await callObject.testNetworkConnectivity(videoTrack);

        if (testResult?.result === "passed") {
          logEntry.value = "pass";
          player.append("setupSteps", logEntry);
          console.log("Network connectivity test result", logEntry);
          setNetworkStatus("pass");
        } else {
          logEntry.value = "retrying";
          player.append("setupSteps", logEntry);
          console.log("Network connectivity test result", logEntry);
          setNetworkStatus("retrying");
          runTest(retriesRemaining - 1);
        }
      } catch (err) {
        logEntry.value = "errored";
        logEntry.errors.push(err.message);
        player.append("setupSteps", logEntry);
        console.log("Network connectivity test result", logEntry);
        setNetworkStatus("errored");
      }
    };

    if (callObject && networkStatus === "waiting") runTest(); // check this only runs once
  }, [callObject, networkStatus, setNetworkStatus, player]);

  return (
    <div>
      {networkStatus === "waiting" && (
        <p> ⏳ Checking network connectivity...</p>
      )}
      {networkStatus === "pass" && (
        <p> ✅ Network connectivity check passed!</p>
      )}
      {networkStatus === "retrying" && (
        <p> 🟨 First attempt failed, retrying network connectivity check...</p>
      )}
      {networkStatus === "fail" && (
        <p> ❌ Network connectivity check failed!</p>
      )}
    </div>
  );
}

export function TestWebsockets({ websocketStatus, setWebsocketStatus }) {
  // Check that user is allowed to use websockets (they shouldn't be able to use DL if this is false, but good to know)
  // see: https://docs.daily.co/reference/daily-js/instance-methods/test-websocket-connectivity

  const callObject = useDaily();
  const player = usePlayer();

  useEffect(() => {
    const runTest = async (retriesRemaining = 1) => {
      const logEntry = {
        step: "cameraCheck",
        event: "networkConnectivityTest",
        errors: [],
        debug: {
          retriesRemaining,
        },
        timestamp: new Date().toISOString(),
      };

      if (retriesRemaining < 1) {
        logEntry.value = "failed";
        player.append("setupSteps", logEntry);
        console.log("Websocket Connectivity test failed", logEntry);
        setWebsocketStatus("failed");
        return;
      }

      try {
        const testResult = await callObject.testWebsocketConnectivity();
        if (
          testResult?.result === "passed" ||
          testResult?.result === "warning"
        ) {
          logEntry.value = "pass";
          player.append("setupSteps", logEntry);
          console.log("Websocket Connectivity test result", logEntry);
          setWebsocketStatus("pass");
        } else {
          logEntry.value = "retrying";
          player.append("setupSteps", logEntry);
          console.log("Websocket Connectivity test result", logEntry);
          setWebsocketStatus("retrying");
          runTest(retriesRemaining - 1);
        }
      } catch (err) {
        logEntry.errors.push(err.message);
        player.append("setupSteps", logEntry);
        console.log("Websocket Connectivity test result", logEntry);
        setWebsocketStatus("errored");
      }
    };

    if (callObject && websocketStatus === "waiting") runTest();
  }, [callObject, websocketStatus, setWebsocketStatus, player]);

  return (
    <div>
      {websocketStatus === "waiting" && (
        <p> ⏳ Checking websocket connectivity...</p>
      )}
      {websocketStatus === "pass" && (
        <p> ✅ Websocket connectivity check passed!</p>
      )}
      {websocketStatus === "retrying" && (
        <p> 🟨 First attempt failed, retrying websocket check... </p>
      )}
      {websocketStatus === "failed" && (
        <p> ❌ Websocket connectivity check failed!</p>
      )}
    </div>
  );
}

export function TestCallQuality({ callQualityStatus, setCallQualityStatus }) {
  // Test call quality
  // see: https://docs.daily.co/reference/daily-js/instance-methods/test-call-quality

  const callObject = useDaily();
  const player = usePlayer();
  const [currentTimeout, setCurrentTimeout] = useState(null);

  const [retriesRemaining, setRetriesRemaining] = useState(2);
  const [nextDuration, setNextDuration] = useState(10000);
  const callQualityTestTimerRef = useRef(null);
  const isRunningRef = useRef(false);

  const clearCallQualityTimer = useCallback(() => {
    if (callQualityTestTimerRef.current) {
      clearTimeout(callQualityTestTimerRef.current);
      callQualityTestTimerRef.current = null;
    }
  }, []);

  const runTest = useCallback(
    async (retries, duration) => {
      if (!callObject || isRunningRef.current) {
        return;
      }

      setCurrentTimeout(duration);
      console.log(
        `Starting call quality test with ${retries} retries remaining, duration ${duration}`
      );
      isRunningRef.current = true;

      const logEntry = {
        step: "cameraCheck",
        event: "callQualityTest",
        errors: [],
        debug: {
          retries,
          timeout: duration,
        },
        timestamp: new Date().toISOString(),
      };

      if (retries < 1) {
        logEntry.value = "failed";
        player.append("setupSteps", logEntry);
        console.log("Call quality test failed", logEntry);
        setCallQualityStatus("fail");
        setCurrentTimeout(null);
        setRetriesRemaining(2);
        setNextDuration(10000);
        isRunningRef.current = false;
        return;
      }

      try {
        clearCallQualityTimer();
        callQualityTestTimerRef.current = setTimeout(() => {
          callObject.stopTestCallQuality();
        }, duration);

        const testResult = await callObject.testCallQuality();

        clearCallQualityTimer();
        isRunningRef.current = false;

        if (
          testResult?.result === "good" ||
          testResult?.result === "warning"
        ) {
          logEntry.value = "pass";
          player.append("setupSteps", logEntry);
          console.log("Call quality test result", logEntry);
          setCallQualityStatus("pass");
          setCurrentTimeout(null);
          setRetriesRemaining(2);
          setNextDuration(10000);
        } else {
          logEntry.value = "retrying";
          player.append("setupSteps", logEntry);
          console.log("Call quality test result", logEntry);
          setCallQualityStatus("retrying");
          setRetriesRemaining(retries - 1);
          setNextDuration(duration + 10000);
        }
      } catch (err) {
        clearCallQualityTimer();
        isRunningRef.current = false;

        logEntry.errors.push(err.message);
        player.append("setupSteps", logEntry);
        console.log("Call quality test result", logEntry);
        setCallQualityStatus("errored");
        setCurrentTimeout(null);
        setRetriesRemaining(2);
        setNextDuration(10000);
      }
    },
    [callObject, clearCallQualityTimer, player, setCallQualityStatus]
  );

  useEffect(() => {
    if (!callObject) {
      return undefined;
    }

    if (callQualityStatus === "waiting") {
      runTest(retriesRemaining, nextDuration);
    } else if (callQualityStatus === "retrying") {
      runTest(retriesRemaining, nextDuration);
    }

    return () => {
      clearCallQualityTimer();
      isRunningRef.current = false;
    };
  }, [
    callObject,
    callQualityStatus,
    clearCallQualityTimer,
    nextDuration,
    retriesRemaining,
    runTest,
  ]);

  return (
    <div>
      {callQualityStatus === "waiting" && (
        <p>
          {" "}
          ⏳ Checking call quality{" "}
          {currentTimeout && (
            <QualityCheckCountdown duration={currentTimeout} />
          )}
          ...
        </p>
      )}
      {callQualityStatus === "pass" && <p> ✅ Call quality check passed!</p>}
      {callQualityStatus === "retrying" && (
        <p>
          {" "}
          🟨 First attempt failed, trying a longer quality check{" "}
          {currentTimeout && (
            <QualityCheckCountdown duration={currentTimeout} />
          )}
          ...
        </p>
      )}
      {callQualityStatus === "fail" && (
        <div>
          <p> ❌ Call quality check failed!</p>
          <p> Please try using a different browser.</p>
          <p>
            {" "}
            If you still get this message, and are on wifi, try moving closer to
            the router.
          </p>
        </div>
      )}
    </div>
  );
}
