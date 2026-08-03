// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

describe("Login Component Tests", () => {
  it("renders login form with email and password fields", () => {
    render(
      <div className="login-card">
        <h1>Welcome Back</h1>
        <form>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" placeholder="email@agency.com" />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" placeholder="••••••••" />

          <button type="submit">Sign In</button>
        </form>
      </div>
    );

    expect(screen.getByText("Welcome Back")).toBeDefined();
    expect(screen.getByLabelText("Email")).toBeDefined();
    expect(screen.getByLabelText("Password")).toBeDefined();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeDefined();
  });
});
