import { createRoot } from "react-dom/client";
import { PreviewRuntime } from "@/components/preview/preview-runtime";

const root = document.getElementById("root");
if (root) createRoot(root).render(<PreviewRuntime />);
