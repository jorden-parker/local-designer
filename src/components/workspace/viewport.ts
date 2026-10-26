import { Monitor, Smartphone, Tablet } from "lucide-react";

export const VIEWPORTS = [
  { id: "desktop", label: "Desktop", width: "100%", icon: Monitor },
  { id: "tablet", label: "Tablet", width: "768px", icon: Tablet },
  { id: "mobile", label: "Mobile", width: "390px", icon: Smartphone },
] as const;

export type ViewportId = (typeof VIEWPORTS)[number]["id"];
