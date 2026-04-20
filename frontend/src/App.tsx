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
import { io } from 'socket.io-client';
import type { Connection, Edge, ReactFlowInstance, Node } from '@xyflow/react';
import CustomNode from './CustomNode';
import RobotStreamNode from './RobotStreamNode';
import WebcamStreamNode from './WebcamStreamNode';
import MonitorNode from './MonitorNode';

const nodeTypes = { 
  custom: CustomNode, 
  'robot-stream': RobotStreamNode,
  'webcam-stream': WebcamStreamNode,
  'monitor-node': MonitorNode
};

// Initialize Socket.IO outside or in a ref to persist across re-renders
const socket = io('http://localhost:3000');
(window as any).socket = socket; // Expose globally for nodes

function AppContent() {
  // --- UI States ---
  const [activeCategory, setActiveCategory] = useState<'input' | 'model' | 'training' | 'output' | 'viz'>('input');
  const [isDark, setIsDark] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const settingsRef = useRef<HTMLDivElement>(null);

  // --- Auth & User States ---
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // --- Flow States ---
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [loadingProjectId, setLoadingProjectId] = useState<number | null>(null);
  const [blockCounter, setBlockCounter] = useState(1);
  const [savedWorkspaces, setSavedWorkspaces] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- AI & Stream States ---
  const [isAiSystemRunning, setIsAiSystemRunning] = useState(false);
  const [monitorPoweredOn, setMonitorPoweredOn] = useState(false);
  const [aiProcessedFrame, setAiProcessedFrame] = useState<string | null>(null);
  const [activeMonitorFrame, setActiveMonitorFrame] = useState<string | null>(null);
  const [frameHistory, setFrameHistory] = useState<string[]>([]);
  const [targetClasses, setTargetClasses] = useState('person, dog, cat, car');
  const [modelVariant, setModelVariant] = useState('YOLO11 Nano');
  const [trainingProgress, setTrainingProgress] = useState({ epoch: 0, loss: 0, val_loss: 0, status: 'idle' });

  // --- Socket Sync Hook (Concept) ---
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => console.log('✅ Connected to AI Server');
    const handleStream = (image: string) => {
      setAiProcessedFrame(image);
      setFrameHistory(prev => [...prev.slice(-29), image]);
    };
    const handleTraining = (data: any) => {
      setTrainingProgress(prev => data.status ? { ...prev, ...data } : { ...data, status: 'training' });
    };
    const handleWebcam = (image: string) => {
      setActiveMonitorFrame(image);
    };
    const handleParams = (data: any) => {
      if (data.label === 'Model Variant') setModelVariant(data.value);
    };

    socket.on('connect', handleConnect);
    socket.on('stream_to_web', handleStream);
    socket.on('ai_training_progress', handleTraining);
    socket.on('ai_webcam_frame', handleWebcam);
    socket.on('ai_params_sync', handleParams);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('stream_to_web', handleStream);
      socket.off('ai_training_progress', handleTraining);
      socket.off('ai_webcam_frame', handleWebcam);
      socket.off('ai_params_sync', handleParams);
    };
  }, []);

  // Sync flow topology
  useEffect(() => {
    socket.emit('flow_topology_update', { nodes, edges });
  }, [nodes, edges]);

  // Sync AI control params
  useEffect(() => {
    socket.emit('update_search_classes', targetClasses);
    socket.emit('ai_system_toggle', { running: isAiSystemRunning });
  }, [targetClasses, isAiSystemRunning]);

  // Sync processing room
  useEffect(() => {
    if (monitorPoweredOn || isAiSystemRunning) {
      socket.emit('join_robot_room', 'WEBCAM_PROCESSED');
    }
  }, [monitorPoweredOn, isAiSystemRunning]);

  useEffect(() => { 
    if (token) {
        setUser({ username: 'User' });
        fetchWorkspaces();
    }
  }, [token]);

  // ปิด Settings popup เมื่อคลิกที่อื่นนอก popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    if (showSettings) {
      // ใช้ capture=true เพื่อให้รับ event ก่อน ReactFlow จะกิน event
      document.addEventListener('mousedown', handleClickOutside, true);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [showSettings]);

  const onSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    setSelectedNode(nodes.length > 0 ? nodes[0] : null);
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/projects', {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSavedWorkspaces(data);
    } catch (e) { console.error("Fetch failed", e); }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? 'login' : 'register';
    try {
        const res = await fetch(`http://localhost:3000/api/auth/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            if (authMode === 'login') {
                localStorage.setItem('token', data.token);
                setToken(data.token);
                setUser(data.user);
            } else {
                alert("Registered! Now please login.");
                setAuthMode('login');
            }
        } else {
            alert(data.error);
        }
    } catch (e) { alert("Auth failed"); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSavedWorkspaces([]);
    setNodes([]);
    setEdges([]);
    setCurrentProjectId(null);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const payload = { 
        name: `Workspace ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`, 
        flow_data: { nodes, edges },
        project_id: currentProjectId 
      };
      
      const res = await fetch('http://localhost:3000/api/save-flow', { 
        method: 'POST', 
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }, 
        body: JSON.stringify(payload) 
      });
      
      const result = await res.json();
      
      if (!res.ok) {
          throw new Error(result.error || 'Failed to save to database');
      }
      
      if (result.project_id) setCurrentProjectId(result.project_id);
      await fetchWorkspaces();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e: any) { 
        console.error("Save error:", e);
        alert(`❌ ป้องกันการบันทึก: ${e.message || 'โปรดลงชื่อเข้าใช้ (Login) ก่อนบันทึกงาน'}`);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleLoadProject = async (id: number) => {
    if (loadingProjectId === id) return; // ป้องกัน double click
    setLoadingProjectId(id);
    try {
      const res = await fetch(`http://localhost:3000/api/projects/${id}/flow`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Load failed');
      if (data.flow_data) {
        setNodes(data.flow_data.nodes || []);
        setEdges(data.flow_data.edges || []);
        setCurrentProjectId(id);
      }
    } catch (e: any) { 
      alert(`❌ Load failed: ${e.message}`);
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`http://localhost:3000/api/projects/${id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
      });
      if (currentProjectId === id) setCurrentProjectId(null);
      fetchWorkspaces();
    } catch(e) { alert("Delete failed."); }
  };

  const handleTrain = async () => {
    if (!currentProjectId) { alert("Please save your project first!"); return; }
    try {
        const res = await fetch('http://localhost:3000/api/train/start', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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
      if (!defId || !reactFlowInstance || !reactFlowWrapper.current) return;

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

      // screenToFlowPosition already handles all transformations
      // Just center the node on the cursor position
      const centeredPosition = {
        x: position.x - 130,  // Half node width
        y: position.y - 70,   // Half node height
      };

      const newNode: Node = {
        id: `node_${blockCounter}`,
        type: defId === 'robot-stream' ? 'robot-stream' : 
              defId === 'webcam-input' ? 'webcam-stream' : 
              defId === 'live-monitor' ? 'monitor-node' : 'custom',
        position: centeredPosition,
        data: { def: JSON.parse(JSON.stringify(def)) },
      };

      setNodes((nds) => nds.concat(newNode));
      setBlockCounter((prev) => prev + 1);
    },
    [reactFlowInstance, blockCounter, setNodes]
  );

  if (!token) {
      return (
          <div className="h-screen w-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center font-sans antialiased text-slate-200">
              <div className="w-full max-w-md p-10 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-[0_0_40px_rgba(79,70,229,0.15)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
                  <div className="flex flex-col items-center mb-8">
                      <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-3xl mb-5 shadow-lg shadow-indigo-500/30 ring-4 ring-slate-800">R</div>
                      <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Robo Learn AI</h1>
                      <p className="text-slate-400 text-sm font-medium">{authMode === 'login' ? 'Welcome back! Please login to your workspace.' : 'Create an account to start your AI journey.'}</p>
                  </div>
                  
                  <form onSubmit={handleAuth} className="space-y-5">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Username</label>
                          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl px-4 py-3.5 text-slate-100 font-medium placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner" placeholder="Enter username..." />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Password</label>
                          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl px-4 py-3.5 text-slate-100 font-medium placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-inner" placeholder="Enter password..." />
                      </div>
                      <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] mt-4 tracking-wide">
                          {authMode === 'login' ? 'Login to Workspace' : 'Create Account'}
                      </button>
                  </form>

                  <div className="mt-8 text-center pt-6 border-t border-slate-800">
                      <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-sm text-indigo-400 hover:text-indigo-300 font-medium tracking-wide transition-colors">
                          {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
                      </button>
                  </div>
              </div>
          </div>
      );
  }

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
        <nav className="w-[88px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-5 gap-2 shrink-0 transition-colors z-10 shadow-[2px_0_10px_-3px_rgba(0,0,0,0.05)] dark:shadow-none">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center text-white font-black text-2xl mb-1 shadow-lg shadow-indigo-500/30">R</div>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-5 leading-tight text-center tracking-wide">Robo Learn AI</p>

          <button onClick={() => setIsDark(!isDark)} className="w-12 h-12 mb-3 rounded-xl shadow-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-all text-xl hover:scale-105 active:scale-95">
             {isDark ? '☀️' : '🌙'}
          </button>

          {categories.map((cat, i) => (
            <React.Fragment key={cat.id}>
              <button 
                onClick={() => setActiveCategory(cat.id as any)}
                className={`cat-btn w-[72px] h-[72px] rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all outline-none mx-2 mb-2 ${activeCategory === cat.id ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300 shadow-[inset_0_0_0_2px_#6366f1]' : `text-slate-500 dark:text-slate-400 hover:bg-${cat.color}-50 dark:hover:bg-slate-800 hover:text-${cat.color}-600 dark:hover:text-${cat.color}-400`}`}
                title={cat.label}
              >
                <span className="text-2xl drop-shadow-sm group-hover:scale-110 transition-transform">{cat.icon}</span>
                <span className="text-[9px] font-black uppercase tracking-widest">{cat.id}</span>
              </button>
            </React.Fragment>
          ))}

          {/* Settings / Profile Button - Pinned to bottom */}
          <div ref={settingsRef} className="relative mt-auto mb-4">
            <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${showSettings ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-500' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
                ⚙️
            </button>

            {showSettings && (
                <div className="absolute bottom-0 left-16 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logged in as</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">@{user?.username || 'Guest'}</p>
                        <p className="text-[10px] text-indigo-500 font-medium">User ID: {user?.id ? `ID #${user.id}` : 'N/A'}</p>
                    </div>
                    
                    <button className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
                        👤 Profile Settings
                    </button>
                    
                    <button 
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                    >
                        🚪 Logout from Robo Learn
                    </button>
                </div>
            )}
          </div>
        </nav>

        {/* Block List Panel (on the Left again) */}
        <aside className="w-[300px] bg-slate-50 dark:bg-slate-900/80 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden transition-colors z-[5] shadow-[inset_-5px_0_15px_-10px_rgba(0,0,0,0.05)] dark:shadow-none">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide">Saved Workspaces</h3>
                    <span className="text-[11px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-200 dark:border-indigo-800">@{user?.username}</span>
                </div>
                <div className="flex gap-2">
                    <button 
                      onClick={handleSave} 
                      disabled={saveStatus === 'saving'}
                      className={`flex-1 py-2 border text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5
                        ${ saveStatus === 'saving' ? 'bg-slate-400 border-slate-400 cursor-wait' 
                          : saveStatus === 'saved' ? 'bg-emerald-500 border-emerald-500 shadow-emerald-500/20' 
                          : saveStatus === 'error' ? 'bg-red-500 border-red-500 shadow-red-500/20' 
                          : 'bg-indigo-600 hover:bg-indigo-500 border-transparent shadow-indigo-500/20'}`}
                    >
                      <span className="text-sm">
                        {saveStatus === 'saving' ? '⏳' : saveStatus === 'saved' ? '✅' : saveStatus === 'error' ? '❌' : '💾'}
                      </span>
                      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Failed!' : 'Save State'}
                    </button>
                    <button onClick={() => { setNodes([]); setEdges([]); setCurrentProjectId(null); }} className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-95">➕ New</button>
                </div>
                <div className="mt-3 space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {savedWorkspaces.length === 0 && (
                      <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 py-3 italic">No saved workspaces yet</p>
                    )}
                    {savedWorkspaces.map(ws => (
                        <div 
                          key={ws.id} 
                          onClick={() => handleLoadProject(ws.id)}
                          className={`group flex items-center gap-2.5 px-3 py-2.5 text-xs border rounded-xl transition-all cursor-pointer select-none
                            ${ loadingProjectId === ws.id ? 'opacity-60 cursor-wait' : ''}
                            ${ currentProjectId === ws.id 
                              ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-600/50 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-800' 
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-indigo-50 hover:border-indigo-200 dark:hover:bg-indigo-900/20 dark:hover:border-indigo-700 hover:shadow-sm'}`}
                        >
                          <span className="text-base shrink-0">{loadingProjectId === ws.id ? '⏳' : currentProjectId === ws.id ? '📂' : '📁'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold truncate leading-tight ${ currentProjectId === ws.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{ws.name}</p>
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{ws.updated_at ? new Date(ws.updated_at).toLocaleString('en-GB') : ''}</p>
                          </div>
                          {currentProjectId === ws.id && <span className="text-[8px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">Active</span>}
                          <button 
                            onClick={e => { e.stopPropagation(); handleDelete(ws.id); }} 
                            className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded shrink-0"
                          >🗑️</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-5 pb-3">
                <h2 className="text-[15px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">{panelTitles[activeCategory]}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Drag and drop blocks to the workspace</p>
                {currentProjectId && (
                    <div className="mt-3 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5 shadow-sm">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Active ID: #{currentProjectId}
                    </div>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 content-start">
                {activeBlocks.map(block => (
                    <div key={block.id} draggable onDragStart={(e) => startDragNewBlock(e, block.id)}
                         className={`block-card ${block.color} flex flex-col items-center justify-center text-center p-3 sm:p-4 relative dark:bg-slate-800/90 dark:border-slate-700/80 bg-white backdrop-blur-sm aspect-square group`}>
                        <span className="absolute top-2 right-2 badge bg-white/50 dark:bg-slate-700/50 shadow-[0_2px_4px_rgba(0,0,0,0.02)] scale-[0.85] origin-top-right transition-transform group-hover:scale-95">{block.badge}</span>
                        <span className="text-4xl drop-shadow-sm mb-3 mt-1 group-hover:scale-110 transition-transform duration-300">{block.icon}</span>
                        <div className="w-full min-w-0 mt-auto">
                            <p className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-tight mb-0.5 tracking-wide">{block.name}</p>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-tight line-clamp-2 px-1">{block.subtitle}</p>
                        </div>
                    </div>
                ))}
            </div>
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
                onSelectionChange={onSelectionChange}
                nodeTypes={nodeTypes}
                deleteKeyCode={['Delete', 'Backspace']}
                fitView
              >
                <Background color={isDark ? '#334155' : '#cbd5e1'} />
                <Controls className="dark:bg-slate-800 dark:border-slate-700 dark:fill-slate-200" />
              </ReactFlow>
            </div>
            <div className="h-9 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-5 text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 transition-colors z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5"><code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300">{nodes.length}</code> Blocks</span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="flex items-center gap-1.5"><code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300">{edges.length}</code> Connections</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Workspace Active
                </div>
            </div>
        </main>

        {/* Right Panel (Monitor & Details) */}
        <aside className="w-[340px] bg-slate-50 dark:bg-slate-900/80 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden transition-colors shadow-[-5px_0_15px_-10px_rgba(0,0,0,0.05)] dark:shadow-none z-[5]">
            {selectedNode ? (
                <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center px-5 bg-white dark:bg-slate-900 shadow-sm z-10">
                        <h3 className="text-[15px] font-bold tracking-wide text-indigo-600 dark:text-indigo-400 flex items-center gap-2">📖 Block Details</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        <div className="flex items-start gap-4">
                            <span className="text-5xl drop-shadow-md">{(selectedNode.data as any).def.icon}</span>
                            <div className="pt-1">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight mb-2">{(selectedNode.data as any).def.name}</h2>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-300 dark:border-slate-700 tracking-widest`}>
                                    {(selectedNode.data as any).def.badge} BLOCK
                                </span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2"><span className="w-3 h-[1px] bg-slate-300 dark:bg-slate-600"></span>Description</h4>
                            <p className="text-[14px] text-slate-700 dark:text-slate-200 leading-relaxed bg-white dark:bg-slate-800/80 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/80">
                                {(selectedNode.data as any).def.description}
                            </p>
                        </div>
                        { (selectedNode.data as any).def.insight && (
                        <div className="space-y-3 pt-2">
                             <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2"><span className="w-3 h-[1px] bg-amber-200 dark:bg-amber-900/50"></span>AI Insight</h4>
                             <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-800/40">
                                <h5 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">{(selectedNode.data as any).def.insight.title}</h5>
                                <p className="text-xs text-amber-700 dark:text-amber-400/80 leading-relaxed mb-3">{(selectedNode.data as any).def.insight.text}</p>
                                <code className="block bg-amber-100 dark:bg-amber-950/50 p-2 rounded-lg text-[11px] font-mono text-amber-900 dark:text-amber-200/70 overflow-x-auto">{(selectedNode.data as any).def.insight.formula}</code>
                             </div>
                        </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-5 bg-white dark:bg-slate-900 shadow-sm z-10">
                        <h3 className="text-[15px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">📊 Preview & Stats</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        <div className="bg-slate-900 dark:bg-black rounded-2xl overflow-hidden aspect-video flex flex-col items-center justify-center border-4 border-slate-800 shadow-inner relative group">
                            {/* Layer 1: Raw webcam feed (always smooth) */}
                            {(activeMonitorFrame && monitorPoweredOn) && (
                                <img src={activeMonitorFrame} alt="Raw Feed" className="w-full h-full object-cover absolute inset-0" />
                            )}
                            {/* Layer 2: AI-processed frame with bounding boxes (overlays when available) */}
                            {(aiProcessedFrame && isAiSystemRunning) && (
                                <img src={aiProcessedFrame} alt="AI Live" className="w-full h-full object-cover absolute inset-0 z-10" />
                            )}
                            {/* Placeholder when nothing active */}
                            {(!activeMonitorFrame || !monitorPoweredOn) && !aiProcessedFrame && (
                                <div className="flex flex-col items-center gap-3 text-slate-500">
                                    <span className="text-4xl opacity-20">🖥️</span>
                                    <span className="text-[11px] font-bold tracking-tight uppercase opacity-60 px-3 py-1 bg-slate-800 rounded-md"> Monitor Inactive </span>
                                </div>
                            )}
                            {/* AI active indicator */}
                            {isAiSystemRunning && aiProcessedFrame && (
                                <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-emerald-500/90 px-2 py-0.5 rounded-md shadow-lg">
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                    <span className="text-[9px] font-bold text-white tracking-wide">AI LIVE</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30" />
                        </div>

                        {/* Search / Filter Classes */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                🔍 Filter Target Objects
                            </label>
                            <input 
                                type="text"
                                value={targetClasses}
                                onChange={(e) => setTargetClasses(e.target.value)}
                                placeholder="e.g. person, car, dog..."
                                className="w-full text-[12px] font-medium border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                            />
                            <p className="text-[9px] text-slate-400 italic">Separate with commas to detect multiple objects.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-center pt-2">
                            <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
                                <p className="text-[11px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider mb-1">Epochs</p>
                                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{trainingProgress.epoch}</p>
                                {trainingProgress.status === 'training' && <p className="text-[10px] text-indigo-400 animate-pulse mt-1">Training...</p>}
                                {trainingProgress.status === 'complete' && <p className="text-[10px] text-emerald-500 mt-1">Finished</p>}
                            </div>
                            <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
                                <p className="text-[11px] text-orange-500 dark:text-orange-400 font-bold uppercase tracking-wider mb-1">Loss (Train)</p>
                                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{trainingProgress.loss > 0 ? trainingProgress.loss.toFixed(4) : '0.00'}</p>
                                <p className="text-[10px] text-slate-400 mt-1">Val: {trainingProgress.val_loss > 0 ? trainingProgress.val_loss.toFixed(4) : '0.00'}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
                                <p className="text-[11px] text-purple-500 dark:text-purple-400 font-bold uppercase tracking-wider mb-1">Model</p>
                                <p className="text-lg font-black text-slate-800 dark:text-slate-100 truncate">{modelVariant.split(' ')[0]}</p>
                                <p className="text-[9px] text-slate-400 mt-1">{modelVariant.includes('Nano') ? 'Ultra Fast' : modelVariant.includes('Small') ? 'Balanced' : modelVariant.includes('Medium') ? 'Accurate' : 'Professional'}</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm">
                                <p className="text-[11px] text-cyan-500 dark:text-cyan-400 font-bold uppercase tracking-wider mb-1">Frames</p>
                                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{frameHistory.length}</p>
                                <p className="text-[10px] text-slate-400 mt-1">processed</p>
                            </div>
                        </div>

                        {/* Test Results Gallery */}
                        {frameHistory.length > 0 && (
                            <div className="space-y-2 pt-4">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    🎨 Test Results Gallery (Last 5)
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {frameHistory.length > 0 && frameHistory.slice(-5).map((frame, idx) => (
                                        <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                            <img src={frame} alt={`Test ${idx}`} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </aside>
      </div>

       <footer className="h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 transition-colors shadow-[0_-5px_15px_-10px_rgba(0,0,0,0.05)] z-20 relative">
            <div className="text-xs text-slate-500 font-medium">
                Ready to train your model. Ensure you have the datasets properly configured.
            </div>
            <div className="flex gap-3">
                <button onClick={handleTrain} className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]">
                    <span className="text-lg">▶</span> Train YOLO Model
                </button>
                <button onClick={() => setIsAiSystemRunning(!isAiSystemRunning)} 
                        className={`flex items-center gap-2 px-6 py-3 text-white font-bold text-sm rounded-xl transition-all shadow-lg active:scale-[0.98] ${isAiSystemRunning ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/25' : 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25'}`}>
                    <span className="text-lg">{isAiSystemRunning ? '⏹️' : '▶️'}</span> {isAiSystemRunning ? 'Stop AI' : 'Start'}
                </button>
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
