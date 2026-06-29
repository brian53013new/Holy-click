import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Sun, Trophy, Zap, Skull, Target, Flame, ChevronsUp, LogIn, LogOut, Maximize2, Cpu, Sparkles, Beaker, Ghost, ShieldAlert, Save, Download, Menu, X, Swords, WandSparkles, Languages, Shield, Heart, Gem, DoorOpen } from 'lucide-react';
import { playClickSound, playAchievementSound, playDamageSound } from './utils/audio';
import { cloudConfigIssue, isCloudConfigured, loadCloudSave, saveCloudGame, supabase, type CloudUser } from './cloud';
import DungeonMode from './DungeonMode';
import type { GameWeapon, Materials, WeaponElement, WeaponRarity } from './gameTypes';
import { deviceAccountExists, loadDeviceAccount, saveDeviceAccount } from './deviceAuth';

interface SavedGame {
  count: number;
  souls: number;
  upgrades: Record<string, number>;
  unlockedAchievements: string[];
  highScore: number;
  weapons: GameWeapon[];
  equippedWeaponId: string | null;
  materials: Materials;
  manualClicks: number;
  permanentBlessing: number;
  arcaneDust: number;
  language: Language;
  timestamp: number;
}

type Language = 'en' | 'zh-TW';
interface EnemyState {
  id: string;
  name: string;
  kind: 'slime' | 'knight' | 'mimic' | 'warden';
  hp: number;
  maxHp: number;
  shield: number;
  timeRemaining: number;
  intent: 'attack' | 'guard' | 'heal';
  turn: number;
}

const TRANSLATIONS = {
  en: {
    signals: 'Total Signals', clicks: 'Clicks Recorded', upgrades: 'System Upgrades', milestones: 'Unlocked Milestones',
    actions: 'Actions', system: 'System', theme: 'Theme', language: 'Language', login: 'Cloud Account',
    logout: 'Logout', save: 'Cloud Save', load: 'Cloud Load', localMode: 'Guest mode — this browser only',
    dimension: 'Mystery Dimension', enter: 'Enter Dimension', leave: 'Leave Dimension', lockedDimension: 'Reach 100 clicks to awaken your first weapon.',
    weapon: 'Soul Weapon', enchant: 'Enchant', attack: 'Strike', guard: 'Guard', skill: 'Weapon Skill',
    accountTitle: 'Secure Cloud Account', email: 'Email', password: 'Password', signIn: 'Sign in', signUp: 'Create account',
    cloudMissing: 'Cloud login needs Supabase environment variables. Guest saves still work locally.',
  },
  'zh-TW': {
    signals: '最高訊號', clicks: '累積點擊', upgrades: '系統強化', milestones: '已解鎖里程碑',
    actions: '行動', system: '系統', theme: '主題', language: '語言', login: '雲端帳號',
    logout: '登出', save: '雲端儲存', load: '雲端讀取', localMode: '訪客模式－僅儲存在此瀏覽器',
    dimension: '神秘維度', enter: '進入神秘維度', leave: '離開神秘維度', lockedDimension: '累積 100 次點擊，喚醒你的第一把武器。',
    weapon: '靈魂武器', enchant: '武器附魔', attack: '斬擊', guard: '防禦', skill: '武器技能',
    accountTitle: '安全雲端帳號', email: '電子郵件', password: '密碼', signIn: '登入', signUp: '建立帳號',
    cloudMissing: '雲端登入需要設定 Supabase 環境變數；訪客存檔仍可在本機使用。',
  },
} as const;

const SAFE_TRANSLATIONS = {
  en: {
    signals: 'Total Signals', clicks: 'Clicks Recorded', upgrades: 'System Upgrades', milestones: 'Unlocked Milestones',
    actions: 'Actions', system: 'System', theme: 'Theme', language: 'Language', login: 'Account Sync',
    logout: 'Logout', save: 'Save', load: 'Load', localMode: 'Guest mode — this browser only',
    dimension: 'Mystery Dimension', enter: 'Enter Dimension', leave: 'Leave Dimension', lockedDimension: 'Reach 100 real clicks to awaken your first weapon.',
    weapon: 'Soul Weapon', enchant: 'Enchant', attack: 'Strike', guard: 'Guard', skill: 'Weapon Skill',
    accountTitle: 'Secure Account Sync', email: 'Email', password: 'Password', signIn: 'Sign in', signUp: 'Create account',
    cloudMissing: 'Cross-browser cloud login needs valid Supabase settings. Encrypted device accounts still work locally.',
  },
  'zh-TW': {
    signals: '總訊號', clicks: '點擊紀錄', upgrades: '系統升級', milestones: '已解鎖里程碑',
    actions: '行動', system: '系統', theme: '主題', language: '語言', login: '帳號同步',
    logout: '登出', save: '儲存', load: '讀取', localMode: '訪客模式——只存在此瀏覽器',
    dimension: '神秘維度', enter: '進入神秘維度', leave: '離開神秘維度', lockedDimension: '累積 100 次真實點擊，喚醒你的第一把武器。',
    weapon: '靈魂武器', enchant: '附魔', attack: '攻擊', guard: '防禦', skill: '武器技能',
    accountTitle: '安全帳號同步', email: '電子郵件', password: '密碼', signIn: '登入', signUp: '建立帳號',
    cloudMissing: '跨瀏覽器雲端登入需要有效的 Supabase 設定；裝置帳號仍可在本機加密使用。',
  },
} as const;

const ACHIEVEMENTS = [
  { id: 'first_blood', type: 'count', threshold: 1, name: 'First Touch', desc: 'You pressed the button.' },
  { id: 'novice', type: 'count', threshold: 50, name: 'Getting Warmed Up', desc: 'Reached 50 clicks.' },
  { id: 'centurion', type: 'count', threshold: 100, name: 'Weapon Awakened', desc: 'The mystery dimension is open.' },
  { id: 'addict', type: 'count', threshold: 500, name: 'Button Addict', desc: '500 clicks.' },
  { id: 'master', type: 'count', threshold: 1000, name: 'Getting Serious', desc: '1,000 clicks.' },
  { id: 'consistent', type: 'count', threshold: 4000, name: 'Consistent', desc: '4,000 clicks.' },
  { id: 'enthusiast', type: 'count', threshold: 10000, name: 'The Enthusiast', desc: '10,000 clicks.' },
  { id: 'supersonic', type: 'count', threshold: 50000, name: 'Supersonic', desc: '50,000 clicks.' },
  { id: 'god', type: 'count', threshold: 1000000, name: 'God of Clicks', desc: '1,000,000 clicks.' },
  { id: 'combo_10', type: 'special', name: 'Combo Initiate', desc: 'Reach a Combo of 10' },
  { id: 'combo_50', type: 'special', name: 'Flow State', desc: 'Reach a Combo of 50' },
  { id: 'crit_1', type: 'special', name: 'Lucky Strike', desc: 'Land your first critical hit' },
  { id: 'rebirth_1', type: 'special', name: 'Reborn', desc: 'Perform a rebirth' },
  { id: 'synergy', type: 'special', name: 'Synergy', desc: 'Buy one of each upgrade' },
  { id: 'golden_1', type: 'special', name: 'Anomaly Detected', desc: 'Catch a golden target' },
];

interface Particle {
  id: string;
  x: number;
  y: number;
  value: number;
  isCrit: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePasswordStrength(password: string, language: Language) {
  if (password.length < 10) {
    return language === 'zh-TW' ? '密碼至少需要 10 個字元。' : 'Password must be at least 10 characters.';
  }
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    return language === 'zh-TW' ? '密碼需要同時包含英文字母與數字。' : 'Password must include both letters and numbers.';
  }
  return '';
}

function getCloudConfigMessage(language: Language) {
  if (cloudConfigIssue === 'invalid-url') {
    return language === 'zh-TW'
      ? 'Supabase URL 無效。請在 .env.local 填入像 https://xxxx.supabase.co 的專案 URL。'
      : 'Invalid Supabase URL. Put a project URL like https://xxxx.supabase.co in .env.local.';
  }
  if (cloudConfigIssue === 'invalid-key') {
    return language === 'zh-TW'
      ? 'Supabase anon key 無效。請使用公開 anon key，不要使用 service-role key 或範例文字。'
      : 'Invalid Supabase anon key. Use the public anon key, not a service-role key or placeholder.';
  }
  return language === 'zh-TW'
    ? '跨瀏覽器雲端登入尚未設定。請建立 .env.local 並填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY。'
    : 'Cloud login is not configured. Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
}

function getAuthErrorMessage(message: string, language: Language) {
  const text = message.toLowerCase();
  if (text.includes('invalid login') || text.includes('invalid credentials')) {
    return language === 'zh-TW' ? 'Email 或密碼不正確。' : 'Email or password is incorrect.';
  }
  if (text.includes('email not confirmed')) {
    return language === 'zh-TW' ? '請先到信箱完成驗證，再回來登入。' : 'Please confirm your email before signing in.';
  }
  if (text.includes('already registered') || text.includes('user already registered')) {
    return language === 'zh-TW' ? '這個 Email 已經建立過帳號，請改用登入。' : 'This email already has an account. Please sign in instead.';
  }
  if (text.includes('password')) {
    return language === 'zh-TW' ? '密碼不符合雲端服務的安全規則。' : 'Password does not meet the cloud service security rules.';
  }
  if (text.includes('fetch') || text.includes('network') || text.includes('failed')) {
    return language === 'zh-TW' ? '無法連到雲端服務，請檢查 Supabase 設定與網路。' : 'Could not reach cloud service. Check Supabase settings and network.';
  }
  return message;
}

export default function App() {
  const [count, setCount] = useState(() => {
    const saved = localStorage.getItem('click_count');
    return saved ? parseFloat(saved) : 0;
  });
  
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('high_score');
    return saved ? parseFloat(saved) : 0;
  });

  const [upgrades, setUpgrades] = useState(() => {
    const saved = localStorage.getItem('red_button_upgrades_v2');
    if (saved) return { power: 0, crit: 0, combo: 0, size: 0, auto: 0, luck: 0, ...JSON.parse(saved) };
    // Migration fallback
    const oldLevel = localStorage.getItem('upgrade_level');
    return {
      power: oldLevel ? parseInt(oldLevel, 10) : 0,
      crit: 0,
      combo: 0,
      size: 0,
      auto: 0,
      luck: 0
    };
  });

  const [energy, setEnergy] = useState(() => {
    return parseFloat(localStorage.getItem('red_button_energy') || '0');
  });
  const [isOverload, setIsOverload] = useState(false);

  const [souls, setSouls] = useState(() => {
    const saved = localStorage.getItem('red_button_souls');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [goldenTarget, setGoldenTarget] = useState<{id: string, x: number, y: number} | null>(null);
  const [pendingRebirth, setPendingRebirth] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);

  const [invader, setInvader] = useState<EnemyState | null>(null);
  const [defeatedInvaders, setDefeatedInvaders] = useState(0);
  const [failedInvasions, setFailedInvasions] = useState(0);
  const [isCursed, setIsCursed] = useState(() => localStorage.getItem('red_button_cursed') === 'true');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [flaskCharges, setFlaskCharges] = useState(3);
  const [flaskBuffTime, setFlaskBuffTime] = useState(0);

  const [restTimestamps, setRestTimestamps] = useState<number[]>(() => {
    const saved = localStorage.getItem('red_button_rests');
    if (saved) {
      const parsed = JSON.parse(saved) as number[];
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      return parsed.filter(t => t > twoHoursAgo);
    }
    return [];
  });

  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>(() => {
    const saved = localStorage.getItem('achievements');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true; 
  });

  const [toasts, setToasts] = useState<{id: string, name: string}[]>([]);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [accountProvider, setAccountProvider] = useState<'cloud' | 'device'>(isCloudConfigured ? 'cloud' : 'device');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [user, setUser] = useState<CloudUser | null>(null);
  const [deviceUser, setDeviceUser] = useState<string | null>(null);
  const devicePasswordRef = useRef('');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('holy_click_language') as Language) || 'zh-TW');
  const [inDimension, setInDimension] = useState(false);
  const [isGuarding, setIsGuarding] = useState(false);
  const [skillCharge, setSkillCharge] = useState(0);
  const [arcaneDust, setArcaneDust] = useState(() => Number(localStorage.getItem('holy_click_dust') || 0));
  const [manualClicks, setManualClicks] = useState(() => Number(localStorage.getItem('holy_click_manual_clicks') || 0));
  const [weapons, setWeapons] = useState<GameWeapon[]>(() => JSON.parse(localStorage.getItem('holy_click_weapons') || '[]'));
  const [equippedWeaponId, setEquippedWeaponId] = useState<string | null>(() => localStorage.getItem('holy_click_equipped_weapon'));
  const [materials, setMaterials] = useState<Materials>(() => JSON.parse(localStorage.getItem('holy_click_materials') || '{"iron":0,"crystal":0,"essence":0}'));
  const [permanentBlessing, setPermanentBlessing] = useState(() => Number(localStorage.getItem('holy_click_permanent_blessing') || 0));
  const t = SAFE_TRANSLATIONS[language];
  const equippedWeapon = weapons.find(item => item.id === equippedWeaponId) ?? weapons[0] ?? null;

  useEffect(() => {
    if (!isCloudConfigured && accountProvider === 'cloud') {
      setAccountProvider('device');
      setAuthError('');
    }
  }, [accountProvider]);

  const latestState = useRef({ count, souls, upgrades, unlockedAchievements, highScore, weapons, equippedWeaponId, materials, manualClicks, permanentBlessing, arcaneDust, language });
  useEffect(() => {
    latestState.current = { count, souls, upgrades, unlockedAchievements, highScore, weapons, equippedWeaponId, materials, manualClicks, permanentBlessing, arcaneDust, language };
  }, [count, souls, upgrades, unlockedAchievements, highScore, weapons, equippedWeaponId, materials, manualClicks, permanentBlessing, arcaneDust, language]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Autosave every 10 seconds for authenticated players.
  useEffect(() => {
    if (!user && !deviceUser) return;
    const saveState = async () => {
      try {
        const payload = { ...latestState.current, timestamp: Date.now() } satisfies SavedGame;
        if (user) await saveCloudGame(user.id, payload);
        if (deviceUser && devicePasswordRef.current) await saveDeviceAccount(deviceUser, devicePasswordRef.current, payload);
      } catch (error) {
        console.error('Autosave failed', error);
      }
    };
    const interval = setInterval(saveState, 10000);
    return () => clearInterval(interval);
  }, [user, deviceUser]);

  const handleLogin = () => {
    setEmail('');
    setPassword('');
    setAuthError('');
    setIsProfileDialogOpen(true);
  };

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accountName = email.trim();
    if (accountProvider === 'cloud' && !EMAIL_PATTERN.test(accountName)) {
      setAuthError(language === 'zh-TW' ? '請輸入有效的電子郵件。' : 'Please enter a valid email address.');
      return;
    }
    if (authMode === 'signup') {
      const passwordIssue = validatePasswordStrength(password, language);
      if (passwordIssue) {
        setAuthError(passwordIssue);
        return;
      }
    }
    if (accountProvider === 'device') {
      setAuthBusy(true);
      setAuthError('');
      try {
        if (authMode === 'signup') {
          if (deviceAccountExists(accountName)) throw new Error(language === 'zh-TW' ? '這個裝置帳號已經存在。' : 'This device account already exists.');
          await saveDeviceAccount(accountName, password, { ...latestState.current, timestamp: Date.now() } satisfies SavedGame);
        } else {
          const data = await loadDeviceAccount(accountName, password) as Partial<SavedGame>;
          applySavedGame(data);
        }
        const normalized = accountName.toLocaleLowerCase();
        devicePasswordRef.current = password;
        setDeviceUser(normalized);
        setIsProfileDialogOpen(false);
        setPassword('');
        setToasts(items => [...items, { id: crypto.randomUUID(), name: authMode === 'signup' ? (language === 'zh-TW' ? '已建立加密裝置帳號' : 'Encrypted device account created') : (language === 'zh-TW' ? '裝置帳號已解鎖' : 'Device account unlocked') }]);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : (language === 'zh-TW' ? '裝置帳號失敗。' : 'Device account failed.'));
      } finally {
        setAuthBusy(false);
      }
      return;
    }
    if (!supabase) {
      setAuthError(getCloudConfigMessage(language));
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const result = authMode === 'signup'
        ? await supabase.auth.signUp({
            email: accountName,
            password,
            options: { emailRedirectTo: window.location.origin + window.location.pathname },
          })
        : await supabase.auth.signInWithPassword({ email: accountName, password });
      if (result.error) {
        setAuthError(getAuthErrorMessage(result.error.message, language));
        return;
      }
      setPassword('');
      setIsProfileDialogOpen(false);
      const needsEmailConfirm = authMode === 'signup' && !result.data.session;
      setToasts(items => [...items, {
        id: crypto.randomUUID(),
        name: needsEmailConfirm
          ? (language === 'zh-TW' ? '帳號已建立，請到信箱完成驗證' : 'Account created. Please confirm your email')
          : authMode === 'signup'
          ? (language === 'zh-TW' ? '帳號已建立' : 'Account created')
          : (language === 'zh-TW' ? '已登入雲端帳號' : 'Signed in'),
      }]);
    } catch (error) {
      setAuthError(getAuthErrorMessage(error instanceof Error ? error.message : 'Cloud login failed.', language));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
    devicePasswordRef.current = '';
    setDeviceUser(null);
  };

  const applySavedGame = (data: Partial<SavedGame>) => {
    if (data.count !== undefined) setCount(data.count);
    if (data.souls !== undefined) setSouls(data.souls);
    if (data.upgrades !== undefined) setUpgrades({ power: 0, crit: 0, combo: 0, size: 0, auto: 0, luck: 0, ...data.upgrades });
    if (data.unlockedAchievements !== undefined) setUnlockedAchievements(data.unlockedAchievements);
    if (data.highScore !== undefined) setHighScore(data.highScore);
    if (data.weapons !== undefined) setWeapons(data.weapons);
    if (data.equippedWeaponId !== undefined) setEquippedWeaponId(data.equippedWeaponId);
    if (data.materials !== undefined) setMaterials(data.materials);
    if (data.manualClicks !== undefined) setManualClicks(data.manualClicks);
    if (data.permanentBlessing !== undefined) setPermanentBlessing(data.permanentBlessing);
    if (data.arcaneDust !== undefined) setArcaneDust(data.arcaneDust);
    if (data.language !== undefined) setLanguage(data.language);
  };

  const handleManualLoad = async () => {
    if (!user && !deviceUser) return;
    try {
      const data = user
        ? await loadCloudSave(user.id) as Partial<SavedGame> | null
        : await loadDeviceAccount(deviceUser!, devicePasswordRef.current) as Partial<SavedGame>;
      if (data) {
        applySavedGame(data);
        setToasts(items => [...items, { id: crypto.randomUUID(), name: "Cloud Save Loaded" }]);
        playAchievementSound();
      } else {
        setToasts(items => [...items, { id: crypto.randomUUID(), name: "No Cloud Save Found" }]);
      }
    } catch (err) {
      console.error("Fetch State Error:", err);
      setToasts(t => [...t, { id: crypto.randomUUID(), name: "Load Failed" }]);
    }
  };

  const handleManualSave = async () => {
    if (!user && !deviceUser) return;
    try {
      const payload = { ...latestState.current, timestamp: Date.now() } satisfies SavedGame;
      if (user) await saveCloudGame(user.id, payload);
      if (deviceUser) await saveDeviceAccount(deviceUser, devicePasswordRef.current, payload);
      setToasts(items => [...items, { id: crypto.randomUUID(), name: user ? "Saved Securely to Cloud" : "Encrypted device save updated" }]);
      playClickSound();
    } catch (err) {
      console.error("Save State Error:", err);
      setToasts(t => [...t, { id: crypto.randomUUID(), name: "Save Failed" }]);
    }
  };

  // Load the cloud save after authentication.
  useEffect(() => {
    if (user) {
      handleManualLoad();
    }
  }, [user?.id]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('click_count', count.toString());
    localStorage.setItem('red_button_upgrades_v2', JSON.stringify(upgrades));
    localStorage.setItem('red_button_souls', souls.toString());
    localStorage.setItem('holy_click_weapons', JSON.stringify(weapons));
    localStorage.setItem('holy_click_manual_clicks', manualClicks.toString());
    localStorage.setItem('holy_click_materials', JSON.stringify(materials));
    localStorage.setItem('holy_click_permanent_blessing', permanentBlessing.toString());
    if (equippedWeaponId) localStorage.setItem('holy_click_equipped_weapon', equippedWeaponId);
    localStorage.setItem('holy_click_dust', arcaneDust.toString());
    localStorage.setItem('holy_click_language', language);
    if (count > highScore) {
      setHighScore(count);
      localStorage.setItem('high_score', count.toString());
    }
  }, [count, upgrades, souls, highScore, weapons, equippedWeaponId, manualClicks, materials, permanentBlessing, arcaneDust, language]);

  useEffect(() => {
    localStorage.setItem('achievements', JSON.stringify(unlockedAchievements));
  }, [unlockedAchievements]);

  useEffect(() => {
    if (pendingRebirth) {
      const t = setTimeout(() => setPendingRebirth(false), 3000);
      return () => clearTimeout(t);
    }
  }, [pendingRebirth]);

  useEffect(() => {
    if (pendingReset) {
      const t = setTimeout(() => setPendingReset(false), 3000);
      return () => clearTimeout(t);
    }
  }, [pendingReset]);

  // Derived Stats
  const powerLevel = upgrades.power;
  const critLevel = upgrades.crit;
  const comboLevel = upgrades.combo;
  const sizeLevel = upgrades.size || 0;
  const luckLevel = upgrades.luck || 0;

  const validCount = isNaN(count) ? 0 : count;
  const dimensionUnlocked = weapons.length > 0;
  const activeMultiplier = 1 + souls * 0.05;
  const flaskMultiplier = flaskBuffTime > 0 ? 3 : 1;
  const curseMultiplier = isCursed ? 0.2 : 1;
  const elementMultiplier = equippedWeapon?.element === 'flame' ? 1.3 : equippedWeapon?.element === 'frost' ? 1.18 : equippedWeapon?.element === 'storm' ? 1.4 : equippedWeapon?.element === 'void' ? 1.55 : 1;
  const weaponMultiplier = equippedWeapon ? 1 + (equippedWeapon.basePower + equippedWeapon.forgeLevel * 4) / 100 : 1;
  const clickValueBase = (1 + powerLevel * 2) * activeMultiplier * weaponMultiplier * elementMultiplier * (1 + permanentBlessing) * (isOverload ? 5 : 1) * flaskMultiplier * curseMultiplier;
  
  const comboWindow = 1000 + (comboLevel * 200); // ms
  const comboBonusPerClick = 0.02 + (comboLevel * 0.02);
  const currentComboMult = 1 + (comboRef.current * comboBonusPerClick);

  const critChance = Math.min(0.5, critLevel * 0.05); // max 50%
  const critMultiplier = critLevel > 0 ? (2 + (critLevel * 0.5)) : 1; 

  const costs = {
    power: 100 * Math.pow(1.6, powerLevel),
    crit: 500 * Math.pow(2.0, critLevel),
    combo: 1000 * Math.pow(2.2, comboLevel),
    size: 5000 * Math.pow(3.0, sizeLevel),
    auto: 10000 * Math.pow(2.8, upgrades.auto || 0),
    luck: 25000 * Math.pow(3.5, luckLevel)
  };

  const enterDimension = () => {
    if (!dimensionUnlocked || !equippedWeapon) return;
    setInDimension(true);
    playAchievementSound();
  };

  const rollWeapon = (clickMilestone: number): GameWeapon => {
    const rarityRoll = Math.random();
    const rarity: WeaponRarity = rarityRoll > 0.985 ? 'legendary' : rarityRoll > 0.9 ? 'epic' : rarityRoll > 0.62 ? 'rare' : 'common';
    const rarityPower = { common: 8, rare: 15, epic: 25, legendary: 42 }[rarity];
    const elements: WeaponElement[] = ['physical', 'flame', 'frost', 'storm', 'void'];
    const element = elements[Math.floor(Math.random() * elements.length)];
    const names = {
      physical: ['Iron Oath', 'Stone Fang', 'Last Vanguard'],
      flame: ['Cinder Brand', 'Ashen Promise', 'Sun Eater'],
      frost: ['Winter Echo', 'Pale Glacier', 'Moonfrost'],
      storm: ['Thunder Thread', 'Skybreaker', 'Tempest Needle'],
      void: ['Null Whisper', 'Abyss Key', 'Event Horizon'],
    };
    const list = names[element];
    return {
      id: crypto.randomUUID(),
      name: list[Math.floor(Math.random() * list.length)],
      rarity,
      element,
      basePower: rarityPower + Math.floor(clickMilestone / 100),
      forgeLevel: 0,
      acquiredAt: clickMilestone,
    };
  };

  const handleEnchant = (weaponId: string, element: WeaponElement) => {
    if (materials.essence < 1) return;
    setMaterials(current => ({ ...current, essence: current.essence - 1 }));
    setWeapons(current => current.map(item => item.id === weaponId ? { ...item, element } : item));
    playAchievementSound();
  };

  const handleForge = (weaponId: string) => {
    const target = weapons.find(item => item.id === weaponId);
    if (!target) return;
    const ironCost = 3 + target.forgeLevel * 2;
    const crystalCost = Math.floor(target.forgeLevel / 2);
    if (materials.iron < ironCost || materials.crystal < crystalCost) return;
    setMaterials(current => ({ ...current, iron: current.iron - ironCost, crystal: current.crystal - crystalCost }));
    setWeapons(current => current.map(item => item.id === weaponId ? { ...item, forgeLevel: item.forgeLevel + 1, name: item.forgeLevel >= 4 ? `Forged ${item.name}` : item.name } : item));
    playAchievementSound();
  };

  useEffect(() => {
    if (isOverload) {
      const timer = setInterval(() => {
        setEnergy(e => {
          if (e <= 1) {
            setIsOverload(false);
            return 0;
          }
          return e - 1; // Drain 1 energy per 100ms => 10s total from 100
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [isOverload]);

  // Auto Clicker loop
  useEffect(() => {
    if (upgrades.auto && upgrades.auto > 0) {
      // Base CPS based on auto level and current click value base
      const cps = upgrades.auto * clickValueBase * 0.5; 
      const interval = setInterval(() => {
        setCount(c => c + cps / 10);
      }, 100); // 10 ticks a second
      return () => clearInterval(interval);
    }
  }, [upgrades.auto, clickValueBase]);

  useEffect(() => {
    const tick = setInterval(() => {
      setInvader(prev => {
        if (!prev) return null;
        if (prev.timeRemaining <= 1) {
           setFailedInvasions(f => f + 1);
           return null;
        }
        const nextTurn = prev.turn + 1;
        if (nextTurn % 3 !== 0) {
          return { ...prev, timeRemaining: prev.timeRemaining - 1, turn: nextTurn };
        }
        if (prev.intent === 'guard') {
          return {
            ...prev,
            shield: Math.min(prev.maxHp * 0.35, prev.shield + prev.maxHp * 0.12),
            timeRemaining: prev.timeRemaining - 1,
            turn: nextTurn,
            intent: 'attack',
          };
        }
        if (prev.intent === 'heal') {
          return {
            ...prev,
            hp: Math.min(prev.maxHp, prev.hp + prev.maxHp * 0.08),
            timeRemaining: prev.timeRemaining - 1,
            turn: nextTurn,
            intent: 'guard',
          };
        }
        const stolenSignals = Math.max(5, Math.floor(clickValueBase * (isGuarding ? 1 : 5)));
        setCount(value => Math.max(0, value - stolenSignals));
        setIsGuarding(false);
        playDamageSound();
        return {
          ...prev,
          timeRemaining: prev.timeRemaining - 1,
          turn: nextTurn,
          intent: prev.kind === 'slime' ? 'heal' : prev.kind === 'mimic' ? 'guard' : 'attack',
        };
      });
      setFlaskBuffTime(prev => Math.max(0, prev - 1));
      
      setRestTimestamps(prev => {
        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const filtered = prev.filter(t => t > twoHoursAgo);
        if (filtered.length !== prev.length) {
          localStorage.setItem('red_button_rests', JSON.stringify(filtered));
          return filtered;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [clickValueBase, isGuarding]);

  useEffect(() => {
    if (defeatedInvaders > 0) {
      playAchievementSound();
      setSouls(s => s + 1);
      setArcaneDust(value => value + 1);
      setCount(c => c + clickValueBase * 80);
      setToasts(t => [...t, { id: crypto.randomUUID(), name: language === 'zh-TW' ? '敵人消散（+1 靈魂、+1 奧術粉塵）' : 'Enemy shattered (+1 Soul, +1 Arcane Dust)' }]);
    }
  }, [defeatedInvaders]);

  useEffect(() => {
    if (failedInvasions > 0) {
      playDamageSound();
      setIsCursed(true);
      localStorage.setItem('red_button_cursed', 'true');
      setToasts(t => [...t, { id: crypto.randomUUID(), name: "CURSED BY DARK SPIRIT" }]);
    }
  }, [failedInvasions]);

  useEffect(() => {
    if (invader && invader.hp <= 0) {
      setInvader(null);
      setDefeatedInvaders(value => value + 1);
    }
  }, [invader?.hp]);

  const unlockAchievement = (id: string) => {
    setUnlockedAchievements(prev => {
      if (prev.includes(id)) return prev;
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        playAchievementSound();
        setTimeout(() => {
          setToasts(t => [...t, { id: crypto.randomUUID(), name: ach.name }]);
        }, 0);
        return [...prev, id];
      }
      return prev;
    });
  };

  // Check achievements securely
  useEffect(() => {
    if (upgrades.power > 0 && upgrades.crit > 0 && upgrades.combo > 0) {
      unlockAchievement('synergy');
    }
  }, [upgrades]);

  useEffect(() => {
    ACHIEVEMENTS.filter(a => a.type === 'count').forEach(ach => {
      if (count >= ach.threshold!) {
        unlockAchievement(ach.id);
      }
    });
  }, [count]);

  // Remove toast after a while
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(1));
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  const handlePress = (e: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    playClickSound();
    setToasts([]);
    setManualClicks(previous => {
      const next = previous + 1;
      if (next % 100 === 0) {
        const droppedWeapon = rollWeapon(next);
        setWeapons(current => [...current, droppedWeapon]);
        setEquippedWeaponId(current => current ?? droppedWeapon.id);
        setToasts(items => [...items, { id: crypto.randomUUID(), name: `${droppedWeapon.rarity.toUpperCase()} · ${droppedWeapon.name}` }]);
        playAchievementSound();
      }
      return next;
    });
    
    // Manage Combo
    comboRef.current += 1;
    setCombo(comboRef.current);
    
    // Calculate final hit
    const currentMult = 1 + (comboRef.current * comboBonusPerClick);
    let clickAmount = clickValueBase * currentMult;
    let isCriticalHit = false;

    if (!isOverload) {
      setEnergy(e => Math.min(100, e + 1));
    }

    if (critLevel > 0 && Math.random() < critChance) {
      isCriticalHit = true;
      clickAmount *= critMultiplier;
      unlockAchievement('crit_1');
    }

    // Refresh combo timeout
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
    }, comboWindow);

    let dmgToInvader = clickAmount;
    if (invader) {
      setInvader(prev => {
         if (!prev) return null;
         const shieldDamage = Math.min(prev.shield, dmgToInvader);
         const remainingDamage = dmgToInvader - shieldDamage;
         const newHp = prev.hp - remainingDamage;
         if (newHp <= 0) {
            setDefeatedInvaders(d => d + 1);
            return null;
         }
         return { ...prev, hp: newHp, shield: prev.shield - shieldDamage };
      });
    } else {
      setCount(prev => prev + clickAmount);
      // Spawn Invader logic
      const invaderChance = 0.005 + (luckLevel * 0.002);
      if (Math.random() < invaderChance && count > 100 && !isCursed) {
        const invaderHp = clickValueBase * (50 + Math.random() * 50);
        setInvader({
          id: crypto.randomUUID(),
          name: "Dark Spirit",
          kind: 'warden',
          maxHp: invaderHp,
          hp: invaderHp,
          shield: 0,
          timeRemaining: 15,
          intent: 'attack',
          turn: 0,
        });
      }
    }

    // Achievements
    if (comboRef.current >= 10) unlockAchievement('combo_10');
    if (comboRef.current >= 50) unlockAchievement('combo_50');

    // Spawn Particles
    let clientX = window.innerWidth / 2;
    let clientY = window.innerHeight / 2;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    // Golden Target Spawn Logic
    const targetChance = 0.02 + (luckLevel * 0.015);
    if (!goldenTarget && Math.random() < targetChance && clickAmount > 0) {
      setGoldenTarget({
        id: crypto.randomUUID(),
        x: Math.random() * 70 + 15,
        y: Math.random() * 70 + 15,
      });
      setTimeout(() => setGoldenTarget(null), 4000); // Decays if not clicked
    }
    
    // Slight random offset
    clientX += (Math.random() - 0.5) * 60;
    clientY += (Math.random() - 0.5) * 40;

    const pId = crypto.randomUUID();
    setParticles(prev => [...prev, { id: pId, x: clientX, y: clientY, value: clickAmount, isCrit: isCriticalHit }]);
    
    setTimeout(() => {
      setParticles(p => p.filter(part => part.id !== pId));
    }, 800);

    if ("vibrate" in navigator) {
      navigator.vibrate(isCriticalHit ? 50 : 20);
    }
  };

  const handleMiss = () => {
    if (count > 0 || combo > 0) {
      setCombo(0);
      comboRef.current = 0;
      playDamageSound();
      
      const el = document.getElementById('app-bg');
      if (el) {
        el.classList.add('bg-red-950/20');
        setTimeout(() => el.classList.remove('bg-red-950/20'), 150);
      }
    }
  };

  const handleRest = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Add rest limit logic
    const now = Date.now();
    const twoHoursAgo = now - 2 * 60 * 60 * 1000;
    const currentRests = restTimestamps.filter(t => t > twoHoursAgo);
    
    if (currentRests.length >= 2) {
      setToasts(t => [...t, { id: crypto.randomUUID(), name: "Cannot rest yet" }]);
      return;
    }

    const newTimestamps = [...currentRests, now];
    setRestTimestamps(newTimestamps);
    localStorage.setItem('red_button_rests', JSON.stringify(newTimestamps));

    setIsCursed(false);
    localStorage.setItem('red_button_cursed', 'false');
    setFlaskCharges(3);
    setFlaskBuffTime(0);
    setCombo(0);
    comboRef.current = 0;
    playClickSound();
  };

  const handleFlask = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (flaskCharges > 0 && flaskBuffTime <= 0) {
      setFlaskCharges(prev => prev - 1);
      setFlaskBuffTime(5);
      setEnergy(100);
      playAchievementSound();
    }
  };

  const handleHardReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pendingReset) {
      setCount(0);
      setHighScore(0);
      setSouls(0);
      setUpgrades({ power: 0, crit: 0, combo: 0, size: 0, auto: 0, luck: 0 });
      setCombo(0);
      comboRef.current = 0;
      setUnlockedAchievements([]);
      setWeapons([]);
      setEquippedWeaponId(null);
      setManualClicks(0);
      setMaterials({ iron: 0, crystal: 0, essence: 0 });
      setPermanentBlessing(0);
      setArcaneDust(0);
      setInDimension(false);
      ['click_count', 'high_score', 'red_button_upgrades_v2', 'red_button_souls', 'red_button_energy', 'achievements', 'holy_click_weapon', 'holy_click_dust'].forEach(key => localStorage.removeItem(key));
      setPendingReset(false);
      playDamageSound();
      setToasts([{ id: crypto.randomUUID(), name: 'YOU DIED (Hard Wipe)' }]);
    } else {
      setPendingReset(true);
    }
  };

  const handleGoldenTarget = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    playAchievementSound();
    const reward = clickValueBase * (50 + comboLevel * 10);
    setCount(c => c + reward);
    setGoldenTarget(null);
    unlockAchievement('golden_1');
    setToasts(prev => [...prev, { id: crypto.randomUUID(), name: `Golden Anomaly: +${Math.floor(reward)}` }]);
  };

  const handleUpgrade = (type: 'power' | 'crit' | 'combo' | 'size' | 'auto' | 'luck') => {
    const cost = costs[type];
    if (count >= cost) {
      playAchievementSound();
      setCount(c => c - cost);
      setUpgrades(prev => ({ ...prev, [type]: prev[type] + 1 }));
    }
  };

  const potentialSoulsGain = Math.floor(validCount / 1000);

  const handleRebirth = () => {
    if (potentialSoulsGain > 0) {
      if (!pendingRebirth) {
        setPendingRebirth(true);
        return;
      }
      playAchievementSound();
      setSouls(prev => prev + potentialSoulsGain);
      setCount(0);
      setUpgrades({ power: 0, crit: 0, combo: 0, size: 0, auto: 0, luck: 0 });
      setCombo(0);
      comboRef.current = 0;
      setPendingRebirth(false);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      
      unlockAchievement('rebirth_1');
      setToasts(prev => [...prev, { id: crypto.randomUUID(), name: `Rebirth: +${potentialSoulsGain} Souls` }]);
    }
  };

  const UPGRADE_DATA = [
    {
      id: 'power',
      title: 'Power',
      icon: ChevronsUp,
      level: upgrades.power,
      cost: costs.power,
      currentEffect: `Power +${upgrades.power}`,
    },
    {
      id: 'crit',
      title: 'Critical Strike',
      icon: Target,
      level: upgrades.crit,
      cost: costs.crit,
      currentEffect: `${(critChance * 100).toFixed(0)}% chance for ${critMultiplier.toFixed(1)}x`,
    },
    {
      id: 'combo',
      title: 'Combo Mastery',
      icon: Flame,
      level: upgrades.combo,
      cost: costs.combo,
      currentEffect: `+${(comboBonusPerClick * 100).toFixed(0)}% per tap (${(comboWindow/1000).toFixed(1)}s)`,
    },
    {
      id: 'size',
      title: 'Endurance',
      icon: Maximize2,
      level: upgrades.size || 0,
      cost: costs.size,
      currentEffect: `Size Rank ${upgrades.size || 0}`,
    },
    {
      id: 'auto',
      title: 'Automaton',
      icon: Cpu,
      level: upgrades.auto || 0,
      cost: costs.auto,
      currentEffect: `+${((upgrades.auto || 0) * clickValueBase * 0.5).toFixed(1)} sec`,
    },
    {
      id: 'luck',
      title: 'Probability Matrix',
      icon: Sparkles,
      level: luckLevel,
      cost: costs.luck,
      currentEffect: `Anomaly +${(luckLevel * 1.5).toFixed(1)}%`,
    }
  ];

  if (inDimension && equippedWeapon) {
    return (
      <DungeonMode
        weapon={equippedWeapon}
        permanentBonus={permanentBlessing}
        language={language}
        onExit={(blessingCount, dungeonMaterials, bestFloor) => {
          setInDimension(false);
          setPermanentBlessing(value => value + blessingCount * 0.01);
          setMaterials(current => ({
            iron: current.iron + dungeonMaterials.iron,
            crystal: current.crystal + dungeonMaterials.crystal,
            essence: current.essence + dungeonMaterials.essence,
          }));
          setToasts(items => [...items, {
            id: crypto.randomUUID(),
            name: language === 'zh-TW'
              ? `撤離第 ${bestFloor} 層：${blessingCount}% 永久增益`
              : `Extracted on floor ${bestFloor}: +${blessingCount}% permanent power`,
          }]);
        }}
      />
    );
  }

  return (
    <div id="app-bg" className={`min-h-screen flex flex-col items-center justify-between w-full p-4 md:p-8 select-none transition-colors duration-500 cursor-crosshair ${isDarkMode ? 'bg-[#3F3D3A] text-[#F2EFE9]' : 'bg-[#F5F2EB] text-[#1A1A1A]'}`} onClick={handleMiss} style={{ backgroundColor: isDarkMode ? '#3F3D3A' : '#F5F2EB' }}>
      
      {/* Particles Overlay */}
      {particles.map(p => (
        <div 
          key={p.id} 
          className={`fixed pointer-events-none z-50 font-pixel font-bold animate-floatUp ${p.isCrit ? 'text-red-500 text-3xl md:text-5xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'opacity-80 text-xl md:text-2xl drop-shadow-sm'}`}
          style={{ left: p.x, top: p.y }}
        >
          {p.isCrit ? 'CRIT! ' : ''}+{p.value >= 1 ? Math.floor(p.value) : p.value.toFixed(2)}
        </div>
      ))}

      {/* Blur Overlay when menu is open */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-md z-40"
            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); }}
          />
        )}
      </AnimatePresence>

      {/* Top Header / Stats */}
      <div className={`w-full flex justify-between items-start max-w-4xl mx-auto ${isMenuOpen ? 'z-50' : 'z-10'}`} onClick={e => e.stopPropagation()}>
        <div className="flex flex-col">
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{t.signals}</span>
          <div className="flex items-center gap-2 text-xl md:text-2xl">
            <span className="font-pixel font-black text-red-500">{Math.floor(highScore)}</span>
            {souls > 0 && (
                <span className="text-sm font-sans md:text-lg text-emerald-500 flex items-center gap-1 font-bold">
                  <Flame className="w-3 h-3 md:w-4 md:h-4" /> {souls} Souls
                </span>
            )}
          </div>
        </div>
        
        <div className="relative z-50">
          <button
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
            className={`w-12 h-12 flex justify-center items-center rounded-none border transition-colors ${isMenuOpen ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white' : 'border-black/20 dark:border-white/20 bg-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, originTopRight: true }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute top-full right-0 mt-2 bg-[#f9fafb] dark:bg-[#0a0a0a] border border-black dark:border-white/20 shadow-2xl flex flex-col w-64 z-50 p-2 gap-1 origin-top-right transform"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-3 py-2 border-b border-black/10 dark:border-white/10 mb-1">
                  {t.actions}
                </div>

                <div className="relative group">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRebirth(); setIsMenuOpen(false); }}
                    disabled={potentialSoulsGain <= 0 && !pendingRebirth}
                    className="w-full flex items-center justify-between p-3 text-xs uppercase tracking-widest font-bold rounded-none border border-transparent hover:border-red-500/30 transition-colors text-red-600 dark:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span>{pendingRebirth ? 'Confirm Kindle' : 'Kindle'}</span>
                    <Flame className="w-4 h-4" />
                  </button>
                  {potentialSoulsGain > 0 && !pendingRebirth && (
                    <div className="absolute left-0 bottom-full mb-1 w-full text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-500 font-bold bg-black/5 dark:bg-white/5 py-1">
                      +{potentialSoulsGain} Souls (5% mult/ea)
                    </div>
                  )}
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); handleFlask(e); setIsMenuOpen(false); }}
                  disabled={flaskCharges <= 0 || flaskBuffTime > 0}
                  className="w-full flex items-center justify-between p-3 text-xs uppercase tracking-widest font-bold rounded-none border border-transparent hover:border-red-500/30 transition-colors text-[#a62525] dark:text-[#f87171] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span>Flasks ({flaskCharges})</span>
                  <Beaker className={`w-4 h-4 ${flaskBuffTime > 0 ? 'animate-pulse' : ''}`} />
                </button>

                <div className="relative group">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRest(e); setIsMenuOpen(false); }}
                    disabled={restTimestamps.length >= 2}
                    className="w-full flex items-center justify-between p-3 text-xs uppercase tracking-widest font-bold rounded-none border border-transparent hover:border-orange-500/30 transition-colors text-orange-600 dark:text-orange-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span>Rest</span>
                    <Flame className="w-4 h-4" />
                  </button>
                  <div className="absolute left-0 bottom-full mb-1 w-full text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-orange-500 font-bold bg-black/5 dark:bg-white/5 py-1">
                    {2 - restTimestamps.length} Uses left (2h cd)
                  </div>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); handleHardReset(e); if(pendingReset) setIsMenuOpen(false); }}
                  className="w-full flex items-center justify-between p-3 text-xs uppercase tracking-widest font-bold rounded-none border border-transparent hover:border-red-500/50 hover:bg-red-500/10 transition-colors text-red-600 dark:text-red-500"
                >
                  <span>{pendingReset ? 'Confirm Wipe' : 'Wipe Data'}</span>
                  <Skull className="w-4 h-4" />
                </button>

                <div className="my-2 border-b border-black/10 dark:border-white/10"></div>
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-3 py-1 mb-1">
                  {t.system}
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); setIsMenuOpen(false); }}
                  className="w-full flex items-center justify-between p-3 text-xs uppercase tracking-widest font-bold rounded-none border border-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors opacity-80"
                >
                  <span>{t.theme}</span>
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLanguage(current => current === 'zh-TW' ? 'en' : 'zh-TW');
                  }}
                  className="w-full flex items-center justify-between p-3 text-xs uppercase tracking-widest font-bold border border-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors opacity-80"
                >
                  <span>{t.language}: {language === 'zh-TW' ? '繁中' : 'EN'}</span>
                  <Languages className="w-4 h-4" />
                </button>

                {user || deviceUser ? (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleManualSave(); setIsMenuOpen(false); }}
                      className="w-full flex items-center justify-between p-3 text-xs uppercase tracking-widest font-bold rounded-none border border-transparent hover:bg-emerald-50 dark:hover:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 transition-colors"
                    >
                      <span>{t.save}</span>
                      <Save className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleManualLoad(); setIsMenuOpen(false); }}
                      className="w-full flex items-center justify-between p-3 text-xs uppercase tracking-widest font-bold rounded-none border border-transparent hover:bg-emerald-50 dark:hover:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 transition-colors"
                    >
                      <span>{t.load}</span>
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleLogout(); setIsMenuOpen(false); }}
                      className="w-full flex flex-col items-start p-3 text-xs uppercase tracking-widest font-bold rounded-none border border-transparent hover:bg-black/5 dark:hover:bg-white/5 transition-colors opacity-80"
                    >
                      <div className="flex w-full justify-between items-center mb-1">
                        <span>{t.logout}</span>
                        <LogOut className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] opacity-60 normal-case tracking-normal truncate w-full max-w-[200px] text-left">{user?.email ?? `${deviceUser} (device)`}</span>
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleLogin(); setIsMenuOpen(false); }}
                    className="w-full flex items-center justify-between p-3 text-xs uppercase tracking-widest font-bold rounded-none border border-transparent hover:bg-blue-50 dark:hover:bg-blue-900/10 text-blue-600 dark:text-blue-400 transition-colors"
                  >
                    <span>{t.login}</span>
                    <LogIn className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Central Action Area */}
      <div className="flex flex-col items-center justify-center flex-grow z-10 w-full mt-8 md:mt-0" onClick={e => e.stopPropagation()}>
        {!user && !deviceUser && (
          <div className="mb-5 border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
            {t.localMode}
          </div>
        )}

        <div className={`mb-6 w-full max-w-4xl border p-5 transition-all ${dimensionUnlocked ? 'border-violet-500/50 bg-gradient-to-r from-violet-950/90 via-slate-950/90 to-cyan-950/90 text-white shadow-[0_0_35px_rgba(139,92,246,0.18)]' : 'border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5'}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className={`grid h-14 w-14 place-items-center border ${dimensionUnlocked ? 'border-cyan-300/50 bg-violet-500/20 text-cyan-200' : 'border-current/10 opacity-40'}`}>
                <DoorOpen className="h-7 w-7" />
              </div>
              <div>
                <div className="font-pixel text-xs uppercase tracking-wider">{t.dimension}</div>
                <div className="mt-2 text-xs opacity-65">
                  {dimensionUnlocked && equippedWeapon ? `${t.weapon}: ${equippedWeapon.name} +${equippedWeapon.forgeLevel}` : t.lockedDimension}
                </div>
              </div>
            </div>
            <button
              disabled={!dimensionUnlocked}
              onClick={enterDimension}
              className="border border-current/30 px-5 py-3 text-xs font-bold uppercase tracking-widest transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {t.enter}
            </button>
          </div>
        </div>
        
        {/* Curse Status */}
        {isCursed && (
          <div className="max-w-md mb-6 w-full text-center">
             <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-500/50 rounded-none animate-pulse">
               <Ghost className="w-5 h-5" />
               <span className="font-bold text-xs uppercase tracking-widest">Cursed: Base Power Reduced (Rest to clear)</span>
             </div>
          </div>
        )}

        {/* Invader Status */}
        {invader && (
          <div className="mb-6 w-full max-w-xl mx-auto p-5 border rounded-none relative overflow-hidden bg-black/5 dark:bg-white/5 border-red-500/50">
             <div className={`absolute inset-0 pointer-events-none ${invader.kind === 'slime' ? 'bg-emerald-500/10' : invader.kind === 'mimic' ? 'bg-amber-500/10' : 'bg-violet-500/10'}`}></div>
             <div className="flex justify-between items-center mb-2 relative z-10">
               <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold uppercase text-xs tracking-widest">
                 <ShieldAlert className="w-4 h-4" /> 
                  {invader.name}
               </div>
               <div className="text-xs font-mono font-bold text-red-500">{invader.timeRemaining}s</div>
             </div>
             <div className="relative z-10 mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest opacity-70">
               <span>Intent: {invader.intent}</span>
               <span>Turn {invader.turn}</span>
             </div>
             <div className="w-full h-3 bg-black/10 dark:bg-white/10 rounded-none overflow-hidden relative z-10">
               <motion.div 
                 className="h-full bg-red-500"
                 initial={{ width: '100%' }}
                 animate={{ width: `${Math.max(0, (invader.hp / invader.maxHp) * 100)}%` }}
               />
             </div>
             {invader.shield > 0 && (
               <div className="relative z-10 mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                 <Shield className="h-3 w-3" /> Shield {Math.ceil(invader.shield)}
               </div>
             )}
          </div>
        )}

        {/* Counter */}
        <div className="mb-8 md:mb-12 text-center">
          <span className="text-[10px] md:text-xs uppercase tracking-[0.4em] opacity-60 font-bold mb-4 block">{t.clicks}</span>
          <motion.div 
            key={Math.floor(count)}
            initial={{ scale: 1.1, opacity: 0.9 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl md:text-8xl font-pixel drop-shadow-md dark:drop-shadow-[0_0_30px_rgba(255,255,255,0.05)] select-none tracking-tighter"
          >
            {Math.floor(count)}
          </motion.div>
        </div>

        {/* Golden Target */}
        <AnimatePresence>
          {goldenTarget && (
            <motion.button
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 45 }}
              onClick={handleGoldenTarget}
              className="fixed z-40 w-12 h-12 md:w-16 md:h-16 rounded-full bg-yellow-400 dark:bg-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.6)] border-4 border-white dark:border-zinc-800 flex items-center justify-center cursor-pointer animate-pulse"
              style={{ left: `${goldenTarget.x}vw`, top: `${goldenTarget.y}vh` }}
            >
              <Zap className="w-6 h-6 text-white" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* The Button */}
        <div className="relative group mt-4 md:mt-16 mb-8 flex flex-col items-center">
          
          {/* Combo & Buff Indicator */}
          <div className={`absolute -top-16 md:-top-24 flex flex-col items-center transition-all duration-300 ${combo > 1 || flaskBuffTime > 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
             
             {flaskBuffTime > 0 && (
               <div className="text-xl md:text-3xl font-black font-mono italic text-red-500 mb-2 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] tracking-tighter animate-pulse">
                 CRIMSON TEAR 3x ({flaskBuffTime}s)
               </div>
             )}

             {combo > 1 && (
               <>
                 <div className="text-2xl md:text-4xl font-black font-mono italic text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] tracking-tighter">
                   {combo}x COMBO
                 </div>
                 <div className="text-[10px] md:text-xs font-bold opacity-60 uppercase tracking-widest mt-1">
                   Bonus Mult: {(currentComboMult).toFixed(2)}x
                 </div>
               </>
             )}
          </div>

           {/* Ambient Glow */}
          <div className={`absolute inset-0 rounded-full blur-[40px] md:blur-[60px] opacity-100 pointer-events-none transition-all duration-700 group-hover:opacity-80 ${inDimension ? 'bg-violet-500/50 animate-pulse' : isOverload ? 'bg-cyan-400/40 dark:bg-cyan-500/40 animate-pulse' : 'bg-red-400/20 dark:bg-red-600/20'}`}></div>
          
          {/* The Actual Button */}
          <motion.button
            aria-label="Record click"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.9, y: 15 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            onClick={handlePress}
            className="relative z-10 rounded-full cursor-pointer touch-manipulation flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400/50 shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 border-gray-200 dark:border-zinc-800"
            style={{
              width: `calc(13rem + ${sizeLevel * 1.5}rem)`,
              height: `calc(13rem + ${sizeLevel * 1.5}rem)`,
              background: inDimension ? 'radial-gradient(circle at 35% 25%, #67e8f9 0%, #7c3aed 32%, #111827 72%)' : isOverload ? (isDarkMode ? 'linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)' : 'linear-gradient(180deg, #67e8f9 0%, #0ea5e9 100%)') : (isDarkMode ? 'linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)'),
              boxShadow: isOverload ? (isDarkMode ? 'inset 0 10px 20px rgba(255, 255, 255, 0.2), inset 0 -15px 30px rgba(0, 0, 0, 0.3), 0 15px 0 rgb(21,94,117), 0 20px 40px rgba(0, 0, 0, 0.4)' : 'inset 0 10px 20px rgba(255, 255, 255, 0.4), inset 0 -15px 30px rgba(0, 0, 0, 0.2), 0 10px 0 rgb(3,105,161), 0 15px 30px rgba(0,0,0,0.2)') : (isDarkMode ? 'inset 0 10px 20px rgba(255, 255, 255, 0.2), inset 0 -15px 30px rgba(0, 0, 0, 0.3), 0 15px 0 rgb(153,27,27), 0 20px 40px rgba(0, 0, 0, 0.4)' : 'inset 0 10px 20px rgba(255, 255, 255, 0.4), inset 0 -15px 30px rgba(0, 0, 0, 0.2), 0 10px 0 rgb(185,28,28), 0 15px 30px rgba(0,0,0,0.2)'),
              borderTop: isOverload ? (isDarkMode ? '4px solid #22d3ee' : '4px solid #67e8f9') : (isDarkMode ? '4px solid #f87171' : '4px solid #fca5a5')
            }}
          >
            {/* Inner highlight for 3D effect */}
            <div 
              className={`rounded-full border-2 border-red-300/40 dark:border-red-400/30 flex items-center justify-center transition-all duration-300 ${isOverload ? 'bg-cyan-400/30 animate-pulse' : ''}`}
              style={{
                width: `calc(9rem + ${sizeLevel * 1.5}rem)`,
                height: `calc(9rem + ${sizeLevel * 1.5}rem)`
              }}
            >
              {inDimension ? <Swords className="h-14 w-14 text-cyan-100 drop-shadow-[0_0_15px_rgba(103,232,249,0.9)]" /> : <div className="w-4 h-4 rounded-full bg-white/40 dark:bg-white/20"></div>}
            </div>
          </motion.button>

          {/* Overload Energy Bar */}
          <div className="relative w-full max-w-[14rem] md:max-w-xs h-6 bg-black/10 dark:bg-white/10 rounded-none overflow-hidden mt-6 md:mt-8 border border-black/10 dark:border-white/10">
            <motion.div 
              className={`h-full ${isOverload ? 'bg-cyan-400 dark:bg-cyan-500 animate-pulse' : 'bg-gradient-to-r from-red-500 to-orange-400 dark:from-red-600 dark:to-orange-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${energy}%` }}
              transition={{ type: 'tween', duration: 0.1 }}
            />
            {energy >= 100 && !isOverload && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsOverload(true); playAchievementSound(); }}
                  className="w-full h-full text-[10px] font-bold text-white font-pixel uppercase animate-pulse drop-shadow-md tracking-[0.2em] bg-cyan-500/80 hover:bg-cyan-400 transition-colors"
                >
                  OVERLOAD
                </button>
              </div>
            )}
            {isOverload && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-white font-pixel uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                  ACTIVE
                </span>
              </div>
            )}
            {!isOverload && energy < 100 && (
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[8px] font-bold opacity-60 uppercase tracking-widest">
                  Energy
                </span>
              </div>
            )}
          </div>
        </div>

        {dimensionUnlocked && (
          <div className="mt-8 w-full max-w-4xl border border-violet-500/30 bg-violet-500/5 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-50">{t.weapon} / {manualClicks} manual clicks</div>
                <div className="mt-2 text-xs opacity-60">
                  Iron {materials.iron} / Crystal {materials.crystal} / Essence {materials.essence} / Permanent +{Math.round(permanentBlessing * 100)}%
                </div>
              </div>
              <div className="text-xs opacity-60">
                {language === 'zh-TW' ? '每 100 次真人點擊抽取一把武器' : 'A weapon drops every 100 manual clicks'}
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {weapons.map(item => {
                const selected = item.id === equippedWeapon?.id;
                const forgeIron = 3 + item.forgeLevel * 2;
                const forgeCrystal = Math.floor(item.forgeLevel / 2);
                return (
                  <div key={item.id} className={`border p-4 ${selected ? 'border-cyan-400 bg-cyan-400/10' : 'border-current/15'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{item.name} +{item.forgeLevel}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-55">{item.rarity} · {item.element} · Power {item.basePower + item.forgeLevel * 4}</p>
                      </div>
                      <button onClick={() => setEquippedWeaponId(item.id)} className="border border-current/20 px-3 py-2 text-[10px] font-bold uppercase">
                        {selected ? (language === 'zh-TW' ? '裝備中' : 'Equipped') : (language === 'zh-TW' ? '裝備' : 'Equip')}
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleForge(item.id)}
                        disabled={materials.iron < forgeIron || materials.crystal < forgeCrystal}
                        className="border border-amber-500/30 px-3 py-2 text-[10px] font-bold uppercase disabled:opacity-30"
                      >
                        {language === 'zh-TW' ? '鍛造' : 'Forge'} ({forgeIron}I/{forgeCrystal}C)
                      </button>
                      {(['flame', 'frost', 'storm', 'void'] as WeaponElement[]).map(element => (
                        <button
                          key={element}
                          onClick={() => handleEnchant(item.id, element)}
                          disabled={materials.essence < 1}
                          className={`border px-2 py-2 text-[9px] font-bold uppercase disabled:opacity-30 ${item.element === element ? 'border-violet-500 bg-violet-500 text-white' : 'border-current/15'}`}
                        >
                          {element}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upgrade Section */}
        <div className="mt-8 md:mt-12 flex flex-col z-10 w-full max-w-4xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[1px] flex-grow bg-black/10 dark:bg-white/10"></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-50">{t.upgrades}</span>
            <div className="h-[1px] flex-grow bg-black/10 dark:bg-white/10"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {UPGRADE_DATA.map(upg => (
              <button 
                key={upg.id}
                onClick={() => handleUpgrade(upg.id as any)}
                disabled={count < upg.cost}
                className={`p-4 rounded-none border flex flex-col items-start transition-all duration-300 relative overflow-hidden group ${
                  count >= upg.cost ? 'bg-black text-white border-black dark:bg-[#4A4743] dark:border-[#5A5752] dark:text-[#F2EFE9]' 
                  : 'bg-black/5 border-black/10 text-black/40 dark:bg-[#32302D] dark:border-white/5 dark:text-white/40 cursor-not-allowed opacity-70'
                }`}
              >
                <div className="flex justify-between w-full items-center mb-2">
                    <div className="flex items-center gap-2">
                       <upg.icon className="w-4 h-4" />
                       <span className="font-bold text-sm uppercase tracking-wider">{upg.title}</span>
                    </div>
                    <span className="font-mono text-[10px] md:text-xs opacity-60">Lvl {upg.level}</span>
                </div>
                <div className="text-left mb-4">
                    <div className="text-[10px] opacity-70 uppercase tracking-widest mb-1">Effect</div>
                    <div className="text-xs font-bold">{upg.currentEffect}</div>
                </div>
                <div className="mt-auto w-full flex items-center justify-between pt-3 border-t border-current/10">
                    <span className="text-[10px] uppercase tracking-wider opacity-70">Cost</span>
                    <span className="font-pixel text-[10px] md:text-xs">{Math.floor(upg.cost)}</span>
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-8 text-center bg-black dark:bg-[#32302D] text-white dark:text-[#F2EFE9] py-4 px-6 rounded-none border border-black dark:border-white/5 mx-auto w-full max-w-sm">
            <div className="text-[10px] md:text-xs font-bold opacity-60 uppercase tracking-widest">Base Power</div>
            <div className="text-sm md:text-base font-mono font-bold">
              {clickValueBase.toFixed(2)} <span className="opacity-60 text-xs font-sans font-normal">per tap</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom / Achievement System */}
      <div className="w-full max-w-4xl z-10 pb-4 md:pb-8 mt-12 md:mt-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-4">
          <div className="h-[1px] flex-grow bg-black/10 dark:bg-white/10"></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-50">{t.milestones}</span>
          <div className="h-[1px] flex-grow bg-black/10 dark:bg-white/10"></div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 max-h-[360px] overflow-y-auto pr-2 pb-4">
          {ACHIEVEMENTS.map(ach => {
            const isUnlocked = unlockedAchievements.includes(ach.id);
            return (
              <div key={ach.id} className={`p-3 md:p-4 rounded-none flex items-center gap-3 transition-opacity duration-300 ${isUnlocked ? 'bg-black text-white dark:bg-[#4A4743] dark:text-[#F2EFE9] border border-black dark:border-[#5A5752] opacity-100 shadow-sm' : 'bg-transparent border border-dashed border-black/20 dark:border-white/10 opacity-40'}`}>
                <div className={`w-10 h-10 shrink-0 rounded-none flex items-center justify-center font-bold font-pixel text-[8px] md:text-[10px] ${isUnlocked ? 'bg-red-500/20 border border-red-500/50 text-red-500' : 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10'}`}>
                  {ach.type === 'count' ? (ach.threshold! >= 1000 ? `${ach.threshold! / 1000}K` : ach.threshold) : '*'}
                  {/*
                  {ach.type === 'count' ? (ach.threshold! >= 1000 ? `${ach.threshold! / 1000}K` : ach.threshold) : '★'}
                  */}
                </div>
                <div className="overflow-hidden">
                  <p className={`text-xs font-bold truncate ${isUnlocked ? 'opacity-100' : 'opacity-50'}`}>{ach.name}</p>
                  <p className={`text-[10px] italic line-clamp-2 opacity-60`}>{isUnlocked ? ach.desc : 'Locked'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {isProfileDialogOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(event) => {
              event.stopPropagation();
              setIsProfileDialogOpen(false);
            }}
          >
            <motion.form
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              onSubmit={handleProfileSubmit}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm border border-black/20 bg-[#F5F2EB] p-6 text-[#1A1A1A] shadow-2xl dark:border-white/10 dark:bg-[#32302D] dark:text-[#F2EFE9]"
            >
              <h2 className="font-pixel text-sm uppercase tracking-wider">{t.accountTitle}</h2>
              <p className="mt-3 text-xs leading-relaxed opacity-60">
                {!isCloudConfigured
                  ? (language === 'zh-TW'
                    ? '公開版使用安全裝置帳號。玩家只要輸入帳號名稱與密碼，不需要設定檔、匯入檔案或手動上傳任何東西。'
                    : 'Public mode uses secure device accounts. Players only enter a username and password; no config files, imports, or manual uploads are required.')
                  : accountProvider === 'cloud'
                  ? (language === 'zh-TW'
                    ? '雲端帳號可跨瀏覽器同步；密碼由驗證服務處理，遊戲資料只允許本人讀寫。'
                    : 'Cloud accounts sync across browsers. Passwords are handled by the auth service, and saves are isolated per player.')
                  : (language === 'zh-TW'
                    ? '裝置帳號會在此瀏覽器加密保存，適合不想使用雲端同步的玩家。'
                    : 'Device accounts are encrypted in this browser, useful for players who do not want cloud sync.')}
              </p>

              {isCloudConfigured && (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setAccountProvider('device'); setAuthError(''); }} className={`border px-3 py-2 text-xs font-bold uppercase ${accountProvider === 'device' ? 'bg-violet-600 text-white' : 'border-current/20'}`}>
                    {language === 'zh-TW' ? '裝置帳號' : 'Device'}
                  </button>
                  <button type="button" onClick={() => { setAccountProvider('cloud'); setAuthError(''); }} className={`border px-3 py-2 text-xs font-bold uppercase ${accountProvider === 'cloud' ? 'bg-cyan-600 text-white' : 'border-current/20'}`}>
                    {language === 'zh-TW' ? '雲端同步' : 'Cloud sync'}
                  </button>
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAuthMode('signin')} className={`border px-3 py-2 text-xs font-bold uppercase ${authMode === 'signin' ? 'bg-black text-white dark:bg-white dark:text-black' : 'border-current/20'}`}>
                  {t.signIn}
                </button>
                <button type="button" onClick={() => setAuthMode('signup')} className={`border px-3 py-2 text-xs font-bold uppercase ${authMode === 'signup' ? 'bg-black text-white dark:bg-white dark:text-black' : 'border-current/20'}`}>
                  {t.signUp}
                </button>
              </div>

              <label className="mt-5 block text-[10px] font-bold uppercase tracking-widest" htmlFor="public-account-id">
                {accountProvider === 'cloud' ? t.email : (language === 'zh-TW' ? '帳號名稱' : 'Username')}
              </label>
              <input
                id="public-account-id"
                type={accountProvider === 'cloud' ? 'email' : 'text'}
                autoFocus
                autoComplete={accountProvider === 'cloud' ? 'email' : 'username'}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm outline-none focus:border-red-500 dark:border-white/20"
                placeholder={accountProvider === 'cloud' ? 'player@example.com' : 'player-one'}
              />

              <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest" htmlFor="public-account-password">
                {t.password}
              </label>
              <input
                id="public-account-password"
                type="password"
                minLength={authMode === 'signup' ? 10 : 1}
                autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm outline-none focus:border-red-500 dark:border-white/20"
                placeholder={authMode === 'signup' ? '10+ characters, letters + numbers' : '••••••••'}
              />

              {authMode === 'signup' && (
                <p className="mt-2 text-[10px] leading-relaxed opacity-55">
                  {language === 'zh-TW' ? '請使用 10 個字元以上，並包含英文字母與數字。不要重複使用其他網站密碼。' : 'Use 10+ characters with letters and numbers. Do not reuse passwords from other sites.'}
                </p>
              )}
              {authError && <p className="mt-3 text-xs font-bold text-red-500">{authError}</p>}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsProfileDialogOpen(false)}
                  className="flex-1 border border-black/20 px-4 py-3 text-xs font-bold uppercase tracking-widest dark:border-white/20"
                >
                  {language === 'zh-TW' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={(accountProvider === 'cloud' && !isCloudConfigured) || authBusy || !email.trim() || !password}
                  className="flex-1 bg-black px-4 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-30 dark:bg-[#F2EFE9] dark:text-black"
                >
                  {authBusy ? '...' : authMode === 'signin' ? t.signIn : t.signUp}
                </button>
              </div>
            </motion.form>
            <motion.form
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              onSubmit={handleProfileSubmit}
              onClick={(event) => event.stopPropagation()}
              className="hidden"
            >
              <h2 className="font-pixel text-sm uppercase tracking-wider">{t.accountTitle}</h2>
              <p className="hidden">
                {accountProvider === 'device'
                  ? (language === 'zh-TW' ? '裝置帳號使用 PBKDF2 與 AES-GCM 加密，但只能在這個瀏覽器使用。' : 'Device accounts use PBKDF2 and AES-GCM encryption, but remain on this browser.')
                  : isCloudConfigured
                  ? (language === 'zh-TW' ? '密碼由 Supabase Auth 安全處理，遊戲資料只能由帳號本人讀寫。' : 'Passwords are handled by Supabase Auth. Row-level security isolates every player save.')
                  : t.cloudMissing}
              </p>
              <p className="hidden">
                {accountProvider === 'device'
                  ? (language === 'zh-TW' ? '裝置帳號會用 PBKDF2 與 AES-GCM 加密，但只能在這個瀏覽器使用。' : 'Device accounts use PBKDF2 and AES-GCM encryption, but remain on this browser.')
                  : isCloudConfigured
                  ? (language === 'zh-TW' ? '密碼由 Supabase Auth 安全處理，遊戲資料只能由帳號本人讀寫。' : 'Passwords are handled by Supabase Auth. Row-level security isolates every player save.')
                  : getCloudConfigMessage(language)}
              </p>
              <p className="mt-3 text-xs leading-relaxed opacity-60">
                {!isCloudConfigured
                  ? (language === 'zh-TW'
                    ? '公開版會直接使用安全裝置帳號：玩家只要輸入帳號名稱與密碼，不需要設定檔或匯入檔案。資料會在此瀏覽器加密保存。'
                    : 'Public mode uses secure device accounts: players only enter a username and password. No config files or imports are required. Saves are encrypted in this browser.')
                  : accountProvider === 'device'
                  ? (language === 'zh-TW'
                    ? '裝置帳號會用 PBKDF2 與 AES-GCM 加密，但只能在這個瀏覽器使用。'
                    : 'Device accounts use PBKDF2 and AES-GCM encryption, but remain on this browser.')
                  : (language === 'zh-TW'
                    ? '密碼由雲端驗證服務安全處理，遊戲資料只能由帳號本人讀寫。'
                    : 'Passwords are handled by the cloud auth service. Row-level security isolates every player save.')}
              </p>
              {isCloudConfigured && <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setAccountProvider('device'); setAuthError(''); }} className={`relative border px-3 py-2 text-xs font-bold uppercase text-transparent text-[0px] ${accountProvider === 'device' ? 'bg-violet-600 text-white' : 'border-current/20'}`}>
                  <span className={`absolute inset-0 flex items-center justify-center text-xs ${accountProvider === 'device' ? 'text-white' : 'text-[#1A1A1A] dark:text-[#F2EFE9]'}`}>{language === 'zh-TW' ? '裝置帳號' : 'Device'}</span>
                  {language === 'zh-TW' ? '裝置帳號' : 'Device'}
                </button>
                <button type="button" onClick={() => { setAccountProvider('cloud'); setAuthError(''); }} className={`relative border px-3 py-2 text-xs font-bold uppercase text-transparent text-[0px] ${accountProvider === 'cloud' ? 'bg-cyan-600 text-white' : 'border-current/20'}`}>
                  <span className={`absolute inset-0 flex items-center justify-center text-xs ${accountProvider === 'cloud' ? 'text-white' : 'text-[#1A1A1A] dark:text-[#F2EFE9]'}`}>{language === 'zh-TW' ? '跨瀏覽器雲端' : 'Cloud sync'}</span>
                  {language === 'zh-TW' ? '跨瀏覽器雲端' : 'Cloud sync'}
                </button>
              </div>}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAuthMode('signin')} className={`border px-3 py-2 text-xs font-bold uppercase ${authMode === 'signin' ? 'bg-black text-white dark:bg-white dark:text-black' : 'border-current/20'}`}>
                  {t.signIn}
                </button>
                <button type="button" onClick={() => setAuthMode('signup')} className={`border px-3 py-2 text-xs font-bold uppercase ${authMode === 'signup' ? 'bg-black text-white dark:bg-white dark:text-black' : 'border-current/20'}`}>
                  {t.signUp}
                </button>
              </div>
              <label className="hidden" htmlFor="account-email">
                {accountProvider === 'device' ? (language === 'zh-TW' ? '帳號名稱' : 'Username') : t.email}
              </label>
              <label className="hidden" htmlFor="account-email">
                {accountProvider === 'device' ? (language === 'zh-TW' ? '帳號名稱' : 'Username') : t.email}
              </label>
              <label className="hidden" htmlFor="account-email">
                {accountProvider === 'device' ? (language === 'zh-TW' ? '帳號名稱' : 'Username') : t.email}
              </label>
              <label className="mt-5 block text-[10px] font-bold uppercase tracking-widest" htmlFor="account-email">
                {accountProvider === 'cloud' ? t.email : (language === 'zh-TW' ? '帳號名稱' : 'Username')}
              </label>
              <input
                id="account-email"
                type={accountProvider === 'cloud' ? 'email' : 'text'}
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="hidden"
                placeholder={accountProvider === 'cloud' ? 'player@example.com' : 'player-one'}
              />
              <input
                id="account-password-clean"
                type="password"
                minLength={authMode === 'signup' ? 10 : 1}
                autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm outline-none focus:border-red-500 dark:border-white/20"
                placeholder={authMode === 'signup' ? '10+ characters, letters + numbers' : '••••••••'}
              />
              <label className="mt-4 block text-[10px] font-bold uppercase tracking-widest" htmlFor="account-password">
                {t.password}
              </label>
              <input
                id="account-password"
                type="password"
                minLength={authMode === 'signup' ? 10 : 1}
                autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm outline-none focus:border-red-500 dark:border-white/20"
                placeholder={authMode === 'signup' ? '10+ characters, letters + numbers' : '••••••••'}
              />
              {authMode === 'signup' && (
                <p className="hidden">
                  {language === 'zh-TW' ? '建議使用 10 字元以上，並包含英文字母與數字。不要重複使用其他網站密碼。' : 'Use 10+ characters with letters and numbers. Do not reuse passwords from other sites.'}
                </p>
              )}
              {authMode === 'signup' && (
                <p className="mt-2 text-[10px] leading-relaxed opacity-55">
                  {language === 'zh-TW' ? '請使用 10 個字元以上，並包含英文字母與數字。不要重複使用其他網站密碼。' : 'Use 10+ characters with letters and numbers. Do not reuse passwords from other sites.'}
                </p>
              )}
              {authError && <p className="mt-3 text-xs font-bold text-red-500">{authError}</p>}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsProfileDialogOpen(false)}
                  className="flex-1 border border-black/20 px-4 py-3 text-xs font-bold uppercase tracking-widest dark:border-white/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={(accountProvider === 'cloud' && !isCloudConfigured) || authBusy || !email.trim() || !password}
                  className="flex-1 bg-black px-4 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-30 dark:bg-[#F2EFE9] dark:text-black"
                >
                  {authBusy ? '...' : authMode === 'signin' ? t.signIn : t.signUp}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Achievement Toasts */}
      <div className="fixed bottom-6 left-0 right-0 flex flex-col items-center gap-3 z-50 pointer-events-none px-4">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="bg-[#111111] dark:bg-[#EBE8E0] text-[#FAF9F6] dark:text-[#111111] px-5 py-4 rounded-none shadow-2xl flex items-center gap-4 min-w-[280px] pointer-events-auto"
            >
              <div className="bg-red-500/20 dark:bg-red-500/10 p-2.5 rounded-none shrink-0">
                 <Trophy className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">Achievement Unlocked</p>
                <p className="font-bold text-base leading-tight mt-0.5">{toast.name}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
    </div>
  );
}
