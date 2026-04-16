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
    <div className="pointer-events-none absolute bottom-8 left-4 right-4 z-10 flex justify-center">
      <div className="pointer-events-auto w-fit max-w-full rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="scrollbar-none flex items-center gap-3 overflow-x-auto">
          <span className="shrink-0 rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground">
            Survey Timeline
          </span>
          <div className="relative flex min-w-max items-start gap-3 pr-1">
            <div className="pointer-events-none absolute left-0 right-0 top-[6px] h-px bg-border" />
            {surveys.map((survey) => {
              const isActive = survey.id === activeSurveyId;
              return (
                <button
                  key={survey.id}
                  type="button"
                  onClick={() => switchSurvey(survey.id)}
                  title={`Switch to ${survey.label}`}
                  className={`relative z-10 flex min-w-[72px] flex-col items-center gap-1 bg-transparent px-1 text-center transition-colors ${
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      isActive ? 'border-primary bg-primary' : 'border-border bg-background'
                    }`}
                  />
                  <span className={`whitespace-nowrap text-[10px] font-mono ${isActive ? 'font-bold' : ''}`}>
                    {survey.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
