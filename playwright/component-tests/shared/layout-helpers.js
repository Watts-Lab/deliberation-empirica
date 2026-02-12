/**
 * Helper functions for layout assertions in component tests.
 *
 * These utilities verify visual layout properties like positioning,
 * overlap detection, and space utilization.
 */

/**
 * Check if two bounding boxes overlap
 */
export function boundingBoxesOverlap(box1, box2) {
  // Boxes don't overlap if one is completely to the left/right/above/below the other
  return !(
    box1.x + box1.width <= box2.x || // box1 is left of box2
    box2.x + box2.width <= box1.x || // box2 is left of box1
    box1.y + box1.height <= box2.y || // box1 is above box2
    box2.y + box2.height <= box1.y // box2 is above box1
  );
}

/**
 * Verify that no tiles overlap (for non-PiP layouts)
 *
 * @param {import('@playwright/test').Locator} component - The component locator
 * @param {import('@playwright/test').expect} expect - Playwright expect
 */
export async function assertNoTileOverlap(component, expect) {
  const tiles = component.locator('[data-test="callTile"]');
  const count = await tiles.count();

  // Get bounding boxes for all tiles
  const boxes = [];
  for (let i = 0; i < count; i++) {
    const box = await tiles.nth(i).boundingBox();
    boxes.push({ index: i, box });
  }

  // Check each pair of tiles for overlap
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const overlaps = boundingBoxesOverlap(boxes[i].box, boxes[j].box);
      expect(overlaps, `Tile ${i} and Tile ${j} should not overlap`).toBe(false);
    }
  }
}

/**
 * Verify that tiles efficiently fill the container space
 *
 * Either all tiles in a row should sum to container width,
 * or all tiles in a column should sum to container height.
 *
 * @param {import('@playwright/test').Locator} component - The component locator
 * @param {import('@playwright/test').expect} expect - Playwright expect
 * @param {number} tolerance - Allowed difference in pixels (for margins/gaps)
 */
export async function assertSpaceFilling(component, expect, tolerance = 20) {
  const container = component.locator('.flex.h-full.w-full').first();
  const containerBox = await container.boundingBox();

  const tiles = component.locator('[data-test="callTile"]');
  const count = await tiles.count();

  if (count === 0) return; // No tiles to check

  // Get all tile bounding boxes with positions
  const tileBoxes = [];
  for (let i = 0; i < count; i++) {
    const box = await tiles.nth(i).boundingBox();
    tileBoxes.push(box);
  }

  // Group tiles by row (tiles with similar Y coordinates)
  const rows = [];
  const rowTolerance = 10; // Pixels of Y difference to be considered same row

  for (const box of tileBoxes) {
    let foundRow = false;
    for (const row of rows) {
      // Check if this tile is in an existing row (similar Y coordinate)
      if (Math.abs(row[0].y - box.y) < rowTolerance) {
        row.push(box);
        foundRow = true;
        break;
      }
    }
    if (!foundRow) {
      rows.push([box]);
    }
  }

  // Check if any row fills the container width
  let hasFullWidthRow = false;
  for (const row of rows) {
    const totalWidth = row.reduce((sum, box) => sum + box.width, 0);
    if (Math.abs(totalWidth - containerBox.width) <= tolerance) {
      hasFullWidthRow = true;
      break;
    }
  }

  // Group tiles by column (tiles with similar X coordinates)
  const columns = [];
  const colTolerance = 10;

  for (const box of tileBoxes) {
    let foundCol = false;
    for (const col of columns) {
      if (Math.abs(col[0].x - box.x) < colTolerance) {
        col.push(box);
        foundCol = true;
        break;
      }
    }
    if (!foundCol) {
      columns.push([box]);
    }
  }

  // Check if any column fills the container height
  let hasFullHeightColumn = false;
  for (const col of columns) {
    const totalHeight = col.reduce((sum, box) => sum + box.height, 0);
    if (Math.abs(totalHeight - containerBox.height) <= tolerance) {
      hasFullHeightColumn = true;
      break;
    }
  }

  // At least one dimension should be fully utilized
  expect(
    hasFullWidthRow || hasFullHeightColumn,
    'Layout should fill either container width (horizontal layout) or height (vertical layout)'
  ).toBe(true);
}

/**
 * Get z-index value for an element's parent
 *
 * The z-index is set on the wrapper div that contains the Tile,
 * not on the Tile itself. This function checks the parent element.
 *
 * @param {import('@playwright/test').Locator} locator - Element locator (Tile)
 * @returns {Promise<string>} z-index value from parent element
 */
export async function getZIndex(locator) {
  return await locator.evaluate((el) => window.getComputedStyle(el.parentElement).zIndex);
}

/**
 * Verify that one element is visually on top of another (higher z-index)
 *
 * @param {import('@playwright/test').Locator} topLocator - Element that should be on top
 * @param {import('@playwright/test').Locator} bottomLocator - Element that should be below
 * @param {import('@playwright/test').expect} expect - Playwright expect
 */
export async function assertZIndexOrder(topLocator, bottomLocator, expect) {
  const topZ = await getZIndex(topLocator);
  const bottomZ = await getZIndex(bottomLocator);

  // Convert to numbers for comparison (handle 'auto' as 0)
  const topZNum = topZ === 'auto' ? 0 : parseInt(topZ, 10);
  const bottomZNum = bottomZ === 'auto' ? 0 : parseInt(bottomZ, 10);

  expect(topZNum, 'Top element should have higher z-index').toBeGreaterThan(bottomZNum);
}

/**
 * Detect layout orientation (horizontal vs vertical)
 *
 * Returns 'horizontal' if tiles are arranged in rows,
 * 'vertical' if tiles are stacked in columns.
 *
 * @param {import('@playwright/test').Locator} component - The component locator
 * @returns {Promise<'horizontal' | 'vertical' | 'grid'>}
 */
export async function detectLayoutOrientation(component) {
  const tiles = component.locator('[data-test="callTile"]');
  const count = await tiles.count();

  if (count <= 1) return 'single';

  // Get positions of first two tiles
  const box1 = await tiles.nth(0).boundingBox();
  const box2 = await tiles.nth(1).boundingBox();

  const horizontalDistance = Math.abs(box1.x - box2.x);
  const verticalDistance = Math.abs(box1.y - box2.y);

  // If tiles are side-by-side (horizontal distance > vertical)
  if (horizontalDistance > verticalDistance) {
    return 'horizontal';
  }

  // If tiles are stacked (vertical distance > horizontal)
  if (verticalDistance > horizontalDistance) {
    return 'vertical';
  }

  // If similar distance in both directions, probably a grid
  return 'grid';
}
