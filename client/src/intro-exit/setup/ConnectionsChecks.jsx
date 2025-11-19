import React, { useEffect, useRef, useState } from "react";
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
  const testIsRunning = useRef(false);

  useEffect(() => {
    async function runTest() {
      const logEntry = {
        step: "cameraCheck",
        event: "networkConnectivityTest",
        errors: [],
        debug: { status: networkStatus },
        timestamp: new Date().toISOString(),
      };

      try {
        testIsRunning.current = true;
        const videoTrack =
          callObject.participants()?.local?.tracks?.video.persistentTrack;
        logEntry.debug.videoTrack = videoTrack;
        const testResult = await callObject.testNetworkConnectivity(videoTrack);
        logEntry.debug.testResult = testResult;

        if (testResult?.result === "passed") {
          logEntry.value = "pass";
          setNetworkStatus("pass");
        } else if (networkStatus === "waiting") {
          // first failure, try again
          logEntry.value = "retrying";
          setNetworkStatus("retrying");
        } else {
          logEntry.value = "fail";
          setNetworkStatus("fail");
        }
      } catch (err) {
        logEntry.errors.push(err.message);
        logEntry.value = "errored";
        setNetworkStatus("errored");
      } finally {
        testIsRunning.current = false;
        player.append("setupSteps", logEntry);
        console.log("Network connectivity test result", logEntry);
      }
    }

    if (
      !testIsRunning.current &&
      callObject &&
      ["waiting", "retrying"].includes(networkStatus)
    ) {
      runTest();
    }

    return () => {
      testIsRunning.current = false;
    };
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
      {networkStatus === "errored" && (
        <p> 😵 Network connectivity check encountered an error!</p>
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
  const testIsRunning = useRef(false);

  useEffect(() => {
    async function runTest() {
      const logEntry = {
        step: "cameraCheck",
        event: "websocketConnectivityTest",
        errors: [],
        debug: { status: websocketStatus },
        timestamp: new Date().toISOString(),
      };

      try {
        testIsRunning.current = true;
        const testResult = await callObject.testWebsocketConnectivity();
        logEntry.debug.testResult = testResult;

        if (["passed", "warning"].includes(testResult?.result)) {
          logEntry.value = "pass";
          setWebsocketStatus("pass");
        } else if (websocketStatus === "waiting") {
          // first failure, try again
          logEntry.value = "retrying";
          setWebsocketStatus("retrying");
        } else {
          logEntry.value = "fail";
          setWebsocketStatus("fail");
        }
      } catch (err) {
        logEntry.errors.push(err.message);
        logEntry.value = "errored";
        setWebsocketStatus("errored");
      } finally {
        testIsRunning.current = false;
        player.append("setupSteps", logEntry);
        console.log("Websocket connectivity test result", logEntry);
      }
    }

    if (
      !testIsRunning.current &&
      callObject &&
      ["waiting", "retrying"].includes(websocketStatus)
    ) {
      runTest();
    }

    return () => {
      testIsRunning.current = false;
    };
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
      {websocketStatus === "errored" && (
        <p> 😵 Websocket connectivity check encountered an error!</p>
      )}
      {websocketStatus === "failed" && (
        <div>
          <p> ❌ Websocket connectivity check failed!</p>
          <p> This could be due to a firewall or VPN settings. </p>
          <p>
            If you are on a managed network (e.g. at a university or company),
            you may need to contact your IT department for help.
          </p>
          <p>
            {" "}
            If you are using a VPN, try disconnecting from the VPN and reloading
            this page.{" "}
          </p>
        </div>
      )}
    </div>
  );
}

export function TestCallQuality({ callQualityStatus, setCallQualityStatus }) {
  // Test call quality
  // see: https://docs.daily.co/reference/daily-js/instance-methods/test-call-quality

  const callObject = useDaily();
  const player = usePlayer();
  const [timeCheckStarted, setTimeCheckStarted] = useState(Date.now());
  const testIsRunning = useRef(false);
  const timeCheckDuration = 30000; // 30 seconds
  const timeRemaining = Math.max(
    0,
    timeCheckDuration - (Date.now() - timeCheckStarted)
  );

  useEffect(() => {
    async function runTest() {
      const logEntry = {
        step: "cameraCheck",
        event: "callQualityTest",
        errors: [],
        debug: { status: callQualityStatus },
        timestamp: new Date().toISOString(),
      };

      try {
        setTimeCheckStarted(Date.now());
        testIsRunning.current = true;
        const testResult = await callObject.testCallQuality();
        logEntry.debug.testResult = testResult;

        if (testResult?.result === "good" || testResult?.result === "warning") {
          logEntry.value = "pass";
          setCallQualityStatus("pass");
        } else if (callQualityStatus === "waiting") {
          // first failure, try again
          logEntry.value = "retrying";
          setCallQualityStatus("retrying");
        } else {
          logEntry.value = "fail";
          setCallQualityStatus("fail");
        }
      } catch (err) {
        logEntry.errors.push(err.message);
        logEntry.value = "errored";
        setCallQualityStatus("errored");
      } finally {
        testIsRunning.current = false;
        player.append("setupSteps", logEntry);
        console.log("Call quality test result", logEntry);
      }
    }

    if (
      !testIsRunning.current &&
      callObject &&
      ["waiting", "retrying"].includes(callQualityStatus)
    ) {
      runTest();
    }

    return () => {
      testIsRunning.current = false;
    };
  }, [callObject, callQualityStatus, setCallQualityStatus, player]);

  return (
    <div>
      {callQualityStatus === "waiting" && (
        <p>
          {" "}
          ⏳ Checking call quality{" "}
          <QualityCheckCountdown duration={timeRemaining} />
          ...
        </p>
      )}
      {callQualityStatus === "pass" && <p> ✅ Call quality check passed!</p>}
      {callQualityStatus === "retrying" && (
        <p>
          {" "}
          🟨 First attempt failed, retrying call quality test{" "}
          <QualityCheckCountdown duration={timeRemaining} />
          ...
        </p>
      )}
      {callQualityStatus === "errored" && (
        <p> 😵 Call quality check encountered an error!</p>
      )}
      {callQualityStatus === "fail" && (
        <div>
          <p> ❌ Call quality check failed!</p>
          <p>
            {" "}
            This could be due to a weak internet connection, or to your computer
            having trouble processing video. Troubleshooting tips:
          </p>
          <ul>
            <li>
              Try closing any browser tabs or applications that may be using a
              lot of memory.
            </li>
            <li>
              If you are on wifi, try moving closer to the router, or using a
              wired connection.
            </li>
            <li>You can also try using a different browser.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
