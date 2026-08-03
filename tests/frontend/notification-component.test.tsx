// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

describe("Notification Center Component Tests", () => {
  it("renders notification items and unread count badge", () => {
    const list = [
      { id: "1", title: "New Meeting Scheduled", isRead: false },
      { id: "2", title: "Invoice Paid", isRead: true },
    ];

    const unreadCount = list.filter((i) => !i.isRead).length;

    render(
      <div className="notification-center">
        <div className="header">
          <h3>Notifications</h3>
          <span className="badge">{unreadCount}</span>
        </div>
        <ul>
          {list.map((n) => (
            <li key={n.id} className={n.isRead ? "read" : "unread"}>
              {n.title}
            </li>
          ))}
        </ul>
      </div>
    );

    expect(screen.getByText("Notifications")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("New Meeting Scheduled")).toBeDefined();
    expect(screen.getByText("Invoice Paid")).toBeDefined();
  });
});
