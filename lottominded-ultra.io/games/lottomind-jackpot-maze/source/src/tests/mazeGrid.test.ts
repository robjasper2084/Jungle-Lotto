import { describe, expect, it } from 'vitest';
import { chooseForgivingDirection, createMazeDefinition, MAZE_LEVEL_COUNT, shortestDirection, shouldSnapLateTurn, stepTile, validDirections, validateMaze } from '../game/MazeGrid';

describe('LottoMind grid maze', () => {
  const maze = createMazeDefinition();

  it('is a connected portrait maze with a center house and four power tiles', () => {
    expect(maze.height).toBeGreaterThan(maze.width);
    expect(maze.powerTiles).toHaveLength(4);
    expect(validateMaze(maze)).toEqual([]);
  });

  it('gives both heroes at least two clear exits on every map', () => {
    for (let level = 0; level < 10; level += 1) {
      const levelMaze = createMazeDefinition(level);
      expect(validDirections(levelMaze, levelMaze.playerSpawn).length).toBeGreaterThanOrEqual(2);
      expect(validDirections(levelMaze, levelMaze.player2Spawn).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('wraps through the side tunnel', () => {
    expect(stepTile(maze, { x: 0, y: maze.tunnelRow }, 'left')).toEqual({ x: maze.width - 1, y: maze.tunnelRow });
    expect(stepTile(maze, { x: maze.width - 1, y: maze.tunnelRow }, 'right')).toEqual({ x: 0, y: maze.tunnelRow });
  });

  it('keeps the lower center passage open on the Eastside map', () => {
    for (let y = 15; y <= 19; y += 1) expect(maze.rows[y][10]).not.toBe('#');
  });

  it('provides a valid pathfinding direction for custom villains', () => {
    expect(['up', 'down', 'left', 'right']).toContain(shortestDirection(maze, maze.house, maze.playerSpawn, 'none'));
  });

  it('spawns both co-op heroes on open neighboring road tiles', () => {
    expect(maze.rows[maze.playerSpawn.y][maze.playerSpawn.x]).not.toBe('#');
    expect(maze.rows[maze.player2Spawn.y][maze.player2Spawn.x]).not.toBe('#');
    expect(Math.abs(maze.playerSpawn.x - maze.player2Spawn.x) + Math.abs(maze.playerSpawn.y - maze.player2Spawn.y)).toBe(1);
  });

  it('waits when the chosen direction is blocked instead of steering for the player', () => {
    const tile = { x: 1, y: 1 };
    const direction = chooseForgivingDirection(maze, tile, 'left', 'none');
    expect(direction).toBeNull();
  });

  it('does not auto-move before the player chooses a direction', () => {
    expect(chooseForgivingDirection(maze, maze.playerSpawn, 'none', 'none')).toBeNull();
  });

  it('accepts a slightly late perpendicular corner turn without accepting a late reversal', () => {
    const junction = Array.from({ length: maze.height }, (_, y) =>
      Array.from({ length: maze.width }, (_, x) => ({ x, y }))
    ).flat().find(point => stepTile(maze, point, 'right') && stepTile(maze, point, 'up'));
    expect(junction).toBeDefined();
    expect(shouldSnapLateTurn(maze, junction!, 'up', 'right', 0.3)).toBe(true);
    expect(shouldSnapLateTurn(maze, junction!, 'up', 'right', 0.5)).toBe(true);
    expect(shouldSnapLateTurn(maze, junction!, 'up', 'right', 0.58)).toBe(false);
    expect(shouldSnapLateTurn(maze, junction!, 'left', 'right', 0.2)).toBe(false);
  });

  it('ships ten distinct, connected Detroit map layouts', () => {
    const levels = Array.from({ length: MAZE_LEVEL_COUNT }, (_, level) => createMazeDefinition(level));
    expect(levels).toHaveLength(10);
    expect(levels.flatMap((level, index) => validateMaze(level).map(issue => `Level ${index + 1}: ${issue}`))).toEqual([]);
    expect(new Set(levels.map(level => level.rows.join('|'))).size).toBe(10);
    expect(levels.map(level => validDirections(level, level.playerSpawn).length).every(exits => exits >= 2)).toBe(true);
  });
});
