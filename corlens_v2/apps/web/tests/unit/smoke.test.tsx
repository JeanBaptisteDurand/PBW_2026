import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App.js";

describe("App bootstrap", () => {
  it("renders the bootstrap page on any route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("corlens v2")).toBeDefined();
    expect(screen.getByText("SPA bootstrap OK")).toBeDefined();
  });
});
