import { describe, expect, it } from "vitest";
import { reviewComponents, reviewPage } from "./review";

const PAGE = `export default function Design() {
  return <main className="bg-background"><Card><Button>Go</Button></Card></main>;
}`;

const COMPONENTS = `export function Button({ className = "", ...props }) {
  return <button className={"bg-primary text-primary-foreground " + className} {...props} />;
}
export function Showcase() { return <Button>Example</Button>; }`;

describe("reviewPage", () => {
  it("accepts a page that uses only existing components and token colors", () => {
    expect(reviewPage(PAGE, ["Card", "Button"])).toEqual({ errors: [], warnings: [] });
  });

  it("reports components that do not exist", () => {
    expect(reviewPage(PAGE, ["Button"]).errors).toEqual([
      "These components do not exist: Card. Use only Button, plain HTML elements, components you define in this file.",
    ]);
  });

  it("requires a default export and code that compiles", () => {
    expect(reviewPage("function A() { return <div />; }", []).errors).toEqual([
      "The page must be the default export.",
    ]);
    expect(reviewPage("export default function A() { return <div>; }", []).errors[0]).toMatch(
      /\(\d+:\d+\)/,
    );
  });

  it("warns about colors that are not design tokens", () => {
    const page = PAGE.replace("bg-background", "bg-gray-200 text-blue-500 bg-gray-200");
    expect(reviewPage(page, ["Card", "Button"]).warnings).toEqual([
      expect.stringContaining("Replace bg-gray-200, text-blue-500 with design token classes"),
    ]);
  });
});

describe("reviewComponents", () => {
  it("accepts a library that exports a Showcase", () => {
    expect(reviewComponents(COMPONENTS)).toEqual({ errors: [], warnings: [] });
  });

  it("requires a Showcase and no default export", () => {
    expect(reviewComponents("export function Button() { return <button />; }").errors).toEqual([
      "The file must export a Showcase component that renders every component.",
    ]);
  });

  it("reports components that the library uses but never defines", () => {
    const source = COMPONENTS.replace("<Button>Example</Button>", "<Tabs />");
    expect(reviewComponents(source).errors).toEqual([
      "These components do not exist: Tabs. Use only plain HTML elements, components you define in this file.",
    ]);
  });
});
