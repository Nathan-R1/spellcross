// A picture of an enemy's generator: which squares will be enemy tiles (docs/enemies.md §2).

import { content } from '../../content';
import { generatorTotal, startingGrid, upcomingGrid } from '../../engine/combat';
import { Asset } from './common';

/** One 8-wide grid. Enemy cells show the tile's colour and icon; normal cells are dark. */
export function PatternGrid({ rows, cell = 14, label }: { rows: (string | null)[][]; cell?: number; label: string }) {
  const enemies = rows.flat().filter(Boolean).length;
  return (
    <div className="pattern" role="img" aria-label={`${label}: ${enemies} enemy tiles`} style={{ gridTemplateColumns: `repeat(${rows[0]?.length ?? 8}, ${cell}px)`, gridAutoRows: `${cell}px` }}>
      {rows.flatMap((row, y) => row.map((id, x) => {
        const t = id ? content.enemyTiles[id] : null;
        return (
          <span key={`${x},${y}`} className={t ? 'p-enemy' : 'p-normal'} style={t ? { background: t.color } : undefined}>
            {t && cell >= 12 && <Asset path={t.icon} alt={t.name} size={cell - 2} color="transparent" />}
          </span>
        );
      }))}
    </div>
  );
}

/** Before the battle: the starting board and the next 8 rows above it, with totals. */
export function EnemyPatternPreview({ enemyId, cell = 12 }: { enemyId: string; cell?: number }) {
  const { width, height } = content.config.board;
  const start = startingGrid(content, enemyId);
  const next = upcomingGrid(content, enemyId, Array.from({ length: width }, () => height));
  const total = generatorTotal(content, enemyId);
  const onBoard = start.flat().filter(Boolean).length;
  const tileNames = [...new Set(content.enemies[enemyId].generator.flatMap((r) => (r === 'normal' ? [] : [content.enemyTiles[r.tile].name])))];
  return (
    <div className="pattern-preview">
      <div><div className="dim pattern-cap">Coming next</div><PatternGrid rows={next} cell={cell} label="Coming next" /></div>
      <div><div className="dim pattern-cap">Starting board</div><PatternGrid rows={start} cell={cell} label="Starting board" /></div>
      <div className="pattern-totals">
        <b>{total}</b> {tileNames.join(', ')} in all
        <br /><span className="dim">{onBoard} on the board, {total - onBoard} to come</span>
      </div>
    </div>
  );
}
