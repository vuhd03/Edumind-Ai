
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MindMapNode } from '../types';

interface MindMapProps {
  data: MindMapNode;
}

const MindMap: React.FC<MindMapProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const tree = d3.tree<MindMapNode>().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    const root = d3.hierarchy(data);
    tree(root);

    // Links
    g.selectAll(".mindmap-link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "mindmap-link")
      .attr("d", d3.linkHorizontal<any, any>()
        .x(d => d.y)
        .y(d => d.x));

    // Nodes
    const nodes = g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", d => "node" + (d.children ? " node--internal" : " node--leaf"))
      .attr("transform", d => `translate(${d.y},${d.x})`);

    nodes.append("circle")
      .attr("r", 6)
      .attr("fill", d => d.children ? "#4f46e5" : "#10b981");

    nodes.append("text")
      .attr("dy", ".35em")
      .attr("x", d => d.children ? -10 : 10)
      .style("text-anchor", d => d.children ? "end" : "start")
      .attr("class", "text-xs font-medium fill-slate-700")
      .text(d => d.data.name);

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
    svg.call(zoom as any);

  }, [data]);

  return (
    <div className="w-full h-full bg-white rounded-xl shadow-inner border border-slate-200 overflow-hidden relative">
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs text-slate-500 border border-slate-100">
        Cuộn để phóng to/thu nhỏ • Kéo để di chuyển
      </div>
      <svg ref={svgRef} className="w-full h-full" viewBox="0 0 800 600"></svg>
    </div>
  );
};

export default MindMap;
