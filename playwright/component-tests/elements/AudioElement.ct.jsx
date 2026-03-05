import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { AudioElement } from '../../../client/src/elements/AudioElement';

/**
 * Component Tests for AudioElement
 *
 * AudioElement plays a CDN-hosted audio file when a stage element has type
 * "audio". The file URL is resolved via useFileURL (which reads Empirica
 * globals for the CDN base URL) and played via the Web Audio API.
 *
 * These tests verify:
 *   AE-001  Audio plays when the file URL resolves from CDN config
 *   AE-002  Audio is not recreated on re-render with the same file (regression
 *           guard: old code called `new Audio()` in the render body, creating
 *           a new instance—and triggering setHasPlayed—on every render)
 *   AE-003  Audio is paused and src cleared on unmount (prevents the same
 *           buffer-loop bug seen with DailyAudio on call end)
 *
 * Mock setup:
 *   window.__mockGlobal  – read by the useGlobal mock alias for
 *                           @empirica/core/player/react; provides cdnList and
 *                           recruitingBatchConfig so useFileURL can resolve URLs
 *   window.Audio         – replaced with a spy that records instantiations,
 *                           play/pause calls, and canplaythrough listeners
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupAudioMock(page) {
  await page.evaluate(() => {
    window.mockAudioInstances = [];
    window.Audio = function AudioMock(url) {
      const instance = {
        src: url,
        _played: false,
        _paused: false,
        _listeners: {},
        play() {
          instance._played = true;
          return Promise.resolve();
        },
        pause() {
          instance._paused = true;
        },
        addEventListener(evt, fn) {
          instance._listeners[evt] = fn;
        },
        removeEventListener(evt, fn) {
          if (instance._listeners[evt] === fn) {
            delete instance._listeners[evt];
          }
        },
      };
      window.mockAudioInstances.push(instance);
      return instance;
    };
  });
}

async function setupGlobalsMock(page) {
  await page.evaluate(() => {
    window.__mockGlobal = {
      get(key) {
        if (key === 'cdnList') return { prod: 'http://test-cdn.example.com' };
        if (key === 'recruitingBatchConfig') return { cdn: 'prod' };
        return null;
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/** AE-001: Audio plays when file URL resolves from CDN config */
test('AE-001: audio plays when file URL resolves', async ({ mount, page }) => {
  await setupAudioMock(page);
  await setupGlobalsMock(page);

  await mount(<AudioElement file="test-audio.mp3" />);

  // useFileURL resolves asynchronously via useEffect; wait for Audio instantiation
  await expect.poll(() => page.evaluate(() => window.mockAudioInstances.length))
    .toBeGreaterThan(0);

  // Correct CDN URL was used
  const audioSrc = await page.evaluate(() => window.mockAudioInstances[0]?.src);
  expect(audioSrc).toBe('http://test-cdn.example.com/test-audio.mp3');

  // Simulate browser signalling audio is ready to play
  await page.evaluate(() => {
    window.mockAudioInstances[0]?._listeners.canplaythrough?.();
  });

  // play() was called
  const played = await page.evaluate(() => window.mockAudioInstances[0]?._played);
  expect(played).toBe(true);
});

/** AE-002: Audio element is not recreated on re-render with the same file */
test('AE-002: audio is not recreated on re-render', async ({ mount, page }) => {
  await setupAudioMock(page);
  await setupGlobalsMock(page);

  const component = await mount(<AudioElement file="test-audio.mp3" />);

  // Wait for initial Audio creation
  await expect.poll(() => page.evaluate(() => window.mockAudioInstances.length))
    .toBe(1);

  // Re-render with the same file prop — fileURL dep is unchanged, effect should not re-run
  await component.update(<AudioElement file="test-audio.mp3" />);

  const count = await page.evaluate(() => window.mockAudioInstances.length);
  expect(count).toBe(1);
});

/** AE-003: Audio is paused and src cleared on unmount */
test('AE-003: audio is paused and src cleared on unmount', async ({ mount, page }) => {
  await setupAudioMock(page);
  await setupGlobalsMock(page);

  const component = await mount(<AudioElement file="test-audio.mp3" />);

  // Wait for Audio to be instantiated
  await expect.poll(() => page.evaluate(() => window.mockAudioInstances.length))
    .toBeGreaterThan(0);

  await component.unmount();

  const paused = await page.evaluate(() => window.mockAudioInstances[0]?._paused);
  const src = await page.evaluate(() => window.mockAudioInstances[0]?.src);
  expect(paused).toBe(true);
  expect(src).toBe('');
});
