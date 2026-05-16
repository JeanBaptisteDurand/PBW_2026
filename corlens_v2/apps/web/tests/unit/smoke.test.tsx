import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App.js";

describe("App bootstrap", () => {
  it("renders the LandingPlaceholder card at /landing", () => {
    render(
      <MemoryRouter initialEntries={["/landing"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("corlens v2")).toBeDefined();
    expect(screen.getByText(/SPA bootstrap OK/)).toBeDefined();
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
