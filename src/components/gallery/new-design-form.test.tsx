import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewDesignForm } from "./new-design-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("NewDesignForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it("creates a design from an example and opens it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: "abc" }, { status: 201 })),
    );
    render(<NewDesignForm />);
    await userEvent.click(screen.getByText("A pricing page with three tiers and a FAQ"));
    await userEvent.click(screen.getByRole("button", { name: "Start designing" }));
    expect(push).toHaveBeenCalledWith("/d/abc");
  });

  it("shows why a design could not be created", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Describe the screen you want" }, { status: 400 })),
    );
    render(<NewDesignForm />);
    await userEvent.type(screen.getByLabelText("Describe a screen"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Start designing" }));
    expect(await screen.findByText("Describe the screen you want")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
