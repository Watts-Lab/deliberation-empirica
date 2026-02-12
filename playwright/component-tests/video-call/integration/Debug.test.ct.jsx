import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { MockEmpiricaProvider } from '../../../mocks/MockEmpiricaProvider';
import { MockPlayer } from '../../../mocks/MockPlayer';
import { MockGame } from '../../../mocks/MockGame';
import { MockStage } from '../../../mocks/MockStage';

test('debug - MockEmpiricaProvider renders', async ({ mount }) => {
  const players = [new MockPlayer('p0', { name: 'Test', position: '0' })];
  const game = new MockGame({ dailyUrl: 'https://test.daily.co/room' });
  const stage = new MockStage({});

  const component = await mount(
    <MockEmpiricaProvider currentPlayerId="p0" players={players} game={game} stage={stage}>
      <div data-test="debug">MockEmpiricaProvider works!</div>
    </MockEmpiricaProvider>
  );

  await expect(component.locator('[data-test="debug"]')).toHaveText('MockEmpiricaProvider works!');
});

test('debug - Can import VideoCall', async ({ mount, page }) => {
  // Try to import and render VideoCall
  const { VideoCall } = await import('../../../../client/src/call/VideoCall');

  const players = [new MockPlayer('p0', { name: 'Test', position: '0' })];
  const game = new MockGame({ dailyUrl: 'https://test.daily.co/room' });
  const stage = new MockStage({});

  const component = await mount(
    <MockEmpiricaProvider currentPlayerId="p0" players={players} game={game} stage={stage}>
      <div data-test="placeholder">About to render VideoCall...</div>
    </MockEmpiricaProvider>
  );

  await expect(component.locator('[data-test="placeholder"]')).toBeVisible();

  // Check for errors in console
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('Errors:', errors);
});
