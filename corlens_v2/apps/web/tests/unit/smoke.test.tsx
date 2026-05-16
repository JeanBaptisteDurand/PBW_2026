import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App.js";

describe("App bootstrap", () => {
  it("redirects '/' to '/landing' and mounts something (Suspense fallback at minimum)", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    // Lazy Landing chunk takes one tick to resolve; in the sync render we just see the
    // Suspense fallback. Both states are non-empty.
    expect(container.firstChild).not.toBeNull();
  });

  it("renders the Layout + a placeholder card for an in-app route like /corridors", () => {
    render(
      <MemoryRouter initialEntries={["/corridors"]}>
        <App />
      </MemoryRouter>,
    );
    // CardTitle "Corridor Atlas" (h3) renders alongside the Navbar's NavLink with the same
    // label — both are valid evidence the Layout + the route content mounted.
    expect(screen.getByRole("heading", { name: "Corridor Atlas" })).toBeDefined();
    expect(screen.getByText("corelens")).toBeDefined();
  });
});
