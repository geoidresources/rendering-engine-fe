'use client';

/**
 * V-STATE-05 — Tracks the last 5 surveys the user opened, keyed per-user in
 * localStorage. The globe / project list page surfaces these as quick-jump
 * links so users don't have to hunt for the survey they were just working on.
 */
import { useCallback } from 'react';

const STORAGE_KEY = 'viewer:recent-surveys';
const MAX_RECENT = 5;

export interface RecentSurvey {
  surveyId: string;
  projectId: string;
  projectName: string;
  surveyDate: string;
  visitedAt: string;
}

function read(): RecentSurvey[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentSurvey[]) : [];
  } catch {
    return [];
  }
}

function write(items: RecentSurvey[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage quota exceeded — silently skip
  }
}

export function useRecentSurveys() {
  const getRecentSurveys = useCallback((): RecentSurvey[] => read(), []);

  const recordSurveyVisit = useCallback((entry: Omit<RecentSurvey, 'visitedAt'>) => {
    const current = read();
    const filtered = current.filter((s) => s.surveyId !== entry.surveyId);
    const next: RecentSurvey[] = [
      { ...entry, visitedAt: new Date().toISOString() },
      ...filtered,
    ].slice(0, MAX_RECENT);
    write(next);
  }, []);

  const clearRecentSurveys = useCallback(() => write([]), []);

  return { getRecentSurveys, recordSurveyVisit, clearRecentSurveys };
}
