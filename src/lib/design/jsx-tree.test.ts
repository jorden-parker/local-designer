import { describe, expect, it } from "vitest";
import { componentTags, declaredNames, exportedNames } from "./jsx-tree";

const SOURCE = `import { Card as Box } from "./components";
const items = [1];
function Row() { return <li />; }
export function Button({ children }) { return <button>{children}</button>; }
export const Badge = () => <span />;
export default function Design() {
  return <main><Row /><Box /><Button /><Missing /><React.Fragment /></main>;
}`;

describe("jsx-tree names", () => {
  it("finds every name the module declares or imports", () => {
    expect([...declaredNames(SOURCE)].sort()).toEqual(
      ["Badge", "Box", "Button", "Design", "Row", "items"].sort(),
    );
  });

  it("finds the components a module renders", () => {
    expect([...componentTags(SOURCE)].sort()).toEqual(["Box", "Button", "Missing", "Row"]);
  });

  it("lists named exports", () => {
    expect(exportedNames(SOURCE)).toEqual(["Button", "Badge"]);
  });
});
