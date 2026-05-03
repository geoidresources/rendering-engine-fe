/**
 * PDF report generation utility.
 * Uses jspdf + html2canvas to compose survey reports with map screenshots.
 *
 * NOTE: Requires `jspdf` and `html2canvas` as dependencies.
 * Install: pnpm add jspdf html2canvas
 *
 * This module gracefully handles missing dependencies by returning an error
 * instead of crashing if the packages aren't installed yet.
 */

export interface ReportData {
  projectName: string;
  surveyDate: string;
  generatedAt: string;
  mapScreenshotDataUrl?: string;
  measurements?: {
    type: string;
    name: string;
    value: string;
  }[];
  stockpileSummary?: {
    name: string;
    volumeM3: number;
    tonnage: number;
  }[];
  cutFillSummary?: {
    cutVolumeM3: number;
    fillVolumeM3: number;
    netChangeM3: number;
  };
}

/**
 * Generate a PDF report and trigger download.
 * Returns true on success, error message on failure.
 */
export async function generatePDFReport(data: ReportData): Promise<string | true> {
  try {
    // Dynamic import to avoid bundling jspdf unless actually used.
    const { default: jsPDF } = await import('jspdf');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // ---- Header ----
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('GEOID Survey Report', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(`Project: ${data.projectName}`, 20, y);
    doc.text(`Survey Date: ${data.surveyDate}`, pageWidth - 20, y, { align: 'right' });
    y += 5;
    doc.text(`Generated: ${data.generatedAt}`, 20, y);
    y += 10;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // ---- Map Screenshot ----
    if (data.mapScreenshotDataUrl) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Site Overview', 20, y);
      y += 5;

      try {
        const imgWidth = pageWidth - 40;
        const imgHeight = imgWidth * 0.56; // 16:9 aspect
        doc.addImage(data.mapScreenshotDataUrl, 'PNG', 20, y, imgWidth, imgHeight);
        y += imgHeight + 10;
      } catch {
        doc.setFontSize(9);
        doc.setTextColor(180, 0, 0);
        doc.text('(Map screenshot could not be embedded)', 20, y);
        y += 10;
      }
    }

    // ---- Measurements Table ----
    if (data.measurements && data.measurements.length > 0) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Measurements', 20, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Type', 22, y);
      doc.text('Name', 55, y);
      doc.text('Value', 130, y);
      y += 5;
      doc.setDrawColor(220, 220, 220);
      doc.line(20, y, pageWidth - 20, y);
      y += 3;

      doc.setFont('helvetica', 'normal');
      for (const m of data.measurements) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(m.type, 22, y);
        doc.text(m.name, 55, y);
        doc.text(m.value, 130, y);
        y += 5;
      }
      y += 5;
    }

    // ---- Stockpile Summary ----
    if (data.stockpileSummary && data.stockpileSummary.length > 0) {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Stockpile Inventory', 20, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Stockpile', 22, y);
      doc.text('Volume (m\u00B3)', 100, y);
      doc.text('Tonnage (t)', 145, y);
      y += 5;
      doc.line(20, y, pageWidth - 20, y);
      y += 3;

      doc.setFont('helvetica', 'normal');
      for (const s of data.stockpileSummary) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(s.name, 22, y);
        doc.text(s.volumeM3.toLocaleString(), 100, y);
        doc.text(s.tonnage.toLocaleString(), 145, y);
        y += 5;
      }
      y += 5;
    }

    // ---- Cut/Fill Summary ----
    if (data.cutFillSummary) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Cut / Fill Analysis', 20, y);
      y += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cut Volume: ${data.cutFillSummary.cutVolumeM3.toLocaleString()} m\u00B3`, 22, y);
      y += 5;
      doc.text(`Fill Volume: ${data.cutFillSummary.fillVolumeM3.toLocaleString()} m\u00B3`, 22, y);
      y += 5;
      doc.text(`Net Change: ${data.cutFillSummary.netChangeM3.toLocaleString()} m\u00B3`, 22, y);
      y += 10;
    }

    // ---- Footer ----
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `GEOID Platform - Page ${i}/${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' },
      );
    }

    // Trigger download
    const date = new Date().toISOString().split('T')[0];
    doc.save(`${data.projectName}_report_${date}.pdf`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('Cannot find module') || msg.includes('Failed to fetch')) {
      return 'PDF generation requires jspdf. Run: pnpm add jspdf';
    }
    return `PDF generation failed: ${msg}`;
  }
}
