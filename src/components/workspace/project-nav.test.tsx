import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectNav } from "./project-nav";

const PAGES = [
  { id: "p1", name: "Pricing" },
  { id: "p2", name: "Checkout" },
];

function renderNav(overrides: Partial<React.ComponentProps<typeof ProjectNav>> = {}) {
  const props = {
    pages: PAGES,
    target: { kind: "page" as const, pageId: "p1" },
    canAddPage: true,
    onShow: vi.fn(),
    onAddPage: vi.fn(),
    ...overrides,
  };
  render(<ProjectNav {...props} />);
  return props;
}

describe("ProjectNav", () => {
  it("marks the current target and opens another", async () => {
    const props = renderNav();
    expect(screen.getByRole("button", { name: "Pricing" }).getAttribute("aria-current")).toBe(
      "page",
    );
    await userEvent.click(screen.getByRole("button", { name: "Design system" }));
    expect(props.onShow).toHaveBeenCalledWith({ kind: "system" });
    await userEvent.click(screen.getByRole("button", { name: "Checkout" }));
    expect(props.onShow).toHaveBeenCalledWith({ kind: "page", pageId: "p2" });
  });

  it("adds a page from a description", async () => {
    const props = renderNav();
    await userEvent.click(screen.getByRole("button", { name: "New page" }));
    await userEvent.type(screen.getByPlaceholderText("Describe the page"), "An about page");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    expect(props.onAddPage).toHaveBeenCalledWith("An about page");
    expect(screen.queryByPlaceholderText("Describe the page")).toBeNull();
  });

  it("cannot add a page before the design system exists", () => {
    renderNav({ canAddPage: false, pages: [] });
    expect(screen.getByRole("button", { name: "New page" })).toHaveProperty("disabled", true);
  });
});
