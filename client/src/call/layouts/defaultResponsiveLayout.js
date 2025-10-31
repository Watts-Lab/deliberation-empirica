const responsiveGrid = (numTiles, width, height, tileAspectRatio = 16 / 9) => {
  // Compute the optimal number of rows and columns for the grid
  // Based on the number of tiles and the aspect ratio of the container
  // We want to maximize the size of each tile while fitting all tiles in the container
  //
  // Tiles always have a fixed aspect ratio (e.g., 16:9)

  if (width === 0 || height === 0 || numTiles === 0) {
    return { rows: 0, cols: 0, tileWidth: 0, tileHeight: 0 };
  }

  let bestLayout = null;
  let bestTileArea = 0;

  for (let cols = 1; cols <= numTiles; cols++) {
    // Number of rows needed for this number of columns
    const rows = Math.ceil(numTiles / cols);

    // try fitting to width, see if height overflows
    let tileWidth = Math.floor(width / cols);
    let tileHeight = Math.floor(tileWidth / tileAspectRatio);

    if (tileHeight * rows > height) {
      // fitting to width overflows height, fit to height instead
      tileHeight = Math.floor(height / rows);
      tileWidth = Math.floor(tileHeight * tileAspectRatio);
    }

    const tileArea = tileWidth * tileHeight;
    if (tileArea > bestTileArea) {
      bestTileArea = tileArea;
      bestLayout = { rows, cols, tileWidth, tileHeight };
    }
  }

  return bestLayout;
};

export const defaultResponsiveLayout = ({
  positions,
  selfPosition,
  width,
  height,
  tileAspectRatio = 16 / 9,
}) => {
  /*
    Computes a default responsive layout for the given players and container size.
    Returns the portion of a layout object for the current player (selfPosition).
    
    The layout arranges all players in a grid that maximizes tile size
    while fitting within the container dimensions.
    
    Positions are assigned to tiles in random order to avoid systematic 
    differences in layout between positions.
    
    Parameters:
    - players: array of player objects to include in the layout. Filter out unwanted players before calling.
    - selfPosition: the position of the current player
    - width: container width in pixels
    - height: container height in pixels
    - tileAspectRatio: desired aspect ratio of each video tile (default 16:9)

    Returns:
    - layout object for the current player, including grid and feed definitions
    e.g.,
    {
      grid: { rows: 1, cols: 2},
      feeds: [
        {
          source: { type: "participant", position: "positionName" },
          media: { audio: true, video: true, screen: false },
          displayRegion: { rows: { first: 0, last: 0 }, cols: { first: 0, last: 0 } }
        },
        {
          source: { type: "self" },
          media: { audio: false, video: true, screen: false },
          displayRegion: { rows: { first: 0, last: 0 }, cols: { first: 1, last: 1 } }
        },
        ...
      ]
    }
  */

  const numTiles = positions.length;

  const grid = responsiveGrid(numTiles, width, height, tileAspectRatio);

  // map positions to grid regions
  const positionRegions = [];
  let positionIndex = 0;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (positionIndex < positions.length) {
        positionRegions.push({
          rows: { first: r, last: r },
          cols: { first: c, last: c },
        });
        positionIndex += 1;
      }
    }
  }

  const newLayout = {
    grid,
    feeds: positions.map((position, index) => ({
      source:
        position === selfPosition
          ? { type: "self" }
          : { type: "participant", position },
      media: { audio: position !== selfPosition, video: true },
      displayRegion: positionRegions[index],
    })),
  };

  console.log("Computed default responsive layout:", newLayout);

  return newLayout;
};
