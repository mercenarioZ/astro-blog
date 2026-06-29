import { useEffect, useId, useRef } from "react";

interface MermaidProps {
  chart: string;
  title?: string;
  wide?: boolean;
}

export const Mermaid = ({ chart, title, wide = false }: MermaidProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const diagramId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    let cancelled = false;

    const renderDiagram = async () => {
      const { default: mermaid } = await import("mermaid");

      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains("dark")
          ? "dark"
          : "default",
      });

      const { svg } = await mermaid.render(diagramId, chart.trim());

      if (!cancelled && ref.current) {
        ref.current.innerHTML = svg;

        const renderedSvg = ref.current.querySelector("svg");

        if (wide && renderedSvg) {
          renderedSvg.removeAttribute("width");
          renderedSvg.removeAttribute("height");
          renderedSvg.style.maxWidth = "none";
          renderedSvg.style.width = "max-content";
        }
      }
    };

    renderDiagram().catch(() => {
      if (ref.current) {
        ref.current.textContent = "Unable to render diagram.";
      }
    });

    return () => {
      cancelled = true;
    };
  }, [chart, diagramId, wide]);

  return (
    <div className="pb-6">
      <figure className="my-6 overflow-x-auto rounded-lg border border-slate-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div
          ref={ref}
          className={wide ? "inline-block min-w-[1020px]" : "w-full flex justify-center"}
        />
      </figure>

      {title && (
        <figcaption className="text-center text-sm opacity-70">
          {title}
        </figcaption>
      )}
    </div>
  );
};

export default Mermaid;
