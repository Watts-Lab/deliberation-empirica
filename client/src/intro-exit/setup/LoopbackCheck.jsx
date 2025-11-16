/* eslint-disable no-await-in-loop */

import React, { useEffect, useRef } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Button } from "../../components/Button";

// LoopbackCheck plays known tones through the participant's speakers, measures
// whether those tones bleed back into the microphone, and flags setups where
// speaker output would be misattributed as the participant's own voice. In
// practice this doubles as a lightweight headphones check before the study.
const TONES = [
  { name: "Tone1", freq: 290 },
  { name: "Tone2", freq: 370 },
  { name: "Tone3", freq: 510 },
];
const DURATION_MS = 1000;
const THRESHOLD = 40; // Minimum delta above baseline to count as feedback

export function LoopbackCheck({
  setLoopbackStatus,
  loopbackStatus,
  onRetryAudio,
}) {
  const player = usePlayer();
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    // Capture a microphone stream, visualize its spectrum, and look for the
    // injected tones to confirm that audio is not looping from speakers to mic.
    const runTest = async () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // TODO: make sure that turning off echoCancellation, noiseSuppression, autoGainControl
      // in this stream does not turn them off globally for the user.
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const micSource = ctx.createMediaStreamSource(micStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      micSource.connect(analyser);

      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const drawSpectrum = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx2d = canvas.getContext("2d");
        const nyquist = ctx.sampleRate / 2;
        const maxHz = 1000;
        const maxIndex = Math.floor(
          (maxHz / nyquist) * analyser.frequencyBinCount
        );

        const render = () => {
          analyser.getByteFrequencyData(freqData);
          ctx2d.clearRect(0, 0, canvas.width, canvas.height);

          const visibleBins = freqData.slice(0, maxIndex);
          const barWidth = canvas.width / visibleBins.length;

          visibleBins.forEach((value, i) => {
            const x = i * barWidth;
            const height = (value / 255) * canvas.height;
            ctx2d.fillStyle = "lime";
            ctx2d.fillRect(x, canvas.height - height, barWidth, height);
          });

          animationRef.current = requestAnimationFrame(render);
        };

        render();
      };

      const stopDrawing = () => {
        cancelAnimationFrame(animationRef.current);
      };

      const getLevelAtFreq = (freq) => {
        const nyquist = ctx.sampleRate / 2;
        const index = Math.round((freq / nyquist) * analyser.frequencyBinCount);
        return freqData[index];
      };

      // Measure ambient energy at the target frequency so we know what "quiet"
      // looks like before we inject our test tones.
      const getBaseline = (frequency) =>
        new Promise((resolve) => {
          const readings = [];
          const interval = setInterval(() => {
            analyser.getByteFrequencyData(freqData);
            readings.push(getLevelAtFreq(frequency));
          }, 50);

          setTimeout(() => {
            clearInterval(interval);
            resolve(readings.reduce((a, b) => a + b, 0) / readings.length);
          }, 500);
        });

      // Play a short tone and record how loud it comes back through the mic.
      const playTone = (frequency) =>
        new Promise((resolve) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = frequency;
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          osc.start();

          // Capture multiple readings during the one-second tone so we can
          // average the entire window instead of relying on a single snapshot.
          const readings = [];
          const interval = setInterval(() => {
            analyser.getByteFrequencyData(freqData);
            readings.push(getLevelAtFreq(frequency));
          }, 50);

          setTimeout(() => {
            osc.stop();
            clearInterval(interval);
            resolve(readings);
          }, DURATION_MS);
        });

      drawSpectrum();

      const allResults = [];

      // eslint-disable-next-line no-restricted-syntax
      for (const tone of TONES) {
        const baseline = await getBaseline(tone.freq);
        const readings = await playTone(tone.freq);
        const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
        const delta = avg - baseline;
        allResults.push({ ...tone, baseline, avg, delta });
        await new Promise((r) => setTimeout(r, 500));
      }

      stopDrawing();
      micStream.getTracks().forEach((t) => t.stop());
      ctx.close();

      const anyDetected = allResults.some((r) => r.delta > THRESHOLD);
      const finalResult = anyDetected ? "fail" : "pass";

      const logEntry = {
        step: "loopbackCheck",
        event: "result",
        value: finalResult,
        errors: [],
        debug: { allResults },
        timestamp: new Date().toISOString(),
      };
      // Loopback failure is advisory: we warn and log for later analysis, but
      // the equipment flow keeps moving so participants are not blocked here.
      console.log("Loopback Check Result:", logEntry);
      player.append("setupSteps", logEntry);

      setLoopbackStatus(finalResult);
    };

    runTest();
    // Cleanup on unmount
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [setLoopbackStatus]);

  return (
    <div className="mt-8">
      <h2>🔁 Checking for feedback</h2>
      <p>
        {" "}
        This is to make sure your microphone does not pick up sound from your
        speakers.
      </p>
      <canvas
        ref={canvasRef}
        height={100}
        width={500}
        className="my-4 border border-gray-400 rounded"
      />
      {loopbackStatus === "fail" && (
        <>
          <p className="text-red-500 font-bold">
            ❌ Feedback detected! Your mic is picking up sound from your
            speakers or very loud headphones.
          </p>
          <p>
            Please switch to headphones, lower their volume, or move your mic
            farther away to avoid echo and improve transcription accuracy.
          </p>
          <p className="italic">
            We&apos;ll let you continue, but conversations may be harder to use
            for analysis if the leak continues.
          </p>
          {/* Re-run both mic + loopback checks after hardware changes without
              forcing people back through permissions/video. */}
          {onRetryAudio && (
            <Button
              className="mt-3"
              handleClick={onRetryAudio}
              testId="retryAudioChecks"
            >
              Retry audio checks
            </Button>
          )}
          <br />
        </>
      )}
    </div>
  );
}
