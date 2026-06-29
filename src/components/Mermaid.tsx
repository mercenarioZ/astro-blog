import { useEffect, useId, useRef } from "react";

interface MermaidProps {
  chart: string;
  title?: string;
}

export const Mermaid = ({ chart, title }: MermaidProps) => {
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
  }, [chart, diagramId]);

  return (
    <figure className="my-8 overflow-x-auto rounded-lg border border-slate-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div ref={ref} className="min-w-[520px]" />
      {title && (
        <figcaption className="mt-3 text-center text-sm opacity-70">
          {title}
        </figcaption>
      )}
    </figure>
  );
};

export default Mermaid;
