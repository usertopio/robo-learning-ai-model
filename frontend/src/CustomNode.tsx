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

export default function CustomNode({ id, data, selected }: any) {
    const { setNodes, setEdges } = useReactFlow();
    const { def } = data;
    if (!def) return null;

    const onDelete = () => {
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
        setEdges((edges) => edges.filter((edge) => edge.source !== id && edge.target !== id));
    };

    const hasTargetHandle = def.color !== 'blue'; // ทุกอันรับ Input ได้ยกเว้นสีบล็อก Input (Blue)
    const hasSourceHandle = def.color !== 'green' && def.color !== 'rose'; // ทุกอันส่ง Output ได้ ยกเว้นบล็อก Output (Green/Rose)

    return (
        <div className={`workspace-node bg-white dark:bg-slate-800 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] border-2 min-w-[200px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-shadow ${selected ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
            
            {/* Input Handle (รับเส้นที่ถูกโยงมาหา) */}
            {hasTargetHandle && (
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    className="w-3.5 h-3.5 bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-500 rounded-full hover:bg-indigo-400 hover:border-indigo-400 -left-2 transition-colors" 
                />
            )}

            <div className={`wb-header py-2.5 px-3.5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between rounded-t-[14px] ${def.color}-header transition-colors`}>
                <div className="flex items-center gap-2">
                    <span className="text-lg">{def.icon}</span>
                    <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{def.name}</p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400">{def.subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getBadgeClass(def.color)}`}>{def.badge}</span>
                    <button 
                        onClick={onDelete} 
                        className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 w-5 h-5 flex items-center justify-center rounded-full transition-colors pb-0.5" 
                        title="Delete Block"
                    >×</button>
                </div>
            </div>
            
            <div className="wb-body p-3.5 text-xs text-slate-500 dark:text-slate-400 font-sans transition-colors">
                {def.params.map((p: any, idx: number) => {
                    if (p.type === 'slider') return <div key={idx} className="mb-2"><label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{p.label}</label><div className="flex items-center gap-2"><input type="range" min={p.min} max={p.max} defaultValue={p.value} step={p.step} className="w-full accent-indigo-500"/><span className="text-[10px] font-mono shrink-0 dark:text-slate-400">{p.value}</span></div></div>;
                    if (p.type === 'select') return <div key={idx} className="mb-2"><label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{p.label}</label><select className="w-full text-[11px] border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-1 bg-slate-50 dark:bg-slate-900/50 dark:text-slate-200">{p.options.map((o:string) => <option key={o}>{o}</option>)}</select></div>;
                    if (p.type === 'text') return <div key={idx} className="mb-2"><label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{p.label}</label><input type="text" placeholder={p.placeholder} defaultValue={p.value} className="w-full text-[11px] border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 bg-slate-50 dark:bg-slate-900/50 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500" /></div>;
                    if (p.type === 'check') return <div key={idx} className="flex items-center gap-1.5 mt-2.5"><input type="checkbox" defaultChecked={p.checked} className="accent-indigo-500" /><span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{p.label}</span></div>;
                    if (p.type === 'button') return <button key={idx} className="w-full mt-1.5 text-[11px] px-3 py-1.5 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-left transition font-semibold">{p.label}</button>;
                    
                    if (p.type === 'dropzone') return (
                        <div key={idx} className="mb-2 mt-2">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{p.label}</label>
                            <label className="w-full text-[10px] text-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center">
                                <span className="text-xl mb-1 block">📂</span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">Drag & Drop folder</span>
                                <p className="text-[9px] mt-0.5 opacity-70">or click to upload images</p>
                                <input type="file" {...{ webkitdirectory: "", directory: "" } as any} multiple className="hidden" />
                            </label>
                        </div>
                    );

                    if (p.type === 'divider') return <div key={idx} className="border-t border-slate-200 dark:border-slate-700 mt-3 mb-1.5 pt-2"><label className="text-indigo-600 dark:text-indigo-400 font-bold text-[11px] block">{p.label}</label></div>;
                    
                    if (p.type === 'info') return (
                        <div key={idx} className="mb-2 p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded text-center">
                            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{p.label}</label>
                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">{p.text}</span>
                        </div>
                    );

                    if (p.type === 'progress') return (
                        <div key={idx} className="mb-2 mt-3">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{p.label}</label>
                                <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{p.value}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                <div className="bg-indigo-500 dark:bg-indigo-400 h-1.5 rounded-full transition-all duration-300" style={{ width: `${p.value}%` }}></div>
                            </div>
                        </div>
                    );

                    if (p.type === 'table') return (
                        <div key={idx} className="mb-2 mt-2">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{p.label}</label>
                            <table className="w-full text-[10px] text-left border-collapse rounded overflow-hidden">
                                <thead><tr className="bg-slate-100 dark:bg-slate-700">{p.columns.map((c:any, i:number)=><th key={i} className="px-1.5 py-1 border border-slate-200 dark:border-slate-800 dark:text-slate-200">{c}</th>)}</tr></thead>
                                <tbody>
                                    {p.data ? p.data.map((row:any[], ri:number) => (
                                        <tr key={ri} className="bg-white dark:bg-slate-800">{row.map((cell:any, ci:number) => <td key={ci} className="px-1.5 py-1 border border-slate-200 dark:border-slate-700 font-mono text-[9px] dark:text-slate-300">{cell}</td>)}</tr>
                                    )) : Array.from({length: p.rows}).map((_, ri) => (
                                        <tr key={ri} className="bg-white dark:bg-slate-800">{p.columns.map((_, ci) => <td key={ci} className="px-1.5 py-1 border border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-500 text-center">-</td>)}</tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );

                    if (p.type === 'matrix') return (
                        <div key={idx} className="mb-2 mt-2">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{p.label}</label>
                            <table className="w-full text-[9px] text-center border-collapse">
                                <thead><tr className="bg-slate-100 dark:bg-slate-700"><th className="p-1 border border-slate-200 dark:border-slate-800 font-normal text-slate-400">#</th>{p.headers.map((h:any, i:number)=><th key={i} className="p-1 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">{h}</th>)}</tr></thead>
                                <tbody>
                                    {p.headers.map((hLine:any, ri:number) => (
                                        <tr key={ri} className="bg-white dark:bg-slate-800">
                                            <th className="p-1 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">{hLine}</th>
                                            {p.headers.map((_:any, ci:number) => <td key={ci} className={`p-1 border border-slate-200 dark:border-slate-700 ${ri === ci ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-300 dark:text-slate-600'}`}>{ri === ci ? '1.0' : '0.0'}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );

                    return null;
                })}
            </div>

            {/* Output Handle (ลากเส้นออกไปหาคนอื่น) */}
            {hasSourceHandle && (
                <Handle 
                    type="source" 
                    position={Position.Right} 
                    className="w-3.5 h-3.5 bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-500 rounded-full hover:bg-indigo-400 hover:border-indigo-400 -right-2 transition-colors" 
                />
            )}
        </div>
    );
}
