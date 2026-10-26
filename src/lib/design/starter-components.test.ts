import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadDesign } from "./load-design";
import { componentNames, reviewComponents } from "./review";
import { STARTER_COMPONENTS } from "./starter-components";

describe("STARTER_COMPONENTS", () => {
  it("passes the components review with no warnings", () => {
    expect(reviewComponents(STARTER_COMPONENTS)).toEqual({ errors: [], warnings: [] });
  });

  it("exports the core components and a Showcase that renders", () => {
    expect(componentNames(STARTER_COMPONENTS)).toEqual([
      "Button",
      "Card",
      "Input",
      "Badge",
      "Heading",
      "Text",
      "ImagePlaceholder",
    ]);
    const loaded = loadDesign({ code: STARTER_COMPONENTS, entry: "Showcase", components: null });
    expect(loaded.ok && renderToStaticMarkup(createElement(loaded.component))).toContain(
      "<h1 class=",
    );
  });
});
