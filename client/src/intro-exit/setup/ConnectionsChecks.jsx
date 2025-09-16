import React, { useEffect } from "react";
import { useDaily } from "@daily-co/daily-react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { useGetBrowser } from "../../components/hooks";

export function TestNetworkConnectivity({ networkStatus, setNetworkStatus }) {
  // Check that we can establish a connection to daily.co turn server (
  // see: https://docs.daily.co/reference/daily-js/instance-methods/test-network-connectivity

  const callObject = useDaily();
  const player = usePlayer();
  const browser = useGetBrowser();

  useEffect(() => {
    const runTest = async (retriesRemaining = 1) => {
      // Firefox-specific adjustments
      const isFirefox = browser === "Firefox";
      const firefoxRetries = isFirefox ? Math.max(retriesRemaining, 2) : retriesRemaining;
      
      const logEntry = {
        step: "cameraCheck",
        event: "networkConnectivityTest",
        errors: [],
        debug: {
          retriesRemaining: firefoxRetries,
          browser,
          isFirefox,
          originalRetries: retriesRemaining,
        },
        timestamp: new Date().toISOString(),
      };

      if (firefoxRetries < 1) {
        logEntry.value = "failed";
        player.append("setupSteps", logEntry);
        console.log("Network connectivity test failed", logEntry);
        setNetworkStatus("failed");
        return;
      }

      try {
        // Firefox-specific: Add delay before network test
        if (isFirefox) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const videoTrack =
          callObject.participants()?.local?.tracks?.video.persistentTrack;
        logEntry.debug.videoTrack = !!videoTrack;

        const testResult = await callObject.testNetworkConnectivity(videoTrack);
        logEntry.debug.testResult = testResult;

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
          
          // Firefox-specific: Longer delay between retries
          const retryDelay = isFirefox ? 2000 : 1000;
          setTimeout(() => {
            runTest(firefoxRetries - 1);
          }, retryDelay);
        }
      } catch (err) {
        logEntry.value = "errored";
        logEntry.errors.push(err.message);
        logEntry.debug.errorName = err.name;
        player.append("setupSteps", logEntry);
        console.log("Network connectivity test result", logEntry);
        setNetworkStatus("errored");
      }
    };

    if (callObject && networkStatus === "waiting") {
      // Firefox-specific: Additional delay before starting
      const initialDelay = browser === "Firefox" ? 500 : 0;
      setTimeout(() => runTest(), initialDelay);
    }
  }, [callObject, networkStatus, setNetworkStatus, player, browser]);

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
  const browser = useGetBrowser();

  useEffect(() => {
    const runTest = async (retriesRemaining = 1) => {
      // Firefox-specific adjustments
      const isFirefox = browser === "Firefox";
      const firefoxRetries = isFirefox ? Math.max(retriesRemaining, 2) : retriesRemaining;
      
      const logEntry = {
        step: "cameraCheck",
        event: "websocketConnectivityTest",
        errors: [],
        debug: {
          retriesRemaining: firefoxRetries,
          browser,
          isFirefox,
          originalRetries: retriesRemaining,
        },
        timestamp: new Date().toISOString(),
      };

      if (firefoxRetries < 1) {
        logEntry.value = "failed";
        player.append("setupSteps", logEntry);
        console.log("Websocket Connectivity test failed", logEntry);
        setWebsocketStatus("failed");
        return;
      }

      try {
        // Firefox-specific: Add delay before websocket test
        if (isFirefox) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }

        const testResult = await callObject.testWebsocketConnectivity();
        logEntry.debug.testResult = testResult;
        
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
          
          // Firefox-specific: Longer delay between retries
          const retryDelay = isFirefox ? 2000 : 1000;
          setTimeout(() => {
            runTest(firefoxRetries - 1);
          }, retryDelay);
        }
      } catch (err) {
        logEntry.errors.push(err.message);
        logEntry.debug.errorName = err.name;
        player.append("setupSteps", logEntry);
        console.log("Websocket Connectivity test result", logEntry);
        setWebsocketStatus("errored");
      }
    };

    if (callObject && websocketStatus === "waiting") {
      // Firefox-specific: Additional delay before starting
      const initialDelay = browser === "Firefox" ? 300 : 0;
      setTimeout(() => runTest(), initialDelay);
    }
  }, [callObject, websocketStatus, setWebsocketStatus, player, browser]);

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
  const browser = useGetBrowser();

  useEffect(() => {
    let callQualityTestTimer;

    const runTest = async (retries = 2, timeout = 10000) => {
      // Firefox-specific adjustments
      const isFirefox = browser === "Firefox";
      const firefoxTimeout = isFirefox ? timeout * 2 : timeout; // Double timeout for Firefox
      const firefoxRetries = isFirefox ? Math.max(retries, 3) : retries; // Minimum 3 retries for Firefox
      
      const logEntry = {
        step: "cameraCheck",
        event: "callQualityTest",
        errors: [],
        debug: {
          retries: firefoxRetries,
          timeout: firefoxTimeout,
          browser,
          isFirefox,
          originalRetries: retries,
          originalTimeout: timeout,
        },
        timestamp: new Date().toISOString(),
      };

      if (firefoxRetries < 1) {
        logEntry.value = "failed";
        player.append("setupSteps", logEntry);
        console.log("Call quality test failed", logEntry);
        setCallQualityStatus("unacceptable");
        return;
      }

      try {
        // Firefox-specific: Add delay before starting test to ensure WebRTC connection is stable
        if (isFirefox && retries === firefoxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        callQualityTestTimer = setTimeout(() => {
          try {
            callObject.stopTestCallQuality();
          } catch (stopErr) {
            console.warn("Error stopping call quality test:", stopErr);
          }
        }, firefoxTimeout);

        const testResult = await callObject.testCallQuality();
        
        // Firefox-specific: More lenient quality assessment
        const isAcceptable = isFirefox 
          ? (testResult?.result === "good" || testResult?.result === "warning" || testResult?.result === "poor")
          : (testResult?.result === "good" || testResult?.result === "warning");

        if (isAcceptable) {
          logEntry.value = "acceptable";
          logEntry.debug.testResult = testResult;
          player.append("setupSteps", logEntry);
          console.log("Call quality test result", logEntry);
          setCallQualityStatus("acceptable");
        } else {
          logEntry.value = "retrying";
          logEntry.debug.testResult = testResult;
          player.append("setupSteps", logEntry);
          console.log("Call quality test result", logEntry);
          setCallQualityStatus("retrying");
          
          // Firefox-specific: Longer delay between retries
          const retryDelay = isFirefox ? 3000 : 1000;
          setTimeout(() => {
            runTest(firefoxRetries - 1, firefoxTimeout + 5000);
          }, retryDelay);
        }
      } catch (err) {
        logEntry.errors.push(err.message);
        logEntry.debug.errorName = err.name;
        
        // Firefox-specific error handling
        if (isFirefox && (err.name === 'NetworkError' || err.message.includes('network'))) {
          logEntry.debug.firefoxNetworkError = true;
          console.warn("Firefox network error detected, retrying with longer timeout", err);
          setTimeout(() => {
            runTest(firefoxRetries - 1, firefoxTimeout + 10000);
          }, 5000);
        } else {
          player.append("setupSteps", logEntry);
          console.log("Call quality test result", logEntry);
          setCallQualityStatus("errored");
        }
      } finally {
        clearTimeout(callQualityTestTimer);
      }
    };

    if (callObject && callQualityStatus === "waiting") {
      // Firefox-specific: Additional delay before starting initial test
      const initialDelay = browser === "Firefox" ? 1000 : 0;
      setTimeout(() => runTest(), initialDelay);
    }

    return () => {
      clearTimeout(callQualityTestTimer);
    };
  }, [callObject, callQualityStatus, player, setCallQualityStatus, browser]);

  return (
    <div>
      {callQualityStatus === "waiting" && (
        <p> ⏳ Checking call quality. Takes {browser === "Firefox" ? "20" : "10"} Seconds...</p>
      )}
      {callQualityStatus === "acceptable" && (
        <p> ✅ Call quality check passed!</p>
      )}
      {callQualityStatus === "retrying" && (
        <p> 🟨 {browser === "Firefox" ? "Firefox detected - trying extended quality check..." : "First attempt failed, trying a longer quality check..."}</p>
      )}
      {callQualityStatus === "unacceptable" && (
        <div>
          <p> ❌ Call quality check failed!</p>
          {browser === "Firefox" ? (
            <div>
              <p>Firefox-specific troubleshooting:</p>
              <ul className="list-disc ml-6">
                <li>Try refreshing the page and allowing camera/microphone permissions again</li>
                <li>Check Firefox's Enhanced Tracking Protection settings (shield icon in address bar)</li>
                <li>Ensure Firefox has permission to access camera/microphone in system settings</li>
                <li>Consider switching to Chrome or Edge as a temporary workaround</li>
              </ul>
            </div>
          ) : (
            <div>
              <p> Please try using a different browser.</p>
              <p>
                {" "}
                If you still get this message, and are on wifi, try moving closer to
                the router.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
