import { describe, expect, it } from "vitest";
import { slug } from "./slug";

describe("slug", () => {
  it("joins words with dashes and falls back when nothing is left", () => {
    expect(slug(" Pricing & FAQ! ", "page")).toBe("pricing-faq");
    expect(slug("!!!", "page")).toBe("page");
  });
});
