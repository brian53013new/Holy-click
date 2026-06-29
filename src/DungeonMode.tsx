import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, DoorOpen, Heart, Shield, Skull, Sparkles, Swords } from 'lucide-react';
import type { Blessing, GameWeapon, Materials } from './gameTypes';

type Position = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';

interface DungeonModeProps {
  weapon: GameWeapon;
  permanentBonus: number;
  language: 'en' | 'zh-TW';
  onExit: (blessings: number, materials: Materials, bestFloor: number) => void;
}

const SIZE = 9;
const BLESSINGS: Blessing[] = [
  { id: 'rage', name: 'Crimson Rage', description: '+35% attack this run', attack: 0.35, maxHp: 0, armor: 0 },
  { id: 'heart', name: 'Titan Heart', description: '+40 maximum HP this run', attack: 0, maxHp: 40, armor: 0 },
  { id: 'shell', name: 'Mirror Shell', description: '+3 armor this run', attack: 0, maxHp: 0, armor: 3 },
  { id: 'echo', name: 'Echo Edge', description: '+20% attack and +1 armor', attack: 0.2, maxHp: 0, armor: 1 },
  { id: 'blood', name: 'Blood Pact', description: '+55% attack, -15 maximum HP', attack: 0.55, maxHp: -15, armor: 0 },
];

function distance(a: Position, b: Position) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function optionsForFloor(floor: number) {
  return [0, 1, 2].map(offset => BLESSINGS[(floor + offset * 2) % BLESSINGS.length]);
}

export default function DungeonMode({ weapon, permanentBonus, language, onExit }: DungeonModeProps) {
  const [floor, setFloor] = useState(1);
  const [player, setPlayer] = useState<Position>({ x: 1, y: 7 });
  const [enemy, setEnemy] = useState<Position>({ x: 7, y: 1 });
  const [stairs, setStairs] = useState<Position | null>(null);
  const [blessings, setBlessings] = useState<Blessing[]>([]);
  const [choosingBlessing, setChoosingBlessing] = useState(false);
  const [materials, setMaterials] = useState<Materials>({ iron: 0, crystal: 0, essence: 0 });
  const blessingStats = useMemo(() => blessings.reduce((sum, item) => ({
    attack: sum.attack + item.attack,
    maxHp: sum.maxHp + item.maxHp,
    armor: sum.armor + item.armor,
  }), { attack: 0, maxHp: 0, armor: 0 }), [blessings]);
  const maxHp = Math.max(30, 100 + blessingStats.maxHp);
  const [hp, setHp] = useState(100);
  const enemyMaxHp = Math.floor(35 * Math.pow(1.62, floor - 1));
  const [enemyHp, setEnemyHp] = useState(enemyMaxHp);
  const attack = Math.max(2, Math.floor((weapon.basePower + weapon.forgeLevel * 4) * (1 + blessingStats.attack + permanentBonus)));
  const armor = blessingStats.armor + Math.floor(weapon.forgeLevel / 3);
  const text = language === 'zh-TW'
    ? { title: '裂隙地牢', floor: '樓層', exit: '撤離', hp: '生命', enemy: '敵人', blessing: '選擇一項祝福', fallen: '你倒下了', return: '帶著殘存力量返回', stairs: '出口已出現' }
    : { title: 'Rift Dungeon', floor: 'Floor', exit: 'Extract', hp: 'HP', enemy: 'Enemy', blessing: 'Choose one blessing', fallen: 'You have fallen', return: 'Return with what remains', stairs: 'The stairs have appeared' };

  const resetFloor = (nextFloor: number) => {
    setFloor(nextFloor);
    setPlayer({ x: 1, y: 7 });
    setEnemy({ x: 7, y: 1 });
    setStairs(null);
    setEnemyHp(Math.floor(35 * Math.pow(1.62, nextFloor - 1)));
  };

  const move = (direction: Direction) => {
    if (hp <= 0 || choosingBlessing) return;
    const delta = direction === 'up' ? { x: 0, y: -1 } : direction === 'down' ? { x: 0, y: 1 } : direction === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
    const target = { x: Math.max(0, Math.min(SIZE - 1, player.x + delta.x)), y: Math.max(0, Math.min(SIZE - 1, player.y + delta.y)) };
    if (stairs && target.x === stairs.x && target.y === stairs.y) {
      setChoosingBlessing(true);
      return;
    }
    if (target.x === enemy.x && target.y === enemy.y && enemyHp > 0) {
      const nextHp = enemyHp - attack;
      setEnemyHp(nextHp);
      if (nextHp <= 0) {
        setStairs({ ...enemy });
        setMaterials(current => ({
          iron: current.iron + Math.max(1, Math.ceil(floor / 2)),
          crystal: current.crystal + (floor % 3 === 0 ? 1 : 0),
          essence: current.essence + (floor % 5 === 0 ? 1 : 0),
        }));
        return;
      }
    } else {
      setPlayer(target);
    }

    if (enemyHp > 0) {
      let nextEnemy = enemy;
      if (distance(enemy, target) > 1) {
        const dx = target.x === enemy.x ? 0 : target.x > enemy.x ? 1 : -1;
        const dy = target.y === enemy.y ? 0 : target.y > enemy.y ? 1 : -1;
        const preferHorizontal = Math.abs(target.x - enemy.x) >= Math.abs(target.y - enemy.y);
        nextEnemy = preferHorizontal ? { x: enemy.x + dx, y: enemy.y } : { x: enemy.x, y: enemy.y + dy };
        if (nextEnemy.x === target.x && nextEnemy.y === target.y) nextEnemy = enemy;
        setEnemy(nextEnemy);
      }
      if (distance(nextEnemy, target) <= 1) {
        const damage = Math.max(1, Math.floor(5 * Math.pow(1.48, floor - 1)) - armor);
        setHp(value => Math.max(0, value - damage));
      }
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, Direction | undefined> = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
      const direction = map[event.key];
      if (direction) {
        event.preventDefault();
        move(direction);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const chooseBlessing = (blessing: Blessing) => {
    setBlessings(current => [...current, blessing]);
    setHp(value => Math.min(maxHp + blessing.maxHp, value + Math.max(0, blessing.maxHp)));
    setChoosingBlessing(false);
    resetFloor(floor + 1);
  };

  return (
    <div className="min-h-screen bg-[#090b12] p-4 text-slate-100 md:p-8">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 border-b border-violet-400/20 pb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300">{text.title}</p>
          <h1 className="mt-2 font-pixel text-xl">{text.floor} {floor}</h1>
        </div>
        <div className="flex gap-5 text-xs">
          <span><Heart className="inline h-4 w-4 text-red-400" /> {text.hp} {hp}/{maxHp}</span>
          <span><Swords className="inline h-4 w-4 text-cyan-300" /> {attack}</span>
          <span><Shield className="inline h-4 w-4 text-blue-300" /> {armor}</span>
        </div>
        <button onClick={() => onExit(blessings.length, materials, floor)} className="border border-amber-300/40 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-200">
          <DoorOpen className="mr-2 inline h-4 w-4" /> {text.exit}
        </button>
      </header>

      <main className="mx-auto mt-8 grid max-w-5xl gap-8 lg:grid-cols-[1fr_260px]">
        <section>
          <div className="mx-auto grid aspect-square max-w-[650px] grid-cols-9 border border-violet-400/30 bg-slate-950 shadow-[0_0_70px_rgba(109,40,217,0.18)]">
            {Array.from({ length: SIZE * SIZE }).map((_, index) => {
              const x = index % SIZE;
              const y = Math.floor(index / SIZE);
              const isPlayer = player.x === x && player.y === y;
              const isEnemy = enemyHp > 0 && enemy.x === x && enemy.y === y;
              const isStairs = stairs?.x === x && stairs?.y === y;
              const wall = (x * 7 + y * 11 + floor) % 13 === 0 && !isPlayer && !isEnemy && !isStairs;
              return (
                <div key={index} className={`relative grid place-items-center border border-slate-800/80 ${wall ? 'bg-slate-800' : (x + y) % 2 ? 'bg-slate-900' : 'bg-[#101522]'}`}>
                  {isPlayer && <div className="h-2/3 w-2/3 animate-pulse bg-cyan-300 shadow-[0_0_15px_#67e8f9]" title="Player" />}
                  {isEnemy && <Skull className="h-2/3 w-2/3 text-fuchsia-400 drop-shadow-[0_0_8px_#e879f9]" />}
                  {isStairs && <Sparkles className="h-2/3 w-2/3 animate-pulse text-amber-300" />}
                </div>
              );
            })}
          </div>
          <div className="mx-auto mt-5 grid w-40 grid-cols-3 gap-2">
            <span />
            <button aria-label="Move up" onClick={() => move('up')} className="grid h-12 place-items-center border border-slate-700 bg-slate-900"><ArrowUp /></button>
            <span />
            <button aria-label="Move left" onClick={() => move('left')} className="grid h-12 place-items-center border border-slate-700 bg-slate-900"><ArrowLeft /></button>
            <button aria-label="Move down" onClick={() => move('down')} className="grid h-12 place-items-center border border-slate-700 bg-slate-900"><ArrowDown /></button>
            <button aria-label="Move right" onClick={() => move('right')} className="grid h-12 place-items-center border border-slate-700 bg-slate-900"><ArrowRight /></button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="border border-fuchsia-400/25 bg-fuchsia-500/5 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-300">{text.enemy}</p>
            <p className="mt-2 font-pixel text-sm">Rift Beast {floor}</p>
            <div className="mt-4 h-3 bg-slate-800"><div className="h-full bg-fuchsia-500" style={{ width: `${Math.max(0, enemyHp / enemyMaxHp) * 100}%` }} /></div>
            <p className="mt-2 text-xs">{Math.max(0, enemyHp)} / {enemyMaxHp}</p>
            {stairs && <p className="mt-4 text-xs font-bold text-amber-300">{text.stairs}</p>}
          </div>
          <div className="border border-cyan-400/20 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Run Blessings ({blessings.length})</p>
            <div className="mt-3 space-y-2 text-xs">{blessings.map((item, index) => <p key={`${item.id}-${index}`}>{item.name}</p>)}</div>
          </div>
          <div className="border border-amber-400/20 p-4 text-xs">
            Iron {materials.iron} · Crystal {materials.crystal} · Essence {materials.essence}
          </div>
        </aside>
      </main>

      {(choosingBlessing || hp <= 0) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur">
          <div className="w-full max-w-3xl border border-violet-400/40 bg-[#111522] p-6">
            <h2 className="font-pixel text-lg">{hp <= 0 ? text.fallen : text.blessing}</h2>
            {hp <= 0 ? (
              <button onClick={() => onExit(blessings.length, materials, floor)} className="mt-6 border border-red-400/40 px-5 py-3 text-sm font-bold uppercase text-red-200">{text.return}</button>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {optionsForFloor(floor).map(item => (
                  <button key={item.id} onClick={() => chooseBlessing(item)} className="border border-violet-400/30 bg-violet-500/5 p-5 text-left transition hover:bg-violet-500/15">
                    <Sparkles className="h-5 w-5 text-violet-300" />
                    <p className="mt-4 font-bold">{item.name}</p>
                    <p className="mt-2 text-xs opacity-60">{item.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
