import { describe, expect, it } from "vitest";
import { fakeModel, fenced } from "@/test/fake-model";
import { annotate } from "./annotate";
import { pageChange } from "./page-change";

const COMPONENTS = annotate(
  'export function Button({ className = "", ...props }) { return <button className={`bg-primary ${className}`} {...props} />; }\nexport function Showcase() { return <Button>Go</Button>; }',
);
const PAGE =
  "export default function Page() {\n  return <main><h1>Old</h1><Button>Buy</Button></main>;\n}";

const change = (overrides = {}) => ({
  brief: "a shop",
  request: "a pricing page",
  nodeId: null,
  baseCode: null,
  components: COMPONENTS,
  otherPages: [],
  ...overrides,
});

describe("pageChange", () => {
  it("drafts a page with the design system's components in the prompt", async () => {
    const { stream, requests } = fakeModel([fenced(PAGE)]);
    await expect(pageChange(stream, change(), () => {})).resolves.toBe(
      annotate(PAGE, "elements-and-components"),
    );
    expect(requests[0].system).toContain("use them without importing: Button.");
    expect(requests[0].system).toContain("bg-primary");
    expect(requests[0].system).not.toContain("data-node-id");
    expect(requests[0].messages[0].content).toContain("a shop");
  });

  it("tells the model which other pages exist when drafting a new page", async () => {
    const { stream, requests } = fakeModel([fenced(PAGE)]);
    const otherPages = ["A plant shop: a home page with featured plants", "Checkout page"];
    await pageChange(stream, change({ otherPages }), () => {});
    const content = requests[0].messages[0].content;
    expect(content).toContain(
      'Other pages: "A plant shop: a home page with featured plants", "Checkout page".',
    );
    expect(content).toContain(`<Nav links={["Home", "Checkout"]} />`);
  });

  it("says nothing about other pages when there are none", async () => {
    const { stream, requests } = fakeModel([fenced(PAGE)]);
    await pageChange(stream, change(), () => {});
    expect(requests[0].messages[0].content).not.toContain("Other pages");
  });

  it("asks for a repair when the page uses a component that does not exist", async () => {
    const invented = PAGE.replace("<Button>Buy</Button>", "<Hero />");
    const { stream, requests } = fakeModel([fenced(invented), fenced(PAGE)]);
    await expect(pageChange(stream, change(), () => {})).resolves.toBe(
      annotate(PAGE, "elements-and-components"),
    );
    expect(requests[1].messages.at(-1)?.content).toContain("Hero");
  });

  it("rewrites only the selected element and keeps its id", async () => {
    const { stream, requests } = fakeModel([fenced('<h1 className="text-4xl">New</h1>')]);
    const code = await pageChange(
      stream,
      change({ request: "bigger", nodeId: "n2", baseCode: annotate(PAGE) }),
      () => {},
    );
    expect(code).toContain('<h1 data-node-id="n2" className="text-4xl">New</h1>');
    expect(requests[0].system).toContain("in scope: Button.");
    expect(requests[0].messages[0].content).not.toContain("data-node-id");
  });

  it("wraps sibling elements that replace one element in a fragment", async () => {
    const { stream, requests } = fakeModel([fenced("<h1>New</h1>\n<Button>Sale</Button>")]);
    const code = await pageChange(
      stream,
      change({ request: "add a badge", nodeId: "n2", baseCode: annotate(PAGE) }),
      () => {},
    );
    expect(code).toContain("<>\n<h1");
    expect(requests).toHaveLength(1);
  });

  it("accepts a whole page when the model replies with one instead of an element", async () => {
    const whole = PAGE.replace("Old", "Whole");
    const { stream } = fakeModel([fenced(whole)]);
    const code = await pageChange(
      stream,
      change({ request: "rename", nodeId: "n2", baseCode: annotate(PAGE) }),
      () => {},
    );
    expect(code).toContain(">Whole</h1>");
  });

  it("does not delete the element when the reply is empty", async () => {
    const { stream } = fakeModel(["", ""]);
    await expect(
      pageChange(stream, change({ nodeId: "n2", baseCode: annotate(PAGE) }), () => {}),
    ).rejects.toThrow("The reply has no element");
  });

  it("refuses an element that is not in the page", async () => {
    const { stream } = fakeModel([]);
    await expect(
      pageChange(stream, change({ nodeId: "n9", baseCode: annotate(PAGE) }), () => {}),
    ).rejects.toThrow("The selected element is no longer in this version");
  });
});
