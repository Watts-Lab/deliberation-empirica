/* eslint-disable no-await-in-loop */

import React, { useEffect, useRef } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";

const TONES = [
  { name: "Tone1", freq: 290 },
  { name: "Tone2", freq: 370 },
  { name: "Tone3", freq: 510 },
];
const DURATION_MS = 1000;
const THRESHOLD = 40; // Arbitrary units (0-255 scale)

export function LoopbackCheck({ setLoopbackStatus, loopbackStatus }) {
  const player = usePlayer();
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const runTest = async () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

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

      const playTone = (frequency) =>
        new Promise((resolve) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = frequency;
          osc.connect(gain);
          gain.connect(ctx.destination);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          osc.start();

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
      const finalResult = anyDetected ? "fail" : "success";

      const logEntry = {
        step: "loopbackCheck",
        event: "result",
        value: finalResult,
        errors: [],
        debug: { allResults },
        timestamp: new Date().toISOString(),
      };
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
            ❌ Feedback Check Failed! We detected a lot of sound from your
            speakers coming back into your microphone.
          </p>
          <p>This can make it hard for other people to hear you.</p>
          <p>
            If you are not wearing headphones, please put them on now and
            restart the sound setup.
          </p>
          <p>
            If you are wearing headphones, please check that they are plugged in
            properly.
          </p>
          <br />
        </>
      )}
      {loopbackStatus === "success" && (
        <p className="text-green-500 font-bold">✅ Feedback Check Passed!</p>
      )}
    </div>
  );
}
