/**
 * Horizontal survey timeline bar at the bottom of the viewer.
 * Shows survey dates as clickable dots. Clicking switches the active manifest.
 */
'use client';

import React from 'react';
import { useViewerStore } from '@/store/viewerStore';

export const TimelineBar: React.FC = () => {
  const surveys = useViewerStore((s) => s.availableSurveys);
  const activeSurveyId = useViewerStore((s) => s.activeSurveyId);
  const switchSurvey = useViewerStore((s) => s.switchSurvey);

  if (surveys.length < 2) return null;

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-sm bg-bg-surface/90 supports-[backdrop-filter]:bg-bg-surface/75 backdrop-blur-md border border-border-subtle shadow-2xl px-4 py-2">
      {/* Connecting line */}
      <div className="absolute top-1/2 left-6 right-6 h-px bg-border-subtle -translate-y-px" />

      {surveys.map((survey) => {
        const isActive = survey.id === activeSurveyId;
        return (
          <button
            key={survey.id}
            type="button"
            onClick={() => switchSurvey(survey.id)}
            title={`Switch to ${survey.label}`}
            className={`relative flex flex-col items-center gap-1 px-3 py-1 rounded-sm transition-colors ${
              isActive
                ? 'text-accent'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full border-2 transition-colors ${
                isActive
                  ? 'bg-accent border-accent'
                  : 'bg-bg-surface border-border-subtle hover:border-accent/60'
              }`}
            />
            <span
              className={`text-[10px] font-mono uppercase tracking-[0.15em] whitespace-nowrap ${isActive ? 'font-bold' : ''}`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {survey.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
