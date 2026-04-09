/**
 * Horizontal survey timeline bar at the bottom of the viewer.
 * Shows survey dates as clickable dots. Clicking switches the active manifest.
 */
'use client';

import React from 'react';
import { useViewerStore } from '../../store/viewerStore';

export const TimelineBar: React.FC = () => {
  const surveys = useViewerStore((s) => s.availableSurveys);
  const activeSurveyId = useViewerStore((s) => s.activeSurveyId);
  const switchSurvey = useViewerStore((s) => s.switchSurvey);

  if (surveys.length < 2) return null;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-2xl bg-white/80 dark:bg-zinc-950/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/70 shadow-xl shadow-black/10 dark:shadow-black/30 px-4 py-2">
      {/* Connecting line */}
      <div className="absolute top-1/2 left-6 right-6 h-px bg-zinc-300 dark:bg-zinc-700 -translate-y-px" />

      {surveys.map((survey, i) => {
        const isActive = survey.id === activeSurveyId;
        return (
          <button
            key={survey.id}
            type="button"
            onClick={() => switchSurvey(survey.id)}
            title={`Switch to ${survey.label}`}
            className={`relative flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {/* Dot */}
            <div
              className={`w-3 h-3 rounded-full border-2 transition-colors ${
                isActive
                  ? 'bg-blue-600 dark:bg-blue-400 border-blue-600 dark:border-blue-400'
                  : 'bg-white dark:bg-zinc-900 border-zinc-400 dark:border-zinc-500 hover:border-blue-400'
              }`}
            />
            {/* Label */}
            <span className={`text-[10px] font-mono whitespace-nowrap ${isActive ? 'font-bold' : ''}`}>
              {survey.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
