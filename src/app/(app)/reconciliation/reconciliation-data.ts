export interface ReconZone {
  id: string;
  sectorName: string;
  benchmark: number;
  current: number;
  delta: number;
  percentageChange: number;
}

export interface ReconMetrics {
  surveyAVolume: number;
  surveyAConfidence: number;
  surveyBVolume: number;
  surveyBStatus: string;
  netDifference: number;
  variancePercentage: number;
  withinTolerance: boolean;
}

export const MOCK_RECON_DATA: { zones: ReconZone[]; metrics: ReconMetrics } = {
  metrics: {
    surveyAVolume: 458290,
    surveyAConfidence: 99.4,
    surveyBVolume: 412115,
    surveyBStatus: "ACTIVE SCAN SYNC",
    netDifference: -46175,
    variancePercentage: 10.07,
    withinTolerance: true,
  },
  zones: [
    {
      id: "ZN-402-A",
      sectorName: "NORTH EXTRACTION WALL",
      benchmark: 120400,
      current: 112000,
      delta: -8400,
      percentageChange: -6.97,
    },
    {
      id: "ZN-105-B",
      sectorName: "MAIN SHAFT FLOOR",
      benchmark: 45100,
      current: 44800,
      delta: -300,
      percentageChange: -0.66,
    },
    {
      id: "ZN-909-C",
      sectorName: "SOUTHEAST CORRIDOR",
      benchmark: 202300,
      current: 168000,
      delta: -34300,
      percentageChange: -16.95,
    },
    {
      id: "ZN-201-D",
      sectorName: "TAILINGS RESERVOIR",
      benchmark: 90490,
      current: 87315,
      delta: -3175,
      percentageChange: -3.51,
    },
    {
      id: "ZN-111-S",
      sectorName: "SUPPORT PILLAR 12",
      benchmark: 0,
      current: 0,
      delta: 0,
      percentageChange: 0.0,
    },
  ],
};

export const MOCK_SURVEYS = [
  { id: "2023-OCT-12_V01", label: "2023-OCT-12_V01" },
  { id: "2023-NOV-05_LIVE", label: "2023-NOV-05_LIVE" },
];
