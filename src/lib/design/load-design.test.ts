import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadDesign } from "./load-design";

const COMPONENTS =
  'export function Button({ className = "", ...props }) { return <button className={`btn ${className}`} {...props} />; }\nexport function Showcase() { return <Button>Go</Button>; }';

function rendered(loaded: ReturnType<typeof loadDesign>) {
  return loaded.ok ? renderToStaticMarkup(createElement(loaded.component)) : loaded.error;
}

const page = (code: string) => ({ code, entry: "default" as const, components: null });

describe("loadDesign", () => {
  it("runs compiled code and returns the default export", () => {
    const loaded = loadDesign(
      page("export default function Page() { const [n] = React.useState(2); return <p>{n}</p>; }"),
    );
    expect(rendered(loaded)).toBe("<p>2</p>");
  });

  it("puts the design system's components in scope and behind ./components", () => {
    const code =
      'import { Button as B } from "./components";\nexport default function Page() { const Local = () => <i />; return <main><Button>A</Button><B>B</B><Local /></main>; }';
    expect(rendered(loadDesign({ code, entry: "default", components: COMPONENTS }))).toBe(
      '<main><button class="btn ">A</button><button class="btn ">B</button><i></i></main>',
    );
  });

  it("renders the Showcase of a components file", () => {
    expect(rendered(loadDesign({ code: COMPONENTS, entry: "Showcase", components: null }))).toBe(
      '<button class="btn ">Go</button>',
    );
  });

  it("lets a page define a component with the same name as one in the design system", () => {
    const code =
      "const Button = () => <b />;\nexport default function Page() { return <Button />; }";
    expect(rendered(loadDesign({ code, entry: "default", components: COMPONENTS }))).toBe(
      "<b></b>",
    );
  });

  it("reports compile errors, other imports, runtime errors and a missing entry", () => {
    expect(loadDesign(page("export default function D() { return <p>; }")).ok).toBe(false);
    expect(rendered(loadDesign(page('import x from "lodash";\nexport default () => x;')))).toBe(
      'Only React and ./components can be imported, not "lodash".',
    );
    expect(rendered(loadDesign(page("throw new Error('top');")))).toBe("top");
    expect(rendered(loadDesign(page("export const A = 1;")))).toBe(
      'Nothing is exported as "default".',
    );
    expect(
      rendered(loadDesign({ code: "", entry: "default", components: "throw new Error('x');" })),
    ).toBe("The design system failed: x");
  });
});
