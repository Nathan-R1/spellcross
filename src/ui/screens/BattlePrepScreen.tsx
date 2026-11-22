// Battle preparation (spec §5): fill every loadout slot, pick up to 2 junk tiles, then FIGHT.

import { useMemo, useState } from 'react';
import { content } from '../../content';
import { resolvedPlayerSpells, suggestedLoadout } from '../../engine/run';
import { resolveJunk } from '../../engine/spells';
import { useStore } from '../../state/store';
import { Asset, PlayerStats, TopBar, useLongPress } from '../components/common';
import { EnemyInfo } from './BattleScreen';
import { SpellDetails } from './SpellbookScreen';

export function BattlePrepScreen() {
  const run = useStore((s) => s.run)!;
  const startBattle = useStore((s) => s.startBattle);
  const prep = run.prep!;
  const spells = useMemo(() => resolvedPlayerSpells(run.player, content), [run.player]);
  const slots = Math.min(prep.slots, spells.length);
  // Preselect the spells used last battle (D26).
  const [loadout, setLoadout] = useState<string[]>(() => suggestedLoadout(run, slots));
  // Junk starts empty: the player opts in.
  const [junk, setJunk] = useState<string[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [enemyInfo, setEnemyInfo] = useState<string | null>(null);
  const encounter = content.encounters[prep.encounterId];

  const toggle = (ref: string) => {
    if (loadout.includes(ref)) setLoadout(loadout.filter((r) => r !== ref));
    else if (loadout.length < slots) setLoadout([...loadout, ref]);
  };
  const toggleJunk = (id: string) => {
    if (junk.includes(id)) setJunk(junk.filter((j) => j !== id));
    else if (junk.length < content.config.junkSlots) setJunk([...junk, id]);
  };
  const infoSpell = spells.find((s) => s.ref === info) ?? (info && content.spells[info] ? resolveJunk(content.spells[info]) : undefined);

  return (
    <div className="screen">
      <TopBar><PlayerStats /></TopBar>
      <div className="prep-body">
        <div className="prep-col panel" style={{ flex: 2, minWidth: 0 }}>
          <div className="banner">{prep.source === 'boss' ? 'The Harbinger' : encounter.tier === 'elite' ? 'A dangerous foe!' : 'Enemy Encounter!'}</div>
          <div className="dim" style={{ fontSize: 13 }}>
            Choose {slots} spells ({loadout.length}/{slots}). Hold any tile for details.
          </div>
          <div className="spell-grid">
            {spells.map((s) => (
              <SpellCard key={s.ref} spell={s} selected={loadout.includes(s.ref)} onTap={() => toggle(s.ref)} onLong={() => setInfo(s.ref)} />
            ))}
          </div>
        </div>
        <div className="prep-col panel" style={{ flex: 1, minWidth: 0 }}>
          <b>Enemies</b>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {encounter.enemies.map((id, i) => <EnemyCard key={i} id={id} onLong={() => setEnemyInfo(id)} />)}
          </div>
          <b>Junk ({junk.length}/{content.config.junkSlots})</b>
          <div style={{ display: 'flex', gap: 6 }}>
            {run.player.junkPool.map((id) => (
              <JunkCard key={id} id={id} selected={junk.includes(id)} onTap={() => toggleJunk(id)} onLong={() => setInfo(id)} />
            ))}
          </div>
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn primary big" disabled={loadout.length !== slots} onClick={() => startBattle(loadout, junk)}>FIGHT!</button>
        </div>
      </div>
      {infoSpell && <SpellDetails spell={infoSpell} onClose={() => setInfo(null)} />}
      {enemyInfo && <EnemyInfo defId={enemyInfo} onClose={() => setEnemyInfo(null)} />}
    </div>
  );
}

function EnemyCard({ id, onLong }: { id: string; onLong: () => void }) {
  const press = useLongPress(() => {}, onLong);
  const def = content.enemies[id];
  return (
    <div style={{ textAlign: 'center', fontSize: 12, width: 56 }} role="button" aria-label={`${def.name}: hold for details`} {...press}>
      <Asset path={def.portrait} alt={def.name} size={44} color="#5a2a2a" />
      <div>{def.name}</div>
    </div>
  );
}

function JunkCard({ id, selected, onTap, onLong }: { id: string; selected: boolean; onTap: () => void; onLong: () => void }) {
  const press = useLongPress(onTap, onLong);
  const def = content.spells[id];
  return (
    <button className={`spell-card ${selected ? 'selected' : ''}`} style={{ width: 64 }} aria-pressed={selected} {...press}>
      <Asset path={def.icon} alt={def.name} size={32} />
      <span>{def.name}</span>
    </button>
  );
}

export function SpellCard({ spell, selected, onTap, onLong }: { spell: ReturnType<typeof resolvedPlayerSpells>[number]; selected?: boolean; onTap: () => void; onLong: () => void }) {
  const press = useLongPress(onTap, onLong);
  return (
    <button className={`spell-card ${selected ? 'selected' : ''}`} style={{ background: spell.color + '33' }} {...press}>
      <span className="lvl">Lv{spell.level}</span>
      <Asset path={spell.icon} alt={spell.name} size={36} color={spell.color} />
      <span>{spell.name}</span>
      <span className="dim" style={{ fontSize: 11 }}>{statLine(spell)}</span>
    </button>
  );
}

export function statLine(s: { damage: number; healing: number; chaos: number; statuses: { status: string; value: number; perTile: boolean; self: boolean }[] }) {
  const parts: string[] = [];
  if (s.damage) parts.push(`⚔${s.damage}`);
  if (s.healing) parts.push(`♥${s.healing}`);
  if (s.chaos) parts.push(`?${s.chaos}`);
  for (const st of s.statuses) {
    const name = content.statuses[st.status]?.name ?? st.status;
    parts.push(`${name} ${st.value}${st.perTile ? '' : '*'}`);
  }
  return parts.join(' · ');
}
