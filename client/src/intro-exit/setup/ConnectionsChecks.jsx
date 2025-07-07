import React, { useEffect } from "react";
import { useDaily } from "@daily-co/daily-react";
import { usePlayer } from "@empirica/core/player/classic/react";

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
        setNetworkStatus("failed");
        return;
      }

      try {
        const videoTrack =
          callObject.participants()?.local?.tracks?.video.persistentTrack;
        logEntry.debug.videoTrack = videoTrack;

        const testResult = await callObject.testNetworkConnectivity(videoTrack);

        if (testResult?.result === "passed") {
          logEntry.value = "connected";
          player.append("setupSteps", logEntry);
          console.log("Network connectivity test result", logEntry);
          setNetworkStatus("connected");
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
      {networkStatus === "connected" && (
        <p> ✅ Network connectivity check passed!</p>
      )}
      {networkStatus === "retrying" && (
        <p> 🟨 First attempt failed, retrying network connectivity check...</p>
      )}
      {networkStatus === "failed" && (
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
        player.append("setupSteps", "failed");
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
          logEntry.value = "available";
          player.append("setupSteps", logEntry);
          console.log("Websocket Connectivity test result", logEntry);
          setWebsocketStatus("available");
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
      {websocketStatus === "available" && (
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

  useEffect(() => {
    let callQualityTestTimer;

    const runTest = async (retries = 2, timeout = 10000) => {
      const logEntry = {
        step: "cameraCheck",
        event: "callQualityTest",
        errors: [],
        debug: {
          retries,
          timeout,
        },
        timestamp: new Date().toISOString(),
      };

      if (retries < 1) {
        logEntry.value = "failed";
        player.append("setupSteps", logEntry);
        console.log("Call quality test failed", logEntry);
        setCallQualityStatus("unacceptable");
        return;
      }

      try {
        callQualityTestTimer = setTimeout(() => {
          callObject.stopTestCallQuality();
        }, timeout); // stop the test after the specified timeout

        const testResult = await callObject.testCallQuality();
        if (testResult?.result === "good" || testResult?.result === "warning") {
          logEntry.value = "acceptable";
          player.append("setupSteps", logEntry);
          console.log("Call quality test result", logEntry);
          setCallQualityStatus("acceptable");
        } else {
          logEntry.value = "retrying";
          player.append("setupSteps", logEntry);
          console.log("Call quality test result", logEntry);
          setCallQualityStatus("retrying");
          runTest(retries - 1, timeout + 5000);
        }
      } catch (err) {
        logEntry.errors.push(err.message);
        player.append("setupSteps", logEntry);
        console.log("Call quality test result", logEntry);
        setCallQualityStatus("errored");
      }
    };

    if (callObject && callQualityStatus === "waiting") runTest();

    return () => {
      clearTimeout(callQualityTestTimer);
    };
  }, [callObject, callQualityStatus, player, setCallQualityStatus]);

  return (
    <div>
      {callQualityStatus === "waiting" && (
        <p> ⏳ Checking call quality. Takes 10 Seconds...</p>
      )}
      {callQualityStatus === "acceptable" && (
        <p> ✅ Call quality check passed!</p>
      )}
      {callQualityStatus === "retrying" && (
        <p> 🟨 First attempt failed, trying a longer quality check...</p>
      )}
      {callQualityStatus === "unacceptable" && (
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
