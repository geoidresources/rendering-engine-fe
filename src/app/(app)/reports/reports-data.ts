import { useState, useEffect, useMemo } from "react";

export interface Report {
  id: number;
  name: string;
  project: string;
  type: string;
  generatedBy: string;
  date: string;
  status: "VALIDATED" | "PROCESSING" | "FAILED";
}

export const MOCK_REPORTS_DATA: Report[] = [
  { id: 1, name: "STRIP_MDL_JUL_2024", project: "Vortex Sector 7", type: "STOCKPILE", generatedBy: "J. Draven", date: "2024-07-12", status: "VALIDATED" },
  { id: 2, name: "CUT_FILL_ANALYSIS_A2", project: "North Ridge Excavation", type: "VOLUMES", generatedBy: "A. Miller", date: "2024-07-10", status: "PROCESSING" },
  { id: 3, name: "TOPO_SURVEY_Q2_FINAL", project: "Obsidian Depths", type: "TOPOGRAPHY", generatedBy: "S. Op", date: "2024-07-05", status: "VALIDATED" },
  { id: 4, name: "DRILL_HOLE_TELEMETRY_EX", project: "Project Icarus", type: "DRILLING", generatedBy: "E. Lane", date: "2024-07-01", status: "FAILED" },
  { id: 5, name: "HAUL_ROAD_GRADIENT_B", project: "Vortex Sector 7", type: "ANALYSIS", generatedBy: "J. Draven", date: "2024-06-28", status: "VALIDATED" },
  { id: 6, name: "SITE_ORTHO_COMPOSITE", project: "North Ridge Excavation", type: "ORTHO", generatedBy: "A. Miller", date: "2024-06-25", status: "VALIDATED" },
];

export function useReports(searchTerm: string = "", activeTab: string = "all") {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate API fetch delay
    const timer = setTimeout(() => {
      setReports(MOCK_REPORTS_DATA);
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesSearch = 
        report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.type.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTab = 
        activeTab === "all" || 
        (activeTab === "templates" && report.type === "TEMPLATE") || // Mock logic for templates
        (activeTab === "scheduled" && report.status === "PROCESSING"); // Mock logic for scheduled

      return matchesSearch && matchesTab;
    });
  }, [reports, searchTerm, activeTab]);

  return {
    reports: filteredReports,
    isLoading,
    error,
    totalCount: MOCK_REPORTS_DATA.length,
    filteredCount: filteredReports.length
  };
}
