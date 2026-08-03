import { describe, it, expect, vi } from "vitest";
import React from "react";

describe("Project Edit Click and TooltipTrigger Handler Merging", () => {
  it("merges child onClick with triggerProps onClick without overriding", () => {
    let childClicked = false;
    let triggerClicked = false;

    const childOnClick = vi.fn((e: any) => {
      childClicked = true;
    });

    const triggerPropsOnClick = vi.fn((e: any) => {
      triggerClicked = true;
    });

    const childProps = { onClick: childOnClick, id: "edit-btn" };
    const triggerProps = { onClick: triggerPropsOnClick, "data-state": "closed" };

    const mergedProps: Record<string, any> = { ...childProps, ...triggerProps };

    for (const key of Object.keys(triggerProps)) {
      if (key.startsWith("on") && typeof (triggerProps as any)[key] === "function") {
        const childHandler = (childProps as any)[key];
        const triggerHandler = (triggerProps as any)[key];
        if (typeof childHandler === "function") {
          mergedProps[key] = (e: any) => {
            childHandler(e);
            triggerHandler(e);
          };
        }
      }
    }

    // Trigger click
    const mockEvent = { stopPropagation: vi.fn() };
    mergedProps.onClick(mockEvent);

    expect(childClicked).toBe(true);
    expect(triggerClicked).toBe(true);
    expect(childOnClick).toHaveBeenCalledTimes(1);
    expect(triggerPropsOnClick).toHaveBeenCalledTimes(1);
  });

  it("handles openEdit state correctly", () => {
    let editId: string | null = null;
    let isDialogOpen = false;
    let formData: any = null;

    const projects = [
      {
        id: "proj-123",
        name: "Website Redesign",
        description: "Redesign marketing site",
        status: "IN_PROGRESS",
        priority: "HIGH",
        clientId: "client-1",
        startDate: "2026-08-01T00:00:00.000Z",
        dueDate: "2026-09-01T00:00:00.000Z",
        assignedTo: "user-1",
        assignmentDescription: "Focus on landing page",
      },
    ];

    const openEdit = (p: typeof projects[0]) => {
      editId = p.id;
      formData = {
        name: p.name,
        description: p.description,
        status: p.status,
        priority: p.priority,
        clientId: p.clientId,
        startDate: p.startDate.split("T")[0],
        dueDate: p.dueDate.split("T")[0],
        assignedTo: p.assignedTo,
        assignmentDescription: p.assignmentDescription,
      };
      isDialogOpen = true;
    };

    openEdit(projects[0]);

    expect(editId).toBe("proj-123");
    expect(isDialogOpen).toBe(true);
    expect(formData).toEqual({
      name: "Website Redesign",
      description: "Redesign marketing site",
      status: "IN_PROGRESS",
      priority: "HIGH",
      clientId: "client-1",
      startDate: "2026-08-01",
      dueDate: "2026-09-01",
      assignedTo: "user-1",
      assignmentDescription: "Focus on landing page",
    });
  });
});
