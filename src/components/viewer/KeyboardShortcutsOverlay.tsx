'use client';

import React, { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ShortcutRow {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Tools',
    rows: [
      { keys: ['V'], label: 'Select' },
      { keys: ['M'], label: 'Measure' },
      { keys: ['D'], label: 'Draw region' },
      { keys: ['C'], label: 'Compare epochs' },
      { keys: ['A'], label: 'Annotate (drop pin)' },
      { keys: ['Esc'], label: 'Return to Select / cancel drawing' },
    ],
  },
  {
    title: 'Measure submodes',
    rows: [
      { keys: ['M', '1'], label: 'Distance' },
      { keys: ['M', '2'], label: 'Area' },
      { keys: ['M', '3'], label: 'Volume' },
      { keys: ['M', '4'], label: 'Profile' },
      { keys: ['M', '5'], label: 'Cross-section' },
    ],
  },
  {
    title: 'Right rail',
    rows: [
      { keys: ['1'], label: 'Overview' },
      { keys: ['2'], label: 'Layers' },
      { keys: ['3'], label: 'Inspector' },
      { keys: ['4'], label: 'Saved regions' },
      { keys: ['5'], label: 'Compare' },
    ],
  },
  {
    title: 'Save modal',
    rows: [
      { keys: ['⌘', '↵'], label: 'Save region (Ctrl+Enter on Windows)' },
    ],
  },
  {
    title: 'Help',
    rows: [
      { keys: ['?'], label: 'Show this overlay' },
    ],
  },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  if (target.getAttribute('role') === 'textbox') return true;
  return false;
}

export const KeyboardShortcutsOverlay: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Match `?` literally — works across keyboard layouts where Shift+/
      // produces `?` but the underlying physical key varies.
      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4 text-accent" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Press <kbd className="rounded-sm bg-bg-elevated px-1 font-mono text-[10px]">?</kbd> any time to toggle this overlay.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-2">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.rows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-3 text-[11px]"
                  >
                    <span className="text-text-primary truncate">{row.label}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {row.keys.map((k, i) => (
                        <React.Fragment key={`${k}-${i}`}>
                          {i > 0 && <span className="text-text-muted text-[10px]">then</span>}
                          <kbd className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-sm border border-border-subtle bg-bg-elevated font-mono text-[10px] text-text-primary">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
