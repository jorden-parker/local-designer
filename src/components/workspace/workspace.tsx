"use client";

import { useCallback, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import type { Design, Target } from "@/lib/types";
import { Canvas } from "./canvas";
import { InspectorPanel } from "./inspector-panel";
import { ProjectNav } from "./project-nav";
import { ThreadPanel } from "./thread-panel";
import { TopBar, type Panel } from "./top-bar";
import { useWorkspace } from "./use-workspace";
import type { ViewportId } from "./viewport";

function useOpenPanel() {
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const togglePanel = useCallback(
    (panel: Panel) => setOpenPanel((current) => (current === panel ? null : panel)),
    [],
  );
  const closePanel = useCallback(() => setOpenPanel(null), []);
  return { openPanel, setOpenPanel, togglePanel, closePanel };
}

export function Workspace({ initialDesign }: { initialDesign: Design }) {
  const workspace = useWorkspace(initialDesign);
  const [viewport, setViewport] = useState<ViewportId>("desktop");
  const { openPanel, setOpenPanel, togglePanel, closePanel } = useOpenPanel();
  const { design, target, view, run, selectedNodeId, selectNode, requestChange } = workspace;
  const running = run.status === "running";
  const hasSystem = design.system.length > 0;

  const selectFromCanvas = useCallback(
    (nodeId: string | null) => {
      selectNode(nodeId);
      if (nodeId) setOpenPanel("inspector");
    },
    [selectNode, setOpenPanel],
  );
  const showTarget = (shown: Target) => {
    closePanel();
    workspace.showTarget(shown);
  };
  const requestFromPanel = (request: string, nodeId: string | null) => {
    closePanel();
    requestChange(request, nodeId);
  };

  return (
    <div className="grid h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)]">
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
        openPanel={openPanel}
        onTogglePanel={togglePanel}
      />
      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[var(--container-panel)_minmax(0,1fr)] xl:grid-cols-[var(--container-panel)_minmax(0,1fr)_var(--container-inspector)]">
        <Drawer
          side="left"
          dockAt="lg"
          label="Project"
          open={openPanel === "project"}
          onClose={closePanel}
        >
          <ProjectNav
            pages={design.pages}
            target={target}
            canAddPage={hasSystem && !running}
            onShow={showTarget}
            onAddPage={(prompt) => {
              closePanel();
              workspace.createPage(prompt);
            }}
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
            onRequest={(request) => requestFromPanel(request, null)}
          />
        </Drawer>
        <Canvas
          design={view.render}
          viewport={viewport}
          selectedNodeId={selectedNodeId}
          running={running}
          onSelect={selectFromCanvas}
          onFixError={(message) => requestChange(`Fix this error: ${message}`, null)}
          onRenderError={workspace.reportRenderError}
        />
        <Drawer
          side="right"
          dockAt="xl"
          label="Inspector"
          open={openPanel === "inspector"}
          onClose={closePanel}
        >
          <InspectorPanel
            code={view.code}
            fileName={target.kind === "system" ? "components.tsx" : "Page.tsx"}
            tokens={view.tokens}
            selectedNodeId={selectedNodeId}
            changedNodeIds={view.changedNodeIds}
            running={running}
            onSelect={selectNode}
            onRequest={requestFromPanel}
          />
        </Drawer>
      </div>
    </div>
  );
}
