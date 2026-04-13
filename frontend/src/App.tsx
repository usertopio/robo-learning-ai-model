import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BLOCKS } from './blocks';
import './index.css';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  ReactFlowProvider
} from '@xyflow/react';
import type { Connection, Edge, ReactFlowInstance, Node } from '@xyflow/react';
import CustomNode from './CustomNode';

const nodeTypes = { custom: CustomNode };



function AppContent() {
  const [activeCategory, setActiveCategory] = useState<'input' | 'model' | 'training' | 'output' | 'viz'>('input');
  const [isDark, setIsDark] = useState(true); // default to dark
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const [savedWorkspaces, setSavedWorkspaces] = useState<any[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [blockCounter, setBlockCounter] = useState(0);

  useEffect(() => { fetchWorkspaces(); }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/projects');
      const data = await res.json();
      setSavedWorkspaces(data);
    } catch (e) {
      console.error("Failed to fetch projects", e);
    }
  };

  const handleSave = async () => {
    try {
      const payload = { 
        name: `Project ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 
        flow_data: { nodes, edges },
        project_id: currentProjectId 
      };
      const res = await fetch('http://localhost:3000/api/save-flow', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const result = await res.json();
      if (result.project_id) setCurrentProjectId(result.project_id);
      fetchWorkspaces();
      alert("Project Saved!");
    } catch (e) { alert("Save failed. Is backend running?"); }
  };

  const handleLoadProject = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/projects/${id}/flow`);
      const data = await res.json();
      if (data.flow_data) {
        setNodes(data.flow_data.nodes || []);
        setEdges(data.flow_data.edges || []);
        setCurrentProjectId(id);
      }
    } catch (e) { alert("Load failed."); }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`http://localhost:3000/api/projects/${id}`, { method: 'DELETE' });
      if (currentProjectId === id) setCurrentProjectId(null);
      fetchWorkspaces();
    } catch(e) { alert("Delete failed."); }
  };

  const handleTrain = async () => {
    if (!currentProjectId) {
        alert("Please save your project first before training!");
        return;
    }
    try {
        const res = await fetch('http://localhost:3000/api/train/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: currentProjectId, hyperparams: {} })
        });
        const data = await res.json();
        alert(data.message);
    } catch (e) { alert("Train request failed."); }
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const startDragNewBlock = (e: React.DragEvent, defId: string) => {
    e.dataTransfer.setData('defId', defId);
  };

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const defId = event.dataTransfer.getData('defId');
      if (!defId || !reactFlowInstance || !reactFlowWrapper.current) {
        return;
      }

      // Find block definition
      let def: any = null;
      Object.values(BLOCKS).forEach(arr => {
          const found = arr.find(b => b.id === defId);
          if (found) def = found;
      });
      if (!def) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: `node_${blockCounter}`,
        type: 'custom',
        position,
        data: { def },
      };

      setNodes((nds) => nds.concat(newNode));
      setBlockCounter((prev) => prev + 1);
    },
    [reactFlowInstance, blockCounter, setNodes]
  );

  const categories = [
    { id: 'input', icon: '📷', label: 'Image Data', color: 'blue' },
    { id: 'model', icon: '🧠', label: 'AI Model', color: 'purple' },
    { id: 'output', icon: '📊', label: 'Results', color: 'emerald' },
    { id: 'training', icon: '⚙️', label: 'Training', color: 'amber' },
    { id: 'viz', icon: '📈', label: 'Visualization', color: 'rose' },
  ];

  const activeBlocks = BLOCKS[activeCategory] || [];
  const panelTitles: Record<string, string> = { input: '📷 Image Data Blocks', model: '🧠 AI Model Blocks', output: '📊 Output Blocks', training: '⚙️ Training Blocks', viz: '📈 Visualization Blocks' };

  return (
    <div className={`font-sans bg-[#F9FAFB] dark:bg-slate-950 text-slate-800 dark:text-slate-200 h-screen w-screen overflow-hidden flex flex-col ${isDark ? 'dark' : ''}`}>
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Icon Sidebar */}
        <nav className="w-[80px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-4 gap-1 shrink-0 transition-colors">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-1 shadow-lg shadow-indigo-500/20">R</div>
          <p className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mb-4 leading-tight text-center">Robo Learn AI</p>

          <button onClick={() => setIsDark(!isDark)} className="w-10 h-10 mb-4 rounded-xl shadow-inner bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-all">
             {isDark ? '☀️' : '🌙'}
          </button>

          {categories.map((cat, i) => (
            <React.Fragment key={cat.id}>
              {i === 0 && <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Input</p>}
              {i === 1 && <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-3 mb-1">AI Model</p>}
              {i === 2 && <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-3 mb-1">Output</p>}
              {i === 3 && <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-3 mb-1">Training</p>}
              {i === 4 && <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-3 mb-1">Visualization</p>}
              <button 
                onClick={() => setActiveCategory(cat.id as any)}
                className={`cat-btn w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 text-slate-500 dark:text-slate-400 transition-all ${activeCategory === cat.id ? 'active dark:bg-indigo-900/30 dark:text-indigo-400 dark:shadow-[inset_0_0_0_2px_#4F46E5]' : `hover:bg-${cat.color}-50 dark:hover:bg-slate-800 hover:text-${cat.color}-600 dark:hover:text-${cat.color}-400`}`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="text-[9px] font-medium">{cat.label}</span>
              </button>
            </React.Fragment>
          ))}
        </nav>

        {/* Block List Panel */}
        <aside className="w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden transition-colors">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Saved Workspaces</h3>
                <div className="flex gap-2">
                    <button onClick={handleSave} className="flex-1 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition">💾 Save State</button>
                </div>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {savedWorkspaces.map(ws => (
                        <div key={ws.id} className={`flex items-center justify-between px-2 py-1 text-[10px] border rounded transition-colors ${currentProjectId === ws.id ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                            <span className="truncate w-32 cursor-pointer text-slate-700 dark:text-slate-300 font-medium" onClick={() => handleLoadProject(ws.id)}>{ws.name}</span>
                            <button onClick={() => handleDelete(ws.id)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Delete</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">{panelTitles[activeCategory]}</h2>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Drag to workspace to spawn</p>
                {currentProjectId && (
                   <div className="mt-2 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded text-[9px] text-emerald-700 dark:text-emerald-400 font-bold">
                       Editing ID: {currentProjectId}
                   </div>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {activeBlocks.map(block => (
                    <div key={block.id} draggable onDragStart={(e) => startDragNewBlock(e, block.id)}
                         className={`block-card ${block.color} dark:bg-slate-800 dark:border-slate-700`}>
                        <span className="text-2xl">{block.icon}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{block.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{block.subtitle}</p>
                        </div>
                        <span className="badge bg-slate-200 dark:bg-slate-700 dark:text-slate-300">{block.badge}</span>
                    </div>
                ))}
            </div>

            {activeBlocks.length > 0 && activeBlocks[0].insight && (
                <div className="mx-3 mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl shrink-0 transition-colors">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1">💡 Math Insight</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1">{activeBlocks[0].insight.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{activeBlocks[0].insight.text}</p>
                    <code className="block text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 rounded px-2 py-1 mt-2 font-mono">{activeBlocks[0].insight.formula}</code>
                </div>
            )}
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
            <div className="flex-1 relative" ref={reactFlowWrapper}>
              <ReactFlow
                colorMode={isDark ? 'dark' : 'light'}
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                deleteKeyCode={['Delete', 'Backspace']}
                fitView
              >
                <Background color={isDark ? '#334155' : '#cbd5e1'} />
                <Controls className="dark:bg-slate-800 dark:border-slate-700 dark:fill-slate-200" />
              </ReactFlow>

              {nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                      <div className="text-center opacity-30">
                          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Drag blocks from sidebar to build your pipeline</p>
                      </div>
                  </div>
              )}
            </div>
            
            <div className="h-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 text-[11px] text-slate-400 dark:text-slate-500 shrink-0 transition-colors">
                <span>{nodes.length} blocks · {edges.length} connections</span>
                <span>📷 Input → 🧠 Model → 📊 Output</span>
            </div>
        </main>

        {/* Right Panel (Mock UI like vanilla) */}
        <aside className="w-[300px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden transition-colors">
             <div className="h-11 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">📊 Preview & Stats</h3>
                <span className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ready</span>
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div className="bg-slate-900 dark:bg-black rounded-xl overflow-hidden relative border-4 border-slate-800 dark:border-slate-900">
                    <div className="h-[130px] flex items-center justify-center">
                        <span className="text-slate-500 text-xs">Camera Output</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-2.5 text-center"><p className="text-[10px] text-indigo-400 font-medium">🟦 Epochs</p><p className="text-lg font-bold text-indigo-700 dark:text-indigo-400">0 / 0</p></div>
                    <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 rounded-xl p-2.5 text-center"><p className="text-[10px] text-rose-400 font-medium">🎯 Best Accuracy</p><p className="text-lg font-bold text-rose-600 dark:text-rose-400">0.0%</p></div>
                </div>
            </div>
        </aside>
      </div>

       <footer className="h-14 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 transition-colors">
            <div className="flex items-center gap-2"></div>
            <div className="flex gap-2">
                <button onClick={handleTrain} className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-500/20">▶ Train Model</button>
                <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-teal-500/20">🤖 Deploy to Robot</button>
            </div>
        </footer>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
}
