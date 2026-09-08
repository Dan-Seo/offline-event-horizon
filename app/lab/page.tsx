import Vastness from "@/components/Vastness";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "PILGRIM / Research Lens",
  description:
    "A separate synthetic RGB-D perception and scenic-navigation instrument inside the VASTNESS world.",
};
export default function LabPage() {
  return <Vastness research />;
}
