import * as ReactDOMClient from "react-dom/client";
import { flushSync } from "react-dom";
import type { ReactElement } from "react";

let container: HTMLElement | null = null;
let root: ReactDOMClient.Root | null = null;

export function render(ui: ReactElement) {
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
    container = null;
    root = null;
  }
  container = document.createElement("div");
  document.body.appendChild(container);
  root = ReactDOMClient.createRoot(container);
  flushSync(() => {
    root!.render(ui);
  });
  return { container };
}

export const screen = {
  getByText: (text: string | RegExp) => {
    const all = Array.from(document.querySelectorAll("*"));
    const el = all.find((node) => {
      const content = node.textContent || "";
      if (typeof text === "string") {
        return content.includes(text);
      }
      return text.test(content);
    });
    if (!el) throw new Error(`Unable to find element with text: ${text}`);
    return el;
  },
  getByLabelText: (labelText: string) => {
    const labels = Array.from(document.querySelectorAll("label"));
    const label = labels.find((l) => (l.textContent || "").includes(labelText));
    if (label?.htmlFor) {
      const el = document.getElementById(label.htmlFor);
      if (el) return el;
    }
    const input = Array.from(document.querySelectorAll("input, textarea, select")).find((i) =>
      (i.getAttribute("placeholder") || "").includes(labelText)
    );
    if (input) return input;
    throw new Error(`Unable to find label/input: ${labelText}`);
  },
  getByRole: (role: string, options?: { name?: string }) => {
    const tag = role === "button" ? "button, [type=button], [type=submit]" : role;
    const all = Array.from(document.querySelectorAll(tag));
    if (options?.name) {
      const found = all.find((el) => (el.textContent || "").includes(options.name!));
      if (found) return found;
    } else if (all.length > 0) {
      return all[0];
    }
    throw new Error(`Unable to find role ${role}`);
  },
};
