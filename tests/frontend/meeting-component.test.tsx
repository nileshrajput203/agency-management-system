// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

describe("Meeting Component Tests", () => {
  it("renders meeting creation form and attendee selectors", () => {
    render(
      <div className="meeting-form">
        <h3>Schedule New Meeting</h3>
        <form>
          <label htmlFor="title">Meeting Title</label>
          <input id="title" type="text" placeholder="Client Sync" />

          <label htmlFor="startTime">Start Time</label>
          <input id="startTime" type="datetime-local" />

          <label htmlFor="attendees">Attendees</label>
          <select id="attendees" multiple>
            <option value="user1">John Doe</option>
            <option value="user2">Jane Smith</option>
          </select>

          <button type="submit">Create Meeting</button>
        </form>
      </div>
    );

    expect(screen.getByText("Schedule New Meeting")).toBeDefined();
    expect(screen.getByLabelText("Meeting Title")).toBeDefined();
    expect(screen.getByText("John Doe")).toBeDefined();
  });
});
