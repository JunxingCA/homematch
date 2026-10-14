import {
  Trees,
  GraduationCap,
  ShoppingBasket,
  HeartPulse,
  Utensils,
  Dumbbell,
  CircleDot,
  Goal,
  Waves,
  Footprints,
  Activity,
} from "lucide-react";
import type { Preference } from "@/domain/preferences";

export const amenityPresentation: Record<
  Preference["lifestyles"][number]["category"],
  { color: string; icon: typeof Trees; label: string }
> = {
  Badminton: { color: "#ac95e9", icon: Dumbbell, label: "Badminton" },
  Parks: { color: "#48b88b", icon: Trees, label: "Parks" },
  Groceries: { color: "#39b6cc", icon: ShoppingBasket, label: "Groceries" },
  "Hawker centres": {
    color: "#d4b965",
    icon: Utensils,
    label: "Hawker centres",
  },
  Schools: { color: "#749ef0", icon: GraduationCap, label: "Schools" },
  Healthcare: { color: "#dd8ba9", icon: HeartPulse, label: "Hospitals" },
  Gym: { color: "#ec938c", icon: Dumbbell, label: "Gyms" },
  Basketball: { color: "#cda8ed", icon: CircleDot, label: "Basketball" },
  Football: { color: "#8acb6a", icon: Goal, label: "Football / futsal" },
  Swimming: { color: "#63c3e7", icon: Waves, label: "Swimming" },
  Tennis: { color: "#d8d67b", icon: CircleDot, label: "Tennis" },
  "Fitness corners": {
    color: "#de97c6",
    icon: Activity,
    label: "Fitness corners",
  },
  "Running tracks": {
    color: "#b7c79b",
    icon: Footprints,
    label: "Running tracks",
  },
};
export const destinationColor = "#bca8ee";
export const radiusColor = "#48bdb5";
export const routeColors = ["#45bac6", "#a68add"] as const;
