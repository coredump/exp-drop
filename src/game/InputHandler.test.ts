import { describe, it, expect, beforeEach } from 'vitest';
import { InputHandler, columnActionAt, TouchZone } from './InputHandler';
import { CELL_SIZE, GRID_WIDTH, GRID_HEIGHT, TILE_SIZE } from '../utils/constants';

// A board drawn at (100, 200) with the active tile parked at grid column 4.
const BOARD_X = 100;
const BOARD_Y = 200;
const TILE_GRID_X = 4;

const ZONE: TouchZone = {
  tileScreenX: BOARD_X + TILE_GRID_X * CELL_SIZE, // 228
  tileScreenY: BOARD_Y,
  tileWidth: TILE_SIZE * CELL_SIZE, // 64
  tileHeight: TILE_SIZE * CELL_SIZE,
  boardScreenX: BOARD_X,
  boardScreenY: BOARD_Y,
  boardScreenWidth: GRID_WIDTH * CELL_SIZE, // 320
  boardScreenHeight: GRID_HEIGHT * CELL_SIZE,
};

/** Screen X at the centre of a given grid column. */
const xAtColumn = (gridX: number): number => BOARD_X + gridX * CELL_SIZE + CELL_SIZE / 2;

describe('InputHandler.getTouchZoneAction()', () => {
  let handler: InputHandler;

  beforeEach(() => {
    handler = new InputHandler();
    handler.setTouchZone(ZONE);
  });

  it('should return null when no touch zone is set', () => {
    handler.setTouchZone(null);
    expect(handler.getTouchZoneAction(xAtColumn(4), BOARD_Y + 10)).toBeNull();
  });

  it('should hard drop when tapping on the tile', () => {
    const onTile = handler.getTouchZoneAction(ZONE.tileScreenX + 10, ZONE.tileScreenY + 10);
    expect(onTile).toBe('hardDrop');
  });

  it('should hard drop when tapping below the tile inside the board', () => {
    const below = handler.getTouchZoneAction(
      ZONE.tileScreenX + 10,
      ZONE.tileScreenY + ZONE.tileHeight + 40
    );
    expect(below).toBe('hardDrop');
  });

  it('should ignore a tap in the tile column but below the board', () => {
    const belowBoard = handler.getTouchZoneAction(
      ZONE.tileScreenX + 10,
      BOARD_Y + ZONE.boardScreenHeight + 20
    );
    expect(belowBoard).toBeNull();
  });

  it('should drop to a snapped column when tapping left of the tile on the board', () => {
    // Grid column 1 snaps down to the TILE_SIZE-aligned column 0
    expect(handler.getTouchZoneAction(xAtColumn(1), BOARD_Y + 10)).toEqual({
      type: 'dropToColumn',
      column: 0,
    });
  });

  it('should drop to a snapped column when tapping right of the tile on the board', () => {
    // Grid column 7 snaps down to column 6
    expect(handler.getTouchZoneAction(xAtColumn(7), BOARD_Y + 10)).toEqual({
      type: 'dropToColumn',
      column: 6,
    });
  });

  it('should nudge left when tapping outside the board on the left', () => {
    expect(handler.getTouchZoneAction(BOARD_X - 50, BOARD_Y + 10)).toBe('left');
  });

  it('should nudge right when tapping outside the board on the right', () => {
    const rightOfBoard = BOARD_X + ZONE.boardScreenWidth + 50;
    expect(handler.getTouchZoneAction(rightOfBoard, BOARD_Y + 10)).toBe('right');
  });

  it('should never emit a soft drop action', () => {
    // Soft drop was removed; tapping the tile must hard drop instead.
    const actions = [
      handler.getTouchZoneAction(ZONE.tileScreenX + 1, ZONE.tileScreenY + 1),
      handler.getTouchZoneAction(ZONE.tileScreenX + ZONE.tileWidth, ZONE.tileScreenY),
    ];
    expect(actions).toEqual(['hardDrop', 'hardDrop']);
  });
});

describe('columnActionAt()', () => {
  const width = GRID_WIDTH * CELL_SIZE;

  it('should snap odd grid columns down to the TILE_SIZE grid', () => {
    expect(columnActionAt(xAtColumn(0), BOARD_X, width)).toEqual({
      type: 'dropToColumn',
      column: 0,
    });
    expect(columnActionAt(xAtColumn(3), BOARD_X, width)).toEqual({
      type: 'dropToColumn',
      column: 2,
    });
    expect(columnActionAt(xAtColumn(9), BOARD_X, width)).toEqual({
      type: 'dropToColumn',
      column: 8,
    });
  });

  it('should always return an even column so dropToColumn can terminate', () => {
    for (let gridX = 0; gridX < GRID_WIDTH; gridX++) {
      const action = columnActionAt(xAtColumn(gridX), BOARD_X, width);
      const column = (action as { column: number }).column;
      expect(column % TILE_SIZE).toBe(0);
      expect(column).toBeLessThanOrEqual(GRID_WIDTH - TILE_SIZE);
    }
  });
});
