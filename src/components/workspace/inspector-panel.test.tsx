import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { annotate } from "@/lib/design/annotate";
import { DEFAULT_TOKENS } from "@/lib/design/tokens";
import { InspectorPanel } from "./inspector-panel";

const CODE = annotate(
  'export default function Design() {\n  return <main><h1 className="text-2xl">Hello</h1></main>;\n}',
);

describe("InspectorPanel", () => {
  it("shows the selected element and sends a change for just that element", async () => {
    const onRequest = vi.fn();
    render(
      <InspectorPanel
        code={CODE}
        fileName="Page.tsx"
        tokens={null}
        selectedNodeId="n2"
        changedNodeIds={[]}
        running={false}
        onSelect={() => {}}
        onRequest={onRequest}
      />,
    );
    expect(screen.getByText("<h1>")).toBeTruthy();
    expect(screen.getByText('<h1 className="text-2xl">Hello</h1>')).toBeTruthy();
    await userEvent.type(
      screen.getByLabelText("Describe a change to this element"),
      "Make it bold",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onRequest).toHaveBeenCalledWith("Make it bold", "n2");
  });

  it("invites a selection and shows the whole design without ids when nothing is selected", () => {
    render(
      <InspectorPanel
        code={CODE}
        fileName="Page.tsx"
        tokens={null}
        selectedNodeId={null}
        changedNodeIds={[]}
        running={false}
        onSelect={() => {}}
        onRequest={() => {}}
      />,
    );
    expect(screen.getByText("Select an element")).toBeTruthy();
    expect(screen.getByText(/export default function Design/).textContent).not.toContain(
      "data-node-id",
    );
  });

  it("selects an element from the tree", async () => {
    const onSelect = vi.fn();
    render(
      <InspectorPanel
        code={CODE}
        fileName="Page.tsx"
        tokens={null}
        selectedNodeId={null}
        changedNodeIds={[]}
        running={false}
        onSelect={onSelect}
        onRequest={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /h1.*Hello/ }));
    expect(onSelect).toHaveBeenCalledWith("n2");
  });

  it("clears the selection", async () => {
    const onSelect = vi.fn();
    render(
      <InspectorPanel
        code={CODE}
        fileName="Page.tsx"
        tokens={null}
        selectedNodeId="n2"
        changedNodeIds={[]}
        running={false}
        onSelect={onSelect}
        onRequest={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("shows the design tokens of a design system", () => {
    render(
      <InspectorPanel
        code={CODE}
        fileName="components.tsx"
        tokens={DEFAULT_TOKENS}
        selectedNodeId={null}
        changedNodeIds={[]}
        running={false}
        onSelect={() => {}}
        onRequest={() => {}}
      />,
    );
    expect(screen.getByText("components.tsx")).toBeTruthy();
    expect(screen.getByTitle("primary: #171717 light, #ededed dark")).toBeTruthy();
    expect(screen.getByText("Radius 4px · 8px · 12px · sans")).toBeTruthy();
  });
  it("offers the elements the viewed version changed", async () => {
    const onSelect = vi.fn();
    render(
      <InspectorPanel
        code={CODE}
        fileName="Page.tsx"
        tokens={null}
        selectedNodeId={null}
        changedNodeIds={["n2"]}
        running={false}
        onSelect={onSelect}
        onRequest={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Changed: <h1>" }));
    expect(onSelect).toHaveBeenCalledWith("n2");
  });
});
