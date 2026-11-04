// Shared behaviour for explorable SVG diagrams.
//
// Markup contract, on any element with [data-diagram]:
// - [data-step="id"] nodes, with aria-label (panel title) and data-detail
// - [data-edge-from][data-edge-to] edges and edge labels
// - optional buttons [data-diagram-trace="id"][data-steps="a b c"] with
//   data-title and data-detail
// - a panel [data-diagram-panel] holding [data-diagram-title] and
//   [data-diagram-desc]

type Focus = {
  key: string;
  lit: Set<string>;
  // A trace lights only the edges inside the path; a single step lights all of its edges.
  trace: boolean;
  title: string;
  detail: string;
};

// Works on first load and after Astro's client-side navigation, and binds
// each figure only once.
const setup = () => {
  for (const figure of document.querySelectorAll<HTMLElement>("[data-diagram]")) {
    if (figure.hasAttribute("data-diagram-ready")) continue;
    figure.setAttribute("data-diagram-ready", "true");

    const svg = figure.querySelector("svg");
    const panel = figure.querySelector("[data-diagram-panel]");
    const title = figure.querySelector("[data-diagram-title]");
    const description = figure.querySelector("[data-diagram-desc]");
    if (!svg || !panel || !title || !description) continue;

    const steps = [...svg.querySelectorAll<SVGElement>("[data-step]")];
    const edges = [...svg.querySelectorAll<SVGElement>("[data-edge-from]")];
    const traces = [...figure.querySelectorAll<HTMLButtonElement>("[data-diagram-trace]")];

    let focus: Focus | null = null;

    const isEdgeOn = (edge: SVGElement) => {
      if (!focus) return false;
      const from = focus.lit.has(edge.dataset.edgeFrom ?? "");
      const to = focus.lit.has(edge.dataset.edgeTo ?? "");
      return focus.trace ? from && to : from || to;
    };

    const render = () => {
      figure.toggleAttribute("data-focus", focus !== null);
      for (const step of steps) {
        const id = step.dataset.step ?? "";
        step.classList.toggle("is-on", focus?.lit.has(id) ?? false);
        step.setAttribute("aria-pressed", String(focus?.key === id));
      }
      for (const edge of edges) {
        edge.classList.toggle("is-on", isEdgeOn(edge));
      }
      for (const button of traces) {
        button.setAttribute(
          "aria-pressed",
          String(focus?.key === `trace:${button.dataset.diagramTrace}`),
        );
      }
      title.textContent = focus?.title ?? "";
      description.textContent = focus?.detail ?? "";
      panel.toggleAttribute("data-active", focus !== null);
    };

    // Choosing the same thing twice clears it.
    const toggle = (next: Focus) => {
      focus = focus?.key === next.key ? null : next;
      render();
    };

    for (const step of steps) {
      const id = step.dataset.step;
      if (!id) continue;

      const select = () =>
        toggle({
          key: id,
          lit: new Set([id]),
          trace: false,
          title: step.getAttribute("aria-label") ?? "",
          detail: step.dataset.detail ?? "",
        });

      step.addEventListener("click", select);
      step.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select();
      });
    }

    for (const button of traces) {
      button.addEventListener("click", () =>
        toggle({
          key: `trace:${button.dataset.diagramTrace}`,
          lit: new Set(button.dataset.steps?.split(" ")),
          trace: true,
          title: button.dataset.title ?? "",
          detail: button.dataset.detail ?? "",
        }),
      );
    }
  }
};

setup();
document.addEventListener("astro:page-load", setup);
