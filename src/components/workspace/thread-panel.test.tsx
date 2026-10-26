import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThreadPanel } from "./thread-panel";

const META = { model: "granite4.2-3b-cc" };

const VERSIONS = [
  { ...META, number: 1, request: "A pricing page", nodeId: null },
  { ...META, number: 2, request: "Bigger cards", nodeId: "n4" },
];

function renderThread(overrides: Partial<React.ComponentProps<typeof ThreadPanel>> = {}) {
  const props = {
    subject: "this page",
    versions: VERSIONS,
    viewed: VERSIONS[1],
    latest: VERSIONS[1],
    run: { status: "idle" as const },
    onView: vi.fn(),
    onRestore: vi.fn(),
    onStop: vi.fn(),
    onRequest: vi.fn(),
    ...overrides,
  };
  render(<ThreadPanel {...props} />);
  return props;
}

describe("ThreadPanel", () => {
  it("lists every version and restores an older one", async () => {
    const props = renderThread();
    expect(screen.getByPlaceholderText("Describe a change to this page")).toBeTruthy();
    expect(screen.getByText("Bigger cards")).toBeTruthy();
    expect(screen.getByText("Element")).toBeTruthy();
    const restoreButtons = screen.getAllByRole("button", { name: "Restore" });
    expect(restoreButtons).toHaveLength(1);
    await userEvent.click(restoreButtons[0]);
    expect(props.onRestore).toHaveBeenCalledWith(1);
  });

  it("says when a change will build on an older version", () => {
    renderThread({ viewed: VERSIONS[0] });
    expect(screen.getByText("Changes will build on version 1.")).toBeTruthy();
  });

  it("shows a failed run with its error", () => {
    renderThread({
      run: {
        status: "failed",
        output: "",
        request: "Add a footer",
        error: "Model is not installed",
      },
    });
    expect(screen.getByText("Model is not installed")).toBeTruthy();
  });
});
