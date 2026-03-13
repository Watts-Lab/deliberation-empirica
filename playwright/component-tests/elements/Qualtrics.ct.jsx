import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { QualtricsStory } from './QualtricsStory';

/**
 * Component Tests for Qualtrics URL Parameter Resolution
 *
 * Related: Issue #1211 — Qualtrics should accept urlParams the same way
 * TrackedLink does, including dynamic `reference` fields that resolve
 * values from player/game state at render time.
 *
 * These tests verify:
 *   QURL-001  Static params (`value`) are appended to the iframe src
 *   QURL-002  deliberationId and sampleId are always appended
 *   QURL-003  Reference to urlParams resolves and is appended
 *   QURL-004  Reference to participantInfo field resolves and is appended
 *   QURL-005  Mixed static + reference params both appear in the URL
 *   QURL-006  QualtricsEOS postMessage calls onSubmit and records data
 *
 * Mock setup:
 *   hooksConfig.empirica  — provides MockEmpiricaProvider with player attrs
 *                           (participantData, sampleId, urlParams, name, etc.)
 *   IdleProvider          — wraps Qualtrics to avoid console errors from the
 *                           default IdleContext no-op when setAllowIdle fires
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SURVEY_URL = 'https://test.qualtrics.com/jfe/form/SV_testSurvey123';

/** Base player config with deliberationId and sampleId populated. */
const basePlayer = {
  id: 'p0',
  attrs: {
    participantData: { deliberationId: 'delib-abc-123' },
    sampleId: 'sample-xyz-456',
  },
};

/** Minimal hooksConfig for tests that only need basic player state. */
const baseEmpirica = {
  currentPlayerId: 'p0',
  players: [basePlayer],
  game: { attrs: {} },
  stage: { attrs: {} },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * Test ID: QURL-001
 * Issue: #1211
 * Validates: Static `value` params are appended to the iframe src URL
 */
test('QURL-001: static params appended to iframe URL', async ({ mount }) => {
  const component = await mount(
    <QualtricsStory
      url={SURVEY_URL}
      params={[
        { key: 'condition', value: 'treatment' },
        { key: 'sessionNum', value: 2 },
      ]}
    />,
    { hooksConfig: { empirica: baseEmpirica } },
  );

  const src = await component.locator('[data-test="qualtricsIframe"]').getAttribute('src');
  const url = new URL(src);
  expect(url.searchParams.get('condition')).toBe('treatment');
  expect(url.searchParams.get('sessionNum')).toBe('2');
});

/**
 * Test ID: QURL-002
 * Issue: #1211
 * Validates: deliberationId and sampleId are always appended, even with no
 * extra params
 */
test('QURL-002: deliberationId and sampleId always appended', async ({ mount }) => {
  const component = await mount(
    <QualtricsStory url={SURVEY_URL} params={[]} />,
    { hooksConfig: { empirica: baseEmpirica } },
  );

  const src = await component.locator('[data-test="qualtricsIframe"]').getAttribute('src');
  const url = new URL(src);
  expect(url.searchParams.get('deliberationId')).toBe('delib-abc-123');
  expect(url.searchParams.get('sampleId')).toBe('sample-xyz-456');
});

/**
 * Test ID: QURL-003
 * Issue: #1211
 * Validates: `reference: 'urlParams.PROLIFIC_PID'` resolves from player
 * urlParams and is appended to the iframe src
 */
test('QURL-003: reference to urlParams resolves in iframe URL', async ({ mount }) => {
  const component = await mount(
    <QualtricsStory
      url={SURVEY_URL}
      params={[{ key: 'prolificId', reference: 'urlParams.PROLIFIC_PID' }]}
    />,
    {
      hooksConfig: {
        empirica: {
          ...baseEmpirica,
          players: [{
            id: 'p0',
            attrs: {
              ...basePlayer.attrs,
              urlParams: { PROLIFIC_PID: 'PROLIFIC-TEST-123' },
            },
          }],
        },
      },
    },
  );

  const src = await component.locator('[data-test="qualtricsIframe"]').getAttribute('src');
  const url = new URL(src);
  expect(url.searchParams.get('prolificId')).toBe('PROLIFIC-TEST-123');
});

/**
 * Test ID: QURL-004
 * Issue: #1211
 * Validates: `reference: 'participantInfo.name'` resolves from player state
 * and is appended to the iframe src
 */
test('QURL-004: reference to participantInfo resolves in iframe URL', async ({ mount }) => {
  const component = await mount(
    <QualtricsStory
      url={SURVEY_URL}
      params={[{ key: 'pName', reference: 'participantInfo.name' }]}
    />,
    {
      hooksConfig: {
        empirica: {
          ...baseEmpirica,
          players: [{
            id: 'p0',
            attrs: { ...basePlayer.attrs, name: 'Alice' },
          }],
        },
      },
    },
  );

  const src = await component.locator('[data-test="qualtricsIframe"]').getAttribute('src');
  const url = new URL(src);
  expect(url.searchParams.get('pName')).toBe('Alice');
});

/**
 * Test ID: QURL-005
 * Issue: #1211
 * Validates: Static and reference params can be mixed; all appear in the URL
 * alongside the always-present deliberationId and sampleId
 */
test('QURL-005: mixed static and reference params both appear in URL', async ({ mount }) => {
  const component = await mount(
    <QualtricsStory
      url={SURVEY_URL}
      params={[
        { key: 'staticFlag', value: 'on' },
        { key: 'dynamicId', reference: 'urlParams.PROLIFIC_PID' },
      ]}
    />,
    {
      hooksConfig: {
        empirica: {
          ...baseEmpirica,
          players: [{
            id: 'p0',
            attrs: {
              ...basePlayer.attrs,
              urlParams: { PROLIFIC_PID: 'PROLIFIC-MIX-456' },
            },
          }],
        },
      },
    },
  );

  const src = await component.locator('[data-test="qualtricsIframe"]').getAttribute('src');
  const url = new URL(src);
  expect(url.searchParams.get('staticFlag')).toBe('on');
  expect(url.searchParams.get('dynamicId')).toBe('PROLIFIC-MIX-456');
  // Always-present params unaffected
  expect(url.searchParams.get('deliberationId')).toBe('delib-abc-123');
  expect(url.searchParams.get('sampleId')).toBe('sample-xyz-456');
});

/**
 * Test ID: QURL-006
 * Issue: #1211
 * Validates: A QualtricsEOS postMessage triggers onSubmit and records
 * qualtricsDataReady on the player
 */
test('QURL-006: QualtricsEOS postMessage calls onSubmit', async ({ mount, page }) => {
  await page.evaluate(() => { window.__qualtricsSubmitted = false; });

  await mount(
    <QualtricsStory url={SURVEY_URL} params={[]} />,
    { hooksConfig: { empirica: baseEmpirica } },
  );

  await page.evaluate(() => {
    window.postMessage('QualtricsEOS|SV_testSurveyId|FS_testSessionId', '*');
  });

  await page.waitForFunction(() => window.__qualtricsSubmitted === true, { timeout: 2000 });
});
