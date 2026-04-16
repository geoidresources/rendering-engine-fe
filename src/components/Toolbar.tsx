import React from 'react';
import { MousePointer2, Ruler, Square, Hexagon, Home, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useViewerStore } from '../store/viewerStore';
import { useProjects } from '../hooks/useProjects';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

export const Toolbar: React.FC = () => {
  const { terrainMode, setTerrainMode, activeTool, setActiveTool } = useViewerStore();
  const { data: projects } = useProjects();

  return (
    <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <Link href="/home">
        <Button
          variant="ghost"
          size="icon"
          title="Back to Dashboard"
          aria-label="Back to Dashboard"
          type="button"
        >
          <Home className="size-5" />
        </Button>
      </Link>
      {projects && projects.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="max-w-[180px] gap-1.5"
          title="Switch project"
          aria-label="Project selector"
        >
          <span className="truncate">{projects[0].name}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </Button>
      )}
      <Separator orientation="vertical" className="mx-1 h-7" />
      <Button
        variant={activeTool === 'select' ? 'secondary' : 'ghost'}
        size="icon"
        title="Select"
        aria-label="Select Tool"
        onClick={() => setActiveTool('select')}
        type="button"
      >
        <MousePointer2 className="size-5" />
      </Button>
      <Button
        variant={activeTool === 'distance' ? 'secondary' : 'ghost'}
        size="icon"
        title="Measure Distance"
        aria-label="Measure Distance Tool"
        onClick={() => setActiveTool('distance')}
        type="button"
      >
        <Ruler className="size-5" />
      </Button>
      <Button
        variant={activeTool === 'area' ? 'secondary' : 'ghost'}
        size="icon"
        title="Measure Area"
        aria-label="Measure Area Tool"
        onClick={() => setActiveTool('area')}
        type="button"
      >
        <Square className="size-5" />
      </Button>
      <Button
        variant={activeTool === 'volume' ? 'secondary' : 'ghost'}
        size="icon"
        title="Measure Volume"
        aria-label="Measure Volume Tool"
        onClick={() => setActiveTool('volume')}
        type="button"
      >
        <Hexagon className="size-5" />
      </Button>
      <Separator orientation="vertical" className="mx-1 h-7" />
      <div
        className="inline-flex items-center gap-1 rounded-xl border bg-muted/30 p-1"
        role="group"
        aria-label="Terrain mode"
      >
        <Badge variant="outline" className="hidden sm:inline-flex">
          Terrain
        </Badge>
        <Button
          type="button"
          onClick={() => setTerrainMode('dtm')}
          variant={terrainMode === 'dtm' ? 'default' : 'ghost'}
          size="sm"
          title="Use bare-earth terrain"
        >
          DTM
        </Button>
        <Button
          type="button"
          onClick={() => setTerrainMode('dsm')}
          variant={terrainMode === 'dsm' ? 'default' : 'ghost'}
          size="sm"
          title="Use surface terrain (includes structures/vegetation)"
        >
          DSM
        </Button>
      </div>
    </div>
  );
};
