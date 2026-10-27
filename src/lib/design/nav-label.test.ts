import { describe, expect, it } from "vitest";
import { navLabel } from "./nav-label";

describe("navLabel", () => {
  it.each([
    ["Checkout page", "Checkout"],
    ["A plant shop: a home page with featured plants", "Home"],
    ["A pricing page with three tiers and a FAQ", "Pricing"],
    ["An analytics dashboard with a sidebar, KPI cards and a table", "Analytics dashboard"],
    ["A mobile sign-up flow with email and social login", "Mobile sign-up"],
    ["About", "About"],
  ])("shortens %j to %j", (name, label) => {
    expect(navLabel(name)).toBe(label);
  });

  it("falls back to the page name when nothing is left", () => {
    expect(navLabel("The page")).toBe("The page");
  });
});
