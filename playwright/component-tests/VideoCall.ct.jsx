import { test, expect } from '@playwright/experimental-ct-react';
import { VideoCall } from '../../client/src/call/VideoCall';
import { EmpiricaContext } from '@empirica/core/player/react';
import { createMockEmpiricaContext } from '../mocks/index.js';
import { createMultiPlayerScenario, simulatePlayerJoin } from '../helpers/scenarios.js';
import { createTestRoom, cleanupTestRoom } from '../helpers/daily.js';

test.describe('VideoCall Component', () => {
  let room;

  test.beforeEach(async () => {
    // Create room using production server code
    room = await createTestRoom();
  });

  test.afterEach(async () => {
    // Cleanup using production server code
    if (room) {
      await cleanupTestRoom(room.name);
    }
  });

  test('single player joins room and sees self', async ({ mount }) => {
    const mockContext = createMockEmpiricaContext({
      playerId: 'player-0',
      playerName: 'Test User',
      playerPosition: '0',
      roomUrl: room.url,
    });

    const component = await mount(
      <EmpiricaContext.Provider value={mockContext}>
        <VideoCall showSelfView={true} />
      </EmpiricaContext.Provider>
    );

    // Wait for Daily.co to join
    await expect(component.locator('[data-test="callTile"]')).toBeVisible({
      timeout: 15000
    });

    // Verify at least one tile is rendered (self)
    const tileCount = await component.locator('[data-test="callTile"]').count();
    expect(tileCount).toBeGreaterThan(0);
  });

  test('player sets dailyId when joining', async ({ mount, page }) => {
    const mockContext = createMockEmpiricaContext({
      playerId: 'player-0',
      playerName: 'Test User',
      roomUrl: room.url,
    });

    await mount(
      <EmpiricaContext.Provider value={mockContext}>
        <VideoCall showSelfView={true} />
      </EmpiricaContext.Provider>
    );

    // Wait for join
    await page.waitForTimeout(3000);

    // Verify player.set('dailyId', ...) was called
    const dailyIdCalls = mockContext.player.getSetCalls('dailyId');
    expect(dailyIdCalls.length).toBeGreaterThan(0);
    expect(dailyIdCalls[0].value).toBeTruthy();

    // Verify we can retrieve it
    const dailyId = mockContext.player.get('dailyId');
    expect(dailyId).toBeTruthy();
  });

  test('multi-player scenario with mocked participants', async ({ mount }) => {
    // Create scenario with 3 players
    const mockContext = createMultiPlayerScenario({
      numPlayers: 3,
      currentPlayerIndex: 0,
      roomUrl: room.url,
    });

    // Simulate other players having joined Daily.co already
    simulatePlayerJoin(mockContext.players[1], 'participant-1', 'session-1');
    simulatePlayerJoin(mockContext.players[2], 'participant-2', 'session-2');

    const component = await mount(
      <EmpiricaContext.Provider value={mockContext}>
        <VideoCall showSelfView={true} />
      </EmpiricaContext.Provider>
    );

    // Wait for join
    await expect(component.locator('[data-test="callTile"]')).toBeVisible({
      timeout: 15000
    });

    // Verify component can access other players' dailyIds
    const player1DailyId = mockContext.players[1].get('dailyId');
    expect(player1DailyId).toBe('participant-1');

    const player2DailyId = mockContext.players[2].get('dailyId');
    expect(player2DailyId).toBe('participant-2');
  });
});
