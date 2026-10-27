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
      "Nav",
    ]);
    const loaded = loadDesign({ code: STARTER_COMPONENTS, entry: "Showcase", components: null });
    expect(loaded.ok && renderToStaticMarkup(createElement(loaded.component))).toContain(
      "<h1 class=",
    );
  });

  it("renders Nav links from an array", () => {
    const code = `${STARTER_COMPONENTS}\nexport default function Page() { return <Nav links={["Home", "Pricing"]} />; }`;
    const loaded = loadDesign({ code, entry: "default", components: null });
    const html = loaded.ok ? renderToStaticMarkup(createElement(loaded.component)) : "";
    expect(html).toContain(">Home<");
    expect(html).toContain(">Pricing<");
  });
});
