// A picture of an enemy's generator: which squares will be enemy tiles (docs/enemies.md §2).

import { content } from '../../content';
import { genCell } from '../../content/enemies';
import { generatorTotal, startingGrid, upcomingGrid } from '../../engine/combat';
import { Asset } from './common';

/** One 8-wide grid. Enemy cells show the tile's colour and icon; normal cells are dark. */
export function PatternGrid({ rows, cell = 14, label, boardFrom }: { rows: (string | null)[][]; cell?: number; label: string; boardFrom?: number }) {
  const enemies = rows.flat().filter(Boolean).length;
  const cols = rows[0]?.length ?? 8;
  // The board's top edge is its own thin grid row, so every tile row keeps the same height.
  const split = boardFrom !== undefined && boardFrom > 0 && boardFrom < rows.length;
  const templateRows = split ? `repeat(${boardFrom}, ${cell}px) 2px repeat(${rows.length - boardFrom!}, ${cell}px)` : `repeat(${rows.length}, ${cell}px)`;
  const cells = rows.map((row, y) => row.map((id, x) => {
    const t = id ? content.enemyTiles[id] : null;
    return (
      <span key={`${x},${y}`} className={t ? 'p-enemy' : 'p-normal'} style={t ? { background: t.color } : undefined}>
        {t && cell >= 12 && <Asset path={t.icon} alt={t.name} size={cell - 2} color="transparent" />}
      </span>
    );
  }));
  return (
    <div className="pattern" role="img" aria-label={`${label}: ${enemies} enemy tiles`} style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gridTemplateRows: templateRows }}>
      {split ? [...cells.slice(0, boardFrom).flat(), <i key="board-top" className="p-board-line" />, ...cells.slice(boardFrom).flat()] : cells.flat()}
    </div>
  );
}

/**
 * Before the battle: one 16×8 picture. The top 8 rows are what's coming (nearest just above the line), the bottom
 * 8 are the starting board. Totals beside it.
 */
export function EnemyPatternPreview({ enemyId, cell = 8 }: { enemyId: string; cell?: number }) {
  const { width, height } = content.config.board;
  const start = startingGrid(content, enemyId);
  const next = upcomingGrid(content, enemyId, Array.from({ length: width }, () => height));
  const total = generatorTotal(content, enemyId);
  const onBoard = start.flat().filter(Boolean).length;
  const counts = new Map<string, number>();
  for (const r of content.enemies[enemyId].generator) for (let x = 0; x < width; x++) {
    const id = genCell(r, x);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const tileNames = [...counts].map(([id, n]) => `${n} ${content.enemyTiles[id].name}`);
  return (
    <div className="pattern-preview">
      <PatternGrid rows={[...next, ...start]} cell={cell} label="Coming next and starting board" boardFrom={height} />
      <div className="pattern-totals">
        <b>{total}</b> in all: {tileNames.join(', ')}
        <br /><span className="dim">{onBoard} on the board, {total - onBoard} to come</span>
        <br /><span className="dim pattern-note">Above the line: coming next.<br />Below: the starting board.</span>
      </div>
    </div>
  );
}
