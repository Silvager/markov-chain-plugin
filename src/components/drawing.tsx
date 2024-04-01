import React, { useCallback, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { nanoid } from "nanoid";

import { DrawingMode, Graph, Point, RubberBand } from "./graph";
import { Edge, GraphData, Node } from "../type";

import { DragIcon } from "./drawing/drag-icon";
import { NodeModal } from "./drawing/node-modal";

import SelectIcon from "../assets/select-icon.svg";
import AddNodeIcon from "../assets/add-node-icon.svg";
import AddEdgeIcon from "../assets/add-edge-icon.svg";
import DeleteIcon from "../assets/delete-icon.svg";

import "./drawing.scss";


interface Props {
  highlightNode?: Node,
  highlightLoopOnNode?: Node,
  highlightEdge?: Edge,
  highlightAllNextNodes: boolean;
  graph: GraphData;
  selectedNodeId?: string;
  animating: boolean;
  setGraph: React.Dispatch<React.SetStateAction<GraphData>>;
  setHighlightNode: React.Dispatch<React.SetStateAction<Node | undefined>>
  setSelectedNodeId: (id?: string, skipToggle?: boolean) => void;
}

export const Drawing = (props: Props) => {
  const {highlightNode, highlightLoopOnNode, highlightEdge, highlightAllNextNodes,
         graph, setGraph, setHighlightNode, setSelectedNodeId: _setSelectedNodeId, selectedNodeId, animating} = props;
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("select");
  const [firstEdgeNode, setFirstEdgeNode] = useState<Node|undefined>(undefined);
  const [rubberBand, setRubberBand] = useState<RubberBand|undefined>(undefined);
  const [selectedNodeForModal, setSelectedNodeForModal] = useState<Node|undefined>(undefined);

  const setSelectedNodeId = useCallback((id?: string, skipToggle?: boolean) => {
    if (drawingMode === "select") {
      _setSelectedNodeId(id, skipToggle);
    }
  }, [drawingMode, _setSelectedNodeId]);

  const sidebarRef = useRef<HTMLDivElement|null>(null);

  const translateToGraphPoint = (e: MouseEvent|React.MouseEvent<HTMLDivElement>): Point => {
    return {
      x: e.clientX - (sidebarRef?.current?.clientWidth || 0),
      y: e.clientY - (sidebarRef?.current?.clientTop || 0)
    };
  };

  const getNode = useCallback((id: string) => graph.nodes.find(n => n.id === id), [graph.nodes]);

  const clearSelections = useCallback(() => {
    setFirstEdgeNode(undefined);
    setHighlightNode(undefined);
    setRubberBand(undefined);
  }, [setFirstEdgeNode, setHighlightNode]);

  useEffect(() => {
    if (drawingMode === "addEdge" && firstEdgeNode) {
      const updateRubberBand = (e: MouseEvent) => {
        const newRubberBand: RubberBand = {from: firstEdgeNode.id, to: translateToGraphPoint(e)};
        setRubberBand(newRubberBand);
      };
      window.addEventListener("mousemove", updateRubberBand);
      return () => window.removeEventListener("mousemove", updateRubberBand);
    }
  }, [drawingMode, firstEdgeNode]);

  useEffect(() => {
    const listenForEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelections();
        setDrawingMode("select");
      }
    };
    window.addEventListener("keydown", listenForEscape);
    return () => window.removeEventListener("keydown", listenForEscape);
  }, [drawingMode, setDrawingMode, clearSelections]);

  const handleSetSelectMode = useCallback(() => {
    setDrawingMode("select");
    clearSelections();
  }, [setDrawingMode, clearSelections]);
  const handleSetAddNodeMode = useCallback(() => {
    setDrawingMode("addNode");
    clearSelections();
  }, [setDrawingMode, clearSelections]);
  const handleSetAddEdgeMode = useCallback(() => {
    setDrawingMode("addEdge");
    clearSelections();
  }, [setDrawingMode, clearSelections]);
  const handleSetDeleteMode = useCallback(() => {
    setDrawingMode("delete");
    clearSelections();
  }, [setDrawingMode, clearSelections]);

  const addNode = useCallback(({x, y}: {x: number, y: number}) => {
    setGraph(prev => {
      const id = nanoid();
      const label = `State ${prev.nodes.length + 1}`;
      const newNode: Node = {id, label, value: 1, x, y};
      return {
        nodes: [...prev.nodes, newNode],
        edges: prev.edges
      };
    });
  }, [setGraph]);

  const addEdge = useCallback(({from, to}: {from: string, to: string}) => {
    setGraph(prev => {
      const newEdge: Edge = {from, to, value: 1};
      const prevEdge = prev.edges.find(e => e.from === from && e.to === to);
      if (!prevEdge) {
        return {
          nodes: prev.nodes,
          edges: [...prev.edges, newEdge]
        };
      } else {
        return prev;
      }
    });
  }, [setGraph]);

  const handleClicked = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (drawingMode === "addNode") {
      addNode(translateToGraphPoint(e));
      handleSetSelectMode();
    } else if (drawingMode === "addEdge") {
      const onSVGBackground = ((e.target as HTMLElement)?.tagName || "").toLowerCase() === "svg";
      if (onSVGBackground) {
        clearSelections();
        handleSetSelectMode();
      }
    }
  }, [drawingMode, addNode, handleSetSelectMode, clearSelections]);

  // allow nodes to be "dragged" from the toolbar to the canvas
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (drawingMode === "addNode") {
      handleClicked(e);
      e.preventDefault();
      e.stopPropagation();
    }
  }, [drawingMode, handleClicked]);

  const handleNodeClicked = useCallback((id: string, onLoop?: boolean) => {
    const node = getNode(id);
    if (!node) {
      return;
    }

    if (drawingMode === "addEdge" && !onLoop) {
      if (!firstEdgeNode) {
        setFirstEdgeNode(node);
      } else {
        addEdge({from: firstEdgeNode.id, to: node.id});
        handleSetSelectMode();
      }
    }

    if (drawingMode === "delete") {
      setGraph(prev => {
        const nodes = [...prev.nodes];
        let edges = [...prev.edges];

        if (onLoop) {
          // delete the self-referential edge
          const edgeIndex = edges.findIndex(e => e.from === id && e.to === id);
          if (edgeIndex !== -1) {
            edges.splice(edgeIndex, 1);
          }

        } else {
          const nodeIndex = nodes.findIndex(n => n.id === id);
          if (nodeIndex !== -1) {
            nodes.splice(nodeIndex, 1);
            edges = edges.filter(e => e.from !== node.id && e.to !== node.id);
          }
        }

        return {
          nodes,
          edges
        };
      });
      handleSetSelectMode();
    }
  }, [addEdge, drawingMode, getNode, firstEdgeNode, setFirstEdgeNode, setGraph, handleSetSelectMode]);

  const handleNodeDoubleClicked = useCallback((id: string) => {
    if (drawingMode === "select") {
      setSelectedNodeForModal(getNode(id));
    }
    if (drawingMode === "addEdge") {
      addEdge({from: id, to: id});
      handleSetSelectMode();
    }
  }, [drawingMode, addEdge, handleSetSelectMode, getNode]);

  const handleEdgeClicked = useCallback(({from, to}: {from: string, to: string}) => {
    if (drawingMode === "delete") {
      setGraph(prev => {
        const edges = [...prev.edges];
        const edgeIndex = prev.edges.findIndex(e => e.from === from && e.to === to);
        if (edgeIndex !== -1) {
          edges.splice(edgeIndex, 1);
          return {...prev, edges};
        } else {
          return prev;
        }
      });
      handleSetSelectMode();
    }
  }, [setGraph, drawingMode, handleSetSelectMode]);

  const handleDragStop = useCallback((id: string, {x, y}: Point) => {
    setGraph(prev => {
      const nodeIndex = prev.nodes.findIndex(n => n.id === id);
      if (nodeIndex !== -1) {
        const node = {...prev.nodes[nodeIndex]};
        const nodes = [...prev.nodes];
        node.x = x;
        node.y = y;
        nodes.splice(nodeIndex, 1, node);
        return {...prev, nodes};
      }
      return prev;
    });
  }, [setGraph]);

  const handleClearSelectedNode = useCallback(() => setSelectedNodeForModal(undefined), [setSelectedNodeForModal]);

  const handleChangeNode = useCallback((id: string, newNode: Node, newEdges: Edge[]) => {
    setGraph(prev => {
      const nodeIndex = prev.nodes.findIndex(n => n.id === id);
      if (nodeIndex !== -1) {
        const nodes = [...prev.nodes];
        nodes.splice(nodeIndex, 1, newNode);
        return { nodes, edges: newEdges };
      } else {
        return prev;
      }
    });
    handleClearSelectedNode();
  }, [setGraph, handleClearSelectedNode]);

  return (
    <div className="drawing">
      <div className="sidebar" ref={sidebarRef}>
        <button
          title="Select Mode"
          onClick={handleSetSelectMode}
          className={clsx({selected: drawingMode === "select"})}
        >
          <SelectIcon />
        </button>
        <button
          title="Add State"
          onMouseDown={handleSetAddNodeMode}
          className={clsx({selected: drawingMode === "addNode"})}
        >
          <AddNodeIcon />
        </button>
        <button
          title="Add Transition"
          onClick={handleSetAddEdgeMode}
          className={clsx({selected: drawingMode === "addEdge"})}
        >
          <AddEdgeIcon />
        </button>
        <button
          title="Delete Mode"
          onClick={handleSetDeleteMode}
          className={clsx({selected: drawingMode === "delete"})}
        >
          <DeleteIcon />
        </button>
      </div>
      <Graph
        mode="drawing"
        drawingMode={drawingMode}
        graph={graph}
        highlightNode={highlightNode}
        highlightEdge={highlightEdge}
        highlightAllNextNodes={highlightAllNextNodes}
        highlightLoopOnNode={highlightLoopOnNode}
        allowDragging={drawingMode === "select" && !animating}
        autoArrange={false}
        rubberBand={rubberBand}
        selectedNodeId={selectedNodeId}
        animating={animating}
        onClick={handleClicked}
        onMouseUp={handleMouseUp}
        onNodeClick={handleNodeClicked}
        onNodeDoubleClick={handleNodeDoubleClicked}
        onEdgeClick={handleEdgeClicked}
        onDragStop={handleDragStop}
        setSelectedNodeId={setSelectedNodeId}
      />
      <DragIcon drawingMode={drawingMode} />
      <NodeModal
        node={selectedNodeForModal}
        graph={graph}
        onChange={handleChangeNode}
        onCancel={handleClearSelectedNode}
      />
    </div>
  );
};

