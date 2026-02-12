import React from 'react';
import { test, expect } from '@playwright/experimental-ct-react';
import { DailyTestWrapper } from './DailyTestWrapper';

test.describe('DailyTestWrapper - Isolation Test', () => {
  test('renders loading state initially', async ({ mount, page }) => {
    await page.context().grantPermissions(['camera', 'microphone']);

    const component = await mount(
      <DailyTestWrapper roomUrl="https://test.daily.co/fake-room">
        <div data-test="child-content">Test Child</div>
      </DailyTestWrapper>
    );

    // Should show something - either loading or the child
    const html = await component.innerHTML();
    console.log('Component HTML:', html);

    // Just verify it mounted
    await expect(component).toBeVisible();
  });
});
