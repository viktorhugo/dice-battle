type DailyStreakData = {
  streak: number;
  lastDate: string; // YYYY-MM-DD
  days: string[];   // sorted array of YYYY-MM-DD visited days, capped at 90
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function key(address: string): string {
  return `dice-battle:daily-streak:${address.toLowerCase()}`;
}

function read(address: string): DailyStreakData {
  try {
    const raw = localStorage.getItem(key(address));
    if (raw) return JSON.parse(raw) as DailyStreakData;
  } catch { /* ignore */ }
  return { streak: 0, lastDate: "", days: [] };
}

function write(address: string, data: DailyStreakData): void {
  try {
    localStorage.setItem(key(address), JSON.stringify(data));
  } catch { /* ignore */ }
}

export function recordVisit(address: string): DailyStreakData {
  const today = todayISO();
  const current = read(address);

  if (current.lastDate === today) return current;

  const streak = current.lastDate === yesterdayISO()
    ? current.streak + 1
    : 1;

  const days = [...new Set([...current.days, today])].sort().slice(-90);

  const updated: DailyStreakData = { streak, lastDate: today, days };
  write(address, updated);
  return updated;
}

export function getStreak(address: string): DailyStreakData {
  return read(address);
}

export type { DailyStreakData };
