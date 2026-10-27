import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "./top-bar";

function renderBar(overrides: Partial<React.ComponentProps<typeof TopBar>> = {}) {
  const props = {
    designId: "d",
    title: "Plant shop",
    canHandOff: true,
    viewport: "desktop" as const,
    onViewport: vi.fn(),
    mode: "light" as const,
    onMode: vi.fn(),
    models: ["granite", "qwen"],
    model: "granite",
    onModel: vi.fn(),
    openPanel: null,
    onTogglePanel: vi.fn(),
    ...overrides,
  };
  render(<TopBar {...props} />);
  return props;
}

describe("TopBar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("switches the viewport, the preview theme and the model", async () => {
    const props = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Mobile" }));
    expect(props.onViewport).toHaveBeenCalledWith("mobile");
    await userEvent.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(props.onMode).toHaveBeenCalledWith("dark");
    await userEvent.selectOptions(screen.getByLabelText("Model"), "qwen");
    expect(props.onModel).toHaveBeenCalledWith("qwen");
  });

  it("goes back to the light theme", async () => {
    const props = renderBar({ mode: "dark" });
    await userEvent.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(props.onMode).toHaveBeenCalledWith("light");
  });

  it("copies the Claude Code prompt and links the handoff zip", async () => {
    const writeText = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("the prompt")),
    );
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Copy prompt" }));
    expect(writeText).toHaveBeenCalledWith("the prompt");
    expect(screen.getByText("Copied")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Handoff" }).getAttribute("href")).toBe(
      "/api/designs/d/handoff",
    );
  });

  it("toggles the project and inspector panels", async () => {
    const props = renderBar({ openPanel: "inspector" });
    const project = screen.getByRole("button", { name: "Project" });
    const inspector = screen.getByRole("button", { name: "Inspector" });
    expect(project.getAttribute("aria-expanded")).toBe("false");
    expect(inspector.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(project);
    expect(props.onTogglePanel).toHaveBeenCalledWith("project");
    await userEvent.click(inspector);
    expect(props.onTogglePanel).toHaveBeenCalledWith("inspector");
  });

  it("cannot hand off before there is a design system", () => {
    renderBar({ canHandOff: false });
    expect(screen.getByRole("button", { name: "Copy prompt" })).toHaveProperty("disabled", true);
  });
});
