import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ElementTree } from "./element-tree";

const NODES = [
  {
    nodeId: "n1",
    tag: "main",
    text: "",
    children: [
      {
        nodeId: "n2",
        tag: "h1",
        text: "Pricing plans for every team",
        children: [],
      },
      { nodeId: null, tag: "Button", text: "Go", children: [] },
    ],
  },
];

describe("ElementTree", () => {
  it("selects the element of a clicked row and marks the selected one", async () => {
    const onSelect = vi.fn();
    render(<ElementTree nodes={NODES} selectedNodeId="n1" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /main/, pressed: true })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /h1/ }));
    expect(onSelect).toHaveBeenCalledWith("n2");
  });

  it("disables rows that have no id", () => {
    render(<ElementTree nodes={NODES} selectedNodeId={null} onSelect={() => {}} />);
    expect((screen.getByRole("button", { name: /Button/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
