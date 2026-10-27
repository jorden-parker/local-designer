import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Drawer } from "./drawer";

function renderDrawer(open: boolean) {
  const onClose = vi.fn();
  render(
    <Drawer side="left" dockAt="lg" open={open} label="Project" onClose={onClose}>
      <p>Pages</p>
    </Drawer>,
  );
  return onClose;
}

describe("Drawer", () => {
  it("keeps its content mounted but hidden while closed", () => {
    renderDrawer(false);
    const panel = screen.getByRole("complementary", { name: "Project", hidden: true });
    expect(panel.className).toContain("max-lg:invisible");
    expect(screen.getByText("Pages")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close panel" })).toBeNull();
  });

  it("shows the panel and a backdrop while open", () => {
    renderDrawer(true);
    const panel = screen.getByRole("complementary", { name: "Project" });
    expect(panel.className).not.toContain("max-lg:invisible");
    expect(screen.getByRole("button", { name: "Close panel" })).toBeTruthy();
  });

  it("closes from the backdrop and from Escape", async () => {
    const onClose = renderDrawer(true);
    await userEvent.click(screen.getByRole("button", { name: "Close panel" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("ignores Escape while closed", async () => {
    const onClose = renderDrawer(false);
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});
