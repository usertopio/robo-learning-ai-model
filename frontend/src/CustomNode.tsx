import { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

function getBadgeClass(color: string) {
    const map: Record<string, string> = {
        blue: 'bg-blue-200 text-blue-800',
        purple: 'bg-purple-200 text-purple-800',
        green: 'bg-emerald-200 text-emerald-800',
        amber: 'bg-amber-200 text-amber-800',
        rose: 'bg-rose-200 text-rose-800',
    };
    return map[color] || 'bg-slate-200 text-slate-800';
}

function getBlockIcon(blockId: string, defaultIcon: string) {
    // Map for blocks with problematic emoji encoding
    const iconMap: Record<string, string> = {
        'ai-detector': '🤖',  // Robot
        'webcam-input': '📹',  // Video camera
        'robot-stream': '🎥',  // Movie camera  
        'roboflow-dataset': '📚',  // Books/library
    };
    return iconMap[blockId] || defaultIcon;
}

export default function CustomNode({ id, data, selected }: any) {
    const { setNodes, setEdges } = useReactFlow();
    const { def } = data;
    if (!def) return null;

    const [cameraStatus, setCameraStatus] = useState<Record<number, string>>({});
    const [isTraining, setIsTraining] = useState(false);
    const [trainingStatus, setTrainingStatus] = useState<'idle' | 'training' | 'complete' | 'error'>('idle');

    const onDelete = () => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        setEdges((edges) => edges.filter((edge) => edge.source !== id && edge.target !== id));
    };

    const handleParamChange = (idx: number, newValue: any, key: string = 'value') => {
        setNodes((nds) => 
            nds.map((node) => {
                if (node.id === id) {
                    const newDef = { ...node.data.def };
                    const newParams = [...newDef.params];
                    newParams[idx] = { ...newParams[idx], [key]: newValue };
                    newDef.params = newParams;

                    // Emit to system for AI Sync
                    window.dispatchEvent(new CustomEvent('ai-param-update', { 
                        detail: { nodeId: id, paramIdx: idx, key, value: newValue, label: newParams[idx].label } 
                    }));

                    return { ...node, data: { ...node.data, def: newDef } };
                }
                return node;
            })
        );
    };

    const testCamera = async (paramIdx: number) => {
        setCameraStatus(s => ({ ...s, [paramIdx]: 'testing' }));
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(t => t.stop()); // ปิดกล้องทันทีหลังทดสอบ
            setCameraStatus(s => ({ ...s, [paramIdx]: 'ok' }));
        } catch (err: any) {
            setCameraStatus(s => ({ ...s, [paramIdx]: 'error' }));
        }
    };

    const handleStartTraining = async () => {
        if (def.id !== 'train-engine') return;
        
        // Get current mode and other parameters from the node
        const modeParam = def.params.find((p: any) => p.label === 'Operation Mode');
        const mode = modeParam?.value || 'Inference (Testing)';
        
        // Extract training hyperparameters
        const hyperparams = def.params.reduce((acc: any, p: any) => {
            if (p.label === 'Epochs') acc.epochs = p.value;
            if (p.label === 'Initial LR (lr0)') acc.lr0 = p.value;
            if (p.label === 'Batch Size') acc.batch_size = p.value?.split(' ')[0] || 16;
            if (p.label === 'Weight Decay') acc.weight_decay = p.value;
            if (p.label === 'Optimizer Type') acc.optimizer_type = p.value?.split(' ')[0] || 'AdamW';
            if (p.label === 'Image Size (imgsz)') acc.imgsz = p.value;
            return acc;
        }, {});

        setIsTraining(true);
        setTrainingStatus('training');

        try {
            const response = await fetch('http://localhost:3000/api/train/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    mode,
                    hyperparams
                })
            });

            const result = await response.json();
            if (response.ok) {
                setTrainingStatus('complete');
                setTimeout(() => setTrainingStatus('idle'), 3000);
            } else {
                setTrainingStatus('error');
                console.error('Training error:', result.error);
            }
        } catch (err: any) {
            setTrainingStatus('error');
            console.error('Training request failed:', err);
        } finally {
            setIsTraining(false);
        }
    };

    const hasTargetHandle = def.color !== 'blue'; // ทุกอันรับ Input ได้ยกเว้นสีบล็อก Input (Blue)
    const hasSourceHandle = def.color !== 'green' && def.color !== 'rose'; // ทุกอันส่ง Output ได้ ยกเว้นบล็อก Output (Green/Rose)

    return (
        <div className={`workspace-node bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-sm hover:shadow-md dark:shadow-none border border-slate-200/80 dark:border-slate-700/80 min-w-[260px] transition-all duration-200 ${selected ? 'ring-2 ring-indigo-500 shadow-xl dark:ring-indigo-400' : ''}`}>
            
            {/* Input Handle (รับเส้นที่ถูกโยงมาหา) */}
            {hasTargetHandle && (
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-indigo-600 dark:from-indigo-500 dark:to-indigo-700 border-4 border-white dark:border-slate-700 rounded-full hover:w-24 hover:h-24 hover:shadow-2xl hover:shadow-indigo-500/70 -left-10 transition-all shadow-xl cursor-grab active:cursor-grabbing" 
                />
            )}

            <div className={`wb-header py-3.5 px-4 flex items-center justify-between rounded-t-2xl ${def.color}-header transition-colors border-b border-white/50 dark:border-slate-800/50`}>
                <div className="flex items-center gap-3">
                    <span className="text-2xl drop-shadow-md">{getBlockIcon(def.id, def.icon)}</span>
                    <div className="pt-0.5">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">{def.name}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{def.subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${getBadgeClass(def.color)} shadow-sm tracking-wide`}>{def.badge}</span>
                    <button 
                        onClick={onDelete} 
                        className="text-slate-400/80 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 w-7 h-7 flex items-center justify-center rounded-full transition-all" 
                        title="Delete Block"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
            </div>
            
            <div className={`wb-body p-4 text-xs text-slate-600 dark:text-slate-300 font-sans transition-colors bg-white dark:bg-slate-900/50 rounded-b-2xl ${def.id === 'train-engine' ? '' : 'max-h-[500px] overflow-y-auto'}`}>
                {def.params.map((p: any, idx: number) => {
                    if (p.type === 'slider') {
                        const step = p.step || 1;
                        const increment = () => {
                            const val = Math.min(p.max, Number((p.value + step).toFixed(4)));
                            handleParamChange(idx, val);
                        };
                        const decrement = () => {
                            const val = Math.max(p.min, Number((p.value - step).toFixed(4)));
                            handleParamChange(idx, val);
                        };

                        return (
                            <div key={idx} className="mb-4">
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{p.label}</label>
                                    
                                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <button 
                                            onClick={decrement}
                                            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-all active:scale-90"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                                        </button>
                                        
                                        <input
                                            type="number"
                                            value={p.value}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                if (!isNaN(val)) handleParamChange(idx, val);
                                            }}
                                            onBlur={(e) => {
                                                let val = Number(e.target.value);
                                                val = Math.round(val / step) * step;
                                                if (val < p.min) val = p.min;
                                                if (val > p.max) val = p.max;
                                                handleParamChange(idx, Number(val.toFixed(4)));
                                            }}
                                            className="w-12 text-center bg-transparent border-none text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 focus:ring-0 p-0 appearance-none no-spinner"
                                        />

                                        <button 
                                            onClick={increment}
                                            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 transition-all active:scale-90"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="px-1">
                                    <input 
                                        type="range" 
                                        min={p.min} 
                                        max={p.max} 
                                        value={p.value} 
                                        step={p.step} 
                                        onChange={(e) => handleParamChange(idx, Number(e.target.value))}
                                        className="w-full accent-indigo-500 cursor-pointer h-1 rounded-lg appearance-none bg-slate-200 dark:bg-slate-800"
                                    />
                                    <div className="flex justify-between mt-1 text-[8px] text-slate-400 font-mono opacity-60">
                                        <span>{p.min}</span>
                                        <span>{p.max}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    
                    if (p.type === 'select') return (
                        <div key={idx} className="mb-3">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{p.label}</label>
                            <select 
                                value={p.value || p.options[0]}
                                onChange={(e) => handleParamChange(idx, e.target.value)}
                                className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            >
                                {p.options.map((o:string) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                    );

                    if (p.type === 'text') return (
                        <div key={idx} className="mb-3">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{p.label}</label>
                            <input 
                                type="text" 
                                placeholder={p.placeholder} 
                                value={p.value || ''} 
                                onChange={(e) => handleParamChange(idx, e.target.value)}
                                className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/80 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                            />
                        </div>
                    );

                    if (p.type === 'check') return (
                        <div key={idx} className="mb-3">
                            <label className="flex items-center gap-2 group cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={p.checked} 
                                    onChange={(e) => handleParamChange(idx, e.target.checked, 'checked')}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800 transition-all cursor-pointer"
                                />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.label}</span>
                            </label>
                        </div>
                    );

                    if (p.type === 'button') {
                        const camStatus = cameraStatus[idx];
                        const isCamTest = p.label === 'Check Connection' || p.label.includes('Test');
                        return (
                            <button
                                key={idx}
                                onClick={() => isCamTest ? testCamera(idx) : undefined}
                                className={`w-full mt-2 text-xs px-4 py-2 rounded-xl text-center transition-colors font-bold shadow-sm active:scale-[0.98]
                                    ${ isCamTest
                                        ? camStatus === 'ok' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                                        : camStatus === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300'
                                        : camStatus === 'testing' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 cursor-wait opacity-80'
                                        : 'bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                                        : 'bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                                    }`}
                            >
                                { isCamTest
                                    ? camStatus === 'ok' ? '✅ Connected!'
                                    : camStatus === 'error' ? '❌ Connection Failed'
                                    : camStatus === 'testing' ? '⏳ Checking...'
                                    : p.label
                                    : p.label
                                }
                            </button>
                        );
                    }
                    
                    if (p.type === 'dropzone') return (
                        <div key={idx} className="mb-3 mt-3">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{p.label}</label>
                            <label className="w-full text-[11px] text-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-5 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-indigo-400 transition-all cursor-pointer text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center group">
                                <span className="text-2xl mb-1.5 block group-hover:scale-110 transition-transform">📂</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">Drag & Drop folder</span>
                                <p className="text-[10px] mt-1 opacity-70 font-medium">or click to upload images</p>
                                <input type="file" {...{ webkitdirectory: "", directory: "" } as any} multiple className="hidden" />
                            </label>
                        </div>
                    );

                    if (p.type === 'divider') return (
                        <div key={idx} className="border-t border-slate-200 dark:border-slate-700 mt-4 mb-2 pt-3">
                            <label className="text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] uppercase tracking-widest block">{p.label}</label>
                        </div>
                    );
                    
                    if (p.type === 'info') return (
                        <div key={idx} className="mb-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800/50">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{p.label}</label>
                            <span className="text-[12px] font-mono font-bold text-slate-800 dark:text-slate-100">{p.text}</span>
                        </div>
                    );

                    if (p.type === 'progress') return (
                        <div key={idx} className="mb-2 mt-3 p-1">
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{p.label}</label>
                                <span className="text-[10px] font-mono font-bold text-indigo-500">{p.value}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                                <div 
                                    className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(99,102,241,0.3)]" 
                                    style={{ width: `${p.value}%` }}
                                />
                            </div>
                        </div>
                    );

                    if (p.type === 'table') return (
                        <div key={idx} className="mb-2 mt-2">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-widest">{p.label}</label>
                            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
                                <table className="w-full text-[10px] text-left border-collapse">
                                    <thead><tr className="bg-slate-50 dark:bg-slate-900/50">{p.columns.map((c:any, i:number)=><th key={i} className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 dark:text-slate-300 font-bold">{c}</th>)}</tr></thead>
                                    <tbody>
                                        {p.data ? p.data.map((row:any[], ri:number) => (
                                            <tr key={ri} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800/50">
                                                {row.map((cell:any, ci:number) => <td key={ci} className="px-2 py-1.5 font-mono text-[9px] dark:text-slate-400">{cell}</td>)}
                                            </tr>
                                        )) : Array.from({length: p.rows}).map((_, ri) => (
                                            <tr key={ri} className="border-b last:border-0 border-slate-100 dark:border-slate-800/50">
                                                {p.columns.map((_, ci) => <td key={ci} className="px-2 py-1.5 text-slate-300 dark:text-slate-600 text-center">-</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );

                    if (p.type === 'matrix') return (
                        <div key={idx} className="mb-2 mt-2">
                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-widest">{p.label}</label>
                            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800">
                                <table className="w-full text-[9px] text-center border-collapse">
                                    <thead><tr className="bg-slate-50 dark:bg-slate-900/50"><th className="p-1 border-b border-r border-slate-200 dark:border-slate-800 font-normal text-slate-400">#</th>{p.headers.map((h:any, i:number)=><th key={i} className="p-1.5 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-200 font-bold">{h}</th>)}</tr></thead>
                                    <tbody>
                                        {p.headers.map((hLine:any, ri:number) => (
                                            <tr key={ri} className="border-b last:border-0 border-slate-100 dark:border-slate-800/50">
                                                <th className="p-1.5 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300 font-bold">{hLine}</th>
                                                {p.headers.map((_:any, ci:number) => <td key={ci} className={`p-1.5 font-mono ${ri === ci ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-300 dark:text-slate-600'}`}>{ri === ci ? '1.0' : '0.0'}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );

                    return null;
                })}
                
                {/* Training Start Button - สำหรับ Training Block เท่านั้น */}
                {def.id === 'train-engine' && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            onClick={handleStartTraining}
                            disabled={isTraining}
                            className={`w-full py-2.5 px-3 text-xs font-bold rounded-lg transition-all shadow-md active:scale-[0.98] text-center ${
                                isTraining || trainingStatus === 'training'
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 cursor-wait opacity-80'
                                    : trainingStatus === 'complete'
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                    : trainingStatus === 'error'
                                    ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                                    : 'bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white shadow-amber-500/30'
                            }`}
                        >
                            {isTraining || trainingStatus === 'training' 
                                ? '⏳ Training...'
                                : trainingStatus === 'complete'
                                ? '✅ Training Complete'
                                : trainingStatus === 'error'
                                ? '❌ Training Failed'
                                : '🎓 Start Training'
                            }
                        </button>
                    </div>
                )}
            </div>


            {/* Output Handle (ลากเส้นออกไปหาคนอื่น) */}
            {hasSourceHandle && (
                <Handle 
                    type="source" 
                    position={Position.Right} 
                    className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 dark:from-emerald-500 dark:to-emerald-700 border-4 border-white dark:border-slate-700 rounded-full hover:w-24 hover:h-24 hover:shadow-2xl hover:shadow-emerald-500/70 -right-10 transition-all shadow-xl cursor-grab active:cursor-grabbing" 
                />
            )}
        </div>
    );
}
