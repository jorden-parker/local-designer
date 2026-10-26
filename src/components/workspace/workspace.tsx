"use client";

import { useState } from "react";
import type { Design } from "@/lib/types";
import { Canvas } from "./canvas";
import { InspectorPanel } from "./inspector-panel";
import { ProjectNav } from "./project-nav";
import { ThreadPanel } from "./thread-panel";
import { TopBar } from "./top-bar";
import { useWorkspace } from "./use-workspace";
import type { ViewportId } from "./viewport";

export function Workspace({ initialDesign }: { initialDesign: Design }) {
  const workspace = useWorkspace(initialDesign);
  const [viewport, setViewport] = useState<ViewportId>("desktop");
  const { design, target, view, run, selectedNodeId, selectNode, requestChange } = workspace;
  const running = run.status === "running";
  const hasSystem = design.system.length > 0;

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)]">
      <TopBar
        designId={design.id}
        title={design.title}
        canHandOff={hasSystem}
        viewport={viewport}
        onViewport={setViewport}
        mode={workspace.mode}
        onMode={workspace.setMode}
        models={workspace.models}
        model={workspace.model}
        onModel={workspace.setModel}
      />
      <div className="grid min-h-0 grid-cols-[var(--container-panel)_minmax(0,1fr)_var(--container-inspector)]">
        <aside className="flex min-h-0 flex-col border-r border-gray-alpha-400 bg-background-100">
          <ProjectNav
            pages={design.pages}
            target={target}
            canAddPage={hasSystem && !running}
            onShow={workspace.showTarget}
            onAddPage={workspace.createPage}
          />
          <ThreadPanel
            subject={target.kind === "system" ? "the design system" : "this page"}
            versions={view.versions}
            viewed={view.viewed}
            latest={view.latest}
            run={run}
            onView={workspace.viewVersion}
            onRestore={workspace.restore}
            onStop={workspace.stop}
            onRequest={(request) => requestChange(request, null)}
          />
        </aside>
        <Canvas
          design={view.render}
          viewport={viewport}
          selectedNodeId={selectedNodeId}
          running={running}
          onSelect={selectNode}
          onFixError={(message) => requestChange(`Fix this error: ${message}`, null)}
        />
        <InspectorPanel
          code={view.code}
          fileName={target.kind === "system" ? "components.tsx" : "Page.tsx"}
          tokens={view.tokens}
          selectedNodeId={selectedNodeId}
          running={running}
          onClear={() => selectNode(null)}
          onRequest={requestChange}
        />
      </div>
    </div>
  );
}
