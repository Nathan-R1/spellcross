// Battle preparation (combat § 2.1): see the enemy and choose 3 of your tools. Used by runs and quick fights.

import { useState } from 'react';
import { content } from '../../content';
import { PILLAR_NAME } from '../../content/tools';
import { suggestedLoadout } from '../../engine/run';
import type { ToolInstance } from '../../engine/types';
import { useStore } from '../../state/store';
import { AbilityBar, Asset, FruitIcon, Modal, PlayerStats, TopBar, useLongPress } from '../components/common';
import { EnemyPatternPreview } from '../components/EnemyPattern';

export function BattlePrepScreen() {
  const run = useStore((s) => s.run);
  const quick = useStore((s) => s.quick);
  const startBattle = useStore((s) => s.startBattle);
  const player = quick?.player ?? run!.player;
  const enemyId = quick?.enemyId ?? run!.prep!.enemyId;
  const boss = run?.prep?.source === 'boss';
  const size = Math.min(content.config.loadoutSize, player.tools.length);
  const [loadout, setLoadout] = useState<string[]>(() => suggestedLoadout(player, quick?.lastLoadout ?? run?.lastLoadout, size));
  const [info, setInfo] = useState<ToolInstance | null>(null);
  const enemy = content.enemies[enemyId];

  const toggle = (uid: string) => {
    if (loadout.includes(uid)) setLoadout(loadout.filter((u) => u !== uid));
    else if (loadout.length < size) setLoadout([...loadout, uid]);
  };

  return (
    <div className="screen">
      <TopBar>
        {!quick && <PlayerStats />}
        <span className="spacer" />
        {!quick && <AbilityBar />}
      </TopBar>
      <div className="prep-body">
        <div className="panel prep-enemy">
          <div className="banner">{boss ? 'The final battle' : enemy.tier === 'elite' ? 'A dangerous foe!' : 'Enemy Encounter!'}</div>
          <div className="row">
            <Asset path={enemy.portrait} alt={enemy.name} size={48} color="#5a2a2a" />
            <h2 style={{ margin: 0 }}>{enemy.name}</h2>
          </div>
          <EnemyPatternPreview enemyId={enemyId} cell={13} />
        </div>
        <div className="panel prep-col">
          <b>Choose {size} tools ({loadout.length}/{size}). Hold one for details.</b>
          <div className="tool-grid">
            {player.tools.map((t) => (
              <ToolCard key={t.uid} tool={t} selected={loadout.includes(t.uid)} onTap={() => toggle(t.uid)} onLong={() => setInfo(t)} />
            ))}
          </div>
        </div>
        <button className="btn primary big" disabled={loadout.length !== size} onClick={() => startBattle(loadout)}>FIGHT!</button>
      </div>
      {info && <ToolInfo tool={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

export function ToolCard({ tool, selected, onTap, onLong }: { tool: ToolInstance; selected?: boolean; onTap: () => void; onLong: () => void }) {
  const def = content.tools[tool.toolId];
  const press = useLongPress(onTap, onLong);
  return (
    <button className={`tool-card ${selected ? 'selected' : ''}`} style={{ background: def.color + '33' }} aria-pressed={!!selected} {...press}>
      <span className="lvl">Lv{tool.level}</span>
      <Asset path={def.icon} alt={def.name} size={36} color={def.color} />
      <span>{def.name}</span>
      <span className="dim" style={{ fontSize: 11 }}>{PILLAR_NAME[tool.pillar]}</span>
      <span className="fruit-row">{tool.sockets.map((f, i) => (f ? <FruitIcon key={i} fruit={f} size={14} /> : <i key={i} className="socket" />))}</span>
    </button>
  );
}

export function ToolInfo({ tool, onClose }: { tool: ToolInstance; onClose: () => void }) {
  const def = content.tools[tool.toolId];
  const fruits = tool.sockets.filter((f): f is NonNullable<typeof f> => !!f);
  return (
    <Modal onClose={onClose}>
      <div className="row">
        <Asset path={def.icon} alt={def.name} size={56} color={def.color} />
        <div>
          <h2>{def.name} <span className="dim" style={{ fontSize: 15 }}>Lv {tool.level} · {PILLAR_NAME[tool.pillar]}</span></h2>
          <div>{def.description}</div>
          {fruits.length > 0 && (
            <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
              {fruits.map((f, i) => <li key={i}><b>{content.fruits[f].name}</b> ({content.fruits[f].keyword}): {content.fruits[f].description}</li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="actions"><button className="btn" onClick={onClose}>OK</button></div>
    </Modal>
  );
}
