// A picture of an enemy's generator: which squares will be enemy tiles (docs/enemies.md §2).

import { content } from '../../content';
import { generatorTotal, startingGrid, upcomingGrid } from '../../engine/combat';
import { Asset } from './common';

/** One 8-wide grid. Enemy cells show the tile's colour and icon; normal cells are dark. */
export function PatternGrid({ rows, cell = 14, label, boardFrom }: { rows: (string | null)[][]; cell?: number; label: string; boardFrom?: number }) {
  const enemies = rows.flat().filter(Boolean).length;
  return (
    <div className="pattern" role="img" aria-label={`${label}: ${enemies} enemy tiles`} style={{ gridTemplateColumns: `repeat(${rows[0]?.length ?? 8}, ${cell}px)`, gridAutoRows: `${cell}px` }}>
      {rows.flatMap((row, y) => row.map((id, x) => {
        const t = id ? content.enemyTiles[id] : null;
        return (
          <span key={`${x},${y}`} className={`${t ? 'p-enemy' : 'p-normal'} ${y === boardFrom ? 'p-board-top' : ''}`} style={t ? { background: t.color } : undefined}>
            {t && cell >= 12 && <Asset path={t.icon} alt={t.name} size={cell - 2} color="transparent" />}
          </span>
        );
      }))}
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
  const tileNames = [...new Set(content.enemies[enemyId].generator.flatMap((r) => (r === 'normal' ? [] : [content.enemyTiles[r.tile].name])))];
  return (
    <div className="pattern-preview">
      <PatternGrid rows={[...next, ...start]} cell={cell} label="Coming next and starting board" boardFrom={height} />
      <div className="pattern-totals">
        <b>{total}</b> {tileNames.join(', ')} in all
        <br /><span className="dim">{onBoard} on the board, {total - onBoard} to come</span>
        <br /><span className="dim" style={{ fontSize: 11 }}>Above the line: coming next.<br />Below: the starting board.</span>
      </div>
    </div>
  );
}
