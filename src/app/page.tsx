import type { Metadata } from "next";
import GeoidLandingPage from "@/components/marketing/GeoidLandingPage";

export const metadata: Metadata = {
  title: "Geoid Resources",
  description:
    "Move from gate monitoring to source monitoring with Geoid Resources' basin-scale enforcement and survey platform.",
};

export default function Home() {
  return <GeoidLandingPage />;
}
