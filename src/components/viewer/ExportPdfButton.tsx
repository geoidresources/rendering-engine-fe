'use client';

import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/http';
import { downloadBlob } from '@/lib/export/csvExport';

interface ExportPdfButtonProps {
  surveyId?: string;
  projectId?: string;
  projectSlug?: string;
}

/**
 * V-OUTPUT-03 — Exports a PDF report from the viewer.
 * Calls POST /api/v1/reports/pdf (rendering-engine-be) which uses
 * headless Chromium (chromedp) to render a templated HTML report and
 * return the PDF blob. The user sees a toast while generating.
 */
export function ExportPdfButton({ surveyId, projectId, projectSlug = 'report' }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!surveyId || !projectId) {
      toast.error('No survey loaded — open a survey first.');
      return;
    }
    setLoading(true);
    const id = toast.loading('Generating PDF report…');
    try {
      const res = await apiClient.post<Blob>(
        '/api/v1/reports/pdf',
        { survey_id: surveyId, project_id: projectId, title: `${projectSlug} — Survey Report` },
        { responseType: 'blob' },
      );
      const filename = `${projectSlug}_${surveyId}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(res.data as unknown as Blob, filename);
      toast.dismiss(id);
      toast.success('PDF report downloaded.');
    } catch {
      toast.dismiss(id);
      toast.error('PDF generation failed — check the server logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading || !surveyId}
      title="Export PDF report"
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 className="size-3 animate-spin" /> : <FileDown className="size-3" />}
      Export PDF
    </button>
  );
}
