import type { Streak } from '../types';

export function todayKey(date = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

export function defaultStreak(): Streak {
  return {
    current: 0,
    longest: 0,
    lastGoalDate: '',
    dailyGoalMinutes: 15,
    dailyCapsuleGoal: 1,
    minutesToday: 0,
    capsulesToday: 0,
    date: todayKey(),
  };
}

export function nextStreak(streak: Streak, minutesDelta: number, capsuleDelta: number): Streak {
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const next: Streak = streak.date === today ? { ...streak } : { ...streak, date: today, minutesToday: 0, capsulesToday: 0 };
  next.minutesToday = Math.max(0, next.minutesToday + minutesDelta);
  next.capsulesToday = Math.max(0, next.capsulesToday + capsuleDelta);
  const metMinutes = next.dailyGoalMinutes > 0 && next.minutesToday + 1e-6 >= next.dailyGoalMinutes;
  const metCapsules = next.dailyCapsuleGoal > 0 && next.capsulesToday >= next.dailyCapsuleGoal;
  if ((metMinutes || metCapsules) && next.lastGoalDate !== today) {
    next.current = next.lastGoalDate === yesterday ? next.current + 1 : 1;
    next.longest = Math.max(next.longest, next.current);
    next.lastGoalDate = today;
  }
  return next;
}

export interface StreakView {
  current: number;
  longest: number;
  minutesToday: number;
  capsulesToday: number;
  goalMinutes: number;
  goalCapsules: number;
  met: boolean;
}

export function viewStreak(streak: Streak): StreakView {
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const active = streak.date === today;
  const alive = streak.lastGoalDate === today || streak.lastGoalDate === yesterday;
  const minutesToday = active ? streak.minutesToday : 0;
  const capsulesToday = active ? streak.capsulesToday : 0;
  const met =
    (streak.dailyGoalMinutes > 0 && minutesToday >= streak.dailyGoalMinutes) ||
    (streak.dailyCapsuleGoal > 0 && capsulesToday >= streak.dailyCapsuleGoal);
  return {
    current: alive ? streak.current : 0,
    longest: streak.longest,
    minutesToday,
    capsulesToday,
    goalMinutes: streak.dailyGoalMinutes,
    goalCapsules: streak.dailyCapsuleGoal,
    met,
  };
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function formatMinutes(value: number): string {
  return `${Math.floor(value)}`;
}
