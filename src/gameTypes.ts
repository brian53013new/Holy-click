export type WeaponElement = 'physical' | 'flame' | 'frost' | 'storm' | 'void';
export type WeaponRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface GameWeapon {
  id: string;
  name: string;
  rarity: WeaponRarity;
  element: WeaponElement;
  basePower: number;
  forgeLevel: number;
  acquiredAt: number;
}

export interface Materials {
  iron: number;
  crystal: number;
  essence: number;
}

export interface Blessing {
  id: string;
  name: string;
  description: string;
  attack: number;
  maxHp: number;
  armor: number;
}
