import { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

export default function RobotStreamNode({ id, data, selected }: any) {
    const { setNodes, setEdges } = useReactFlow();
    const { def } = data;

    const [robotId, setRobotId] = useState('WEBCAM_RAW');
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

    const imgRef = useRef<HTMLImageElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const frameRef = useRef(0);

    const onDelete = () => {
        disconnect();
        setNodes((nodes) => nodes.filter((n) => n.id !== id));
        setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
    };

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        setStatus('idle');
    }, []);

    const connect = useCallback(() => {
        if (!robotId.trim()) return;
        disconnect();

        setStatus('connecting');
        const socket = io(SERVER_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join_robot_room', robotId.trim());
        });

        socket.on('room_joined', () => {
            setStatus('connected');
        });

        socket.on('stream_to_web', (imageBase64: string) => {
            if (imgRef.current) {
                imgRef.current.src = imageBase64;
            }
            frameRef.current++;
            
            // Broadcast to global monitor
            window.dispatchEvent(new CustomEvent('live-monitor-frame', { detail: imageBase64 }));
        });

        socket.on('connect_error', () => setStatus('error'));
        socket.on('disconnect', () => { setStatus('idle'); });
    }, [robotId, disconnect]);

    // Cleanup on unmount
    useEffect(() => { return () => disconnect(); }, [disconnect]);

    const statusColor = {
        idle: 'bg-slate-400',
        connecting: 'bg-amber-400 animate-pulse',
        connected: 'bg-emerald-400',
        error: 'bg-red-400',
    }[status];

    const statusText = {
        idle: 'Disconnected',
        connecting: 'Connecting...',
        connected: 'Live Stream Active',
        error: 'Connection Failed',
    }[status];

    return (
        <div className={`workspace-node bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-sm hover:shadow-md dark:shadow-none border border-slate-200/80 dark:border-slate-700/80 min-w-[300px] transition-all duration-200 ${selected ? 'ring-2 ring-indigo-500 shadow-xl dark:ring-indigo-400' : ''}`}>
            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-500 rounded-full hover:bg-indigo-500 hover:border-indigo-500 hover:scale-125 -right-2 transition-all shadow-sm" />

            {/* Header */}
            <div className="wb-header py-3.5 px-4 flex items-center justify-between rounded-t-2xl blue-header border-b border-white/50 dark:border-slate-800/50">
                <div className="flex items-center gap-3">
                    <span className="text-2xl drop-shadow-md">{def.icon}</span>
                    <div className="pt-0.5">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">{def.name}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{def.subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-blue-200 text-blue-800 shadow-sm tracking-wide">INPUT</span>
                    <button onClick={onDelete} className="text-slate-400/80 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 w-7 h-7 flex items-center justify-center rounded-full transition-all" title="Delete Block">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="wb-body p-4 text-xs text-slate-600 dark:text-slate-300 font-sans bg-white dark:bg-slate-900/50 rounded-b-2xl space-y-3">

                {/* Video Preview */}
                <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border-2 border-slate-800 shadow-inner flex items-center justify-center">
                    {status === 'connected' ? (
                        <img ref={imgRef} alt="Robot Stream" className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                            <span className="text-3xl">📷</span>
                            <span className="text-[11px] font-medium">{status === 'connecting' ? 'Connecting...' : 'No Stream'}</span>
                        </div>
                    )}
                    {/* Status dot */}
                    <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${statusColor} shadow-lg`} title={statusText} />
                </div>

                {/* Robot ID input */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Robot ID / Name</label>
                    <input
                        type="text"
                        value={robotId}
                        onChange={e => setRobotId(e.target.value)}
                        disabled={status === 'connected' || status === 'connecting'}
                        placeholder="e.g. ROBOT_01"
                        className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/80 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-50"
                    />
                </div>

                {/* Status bar */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex-1">{statusText}</span>
                </div>

                {/* Connect / Disconnect button */}
                {status === 'idle' || status === 'error' ? (
                    <button
                        onClick={connect}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                    >
                        🔗 Connect to Robot
                    </button>
                ) : status === 'connecting' ? (
                    <button disabled className="w-full py-2 bg-slate-400 text-white text-xs font-bold rounded-xl cursor-wait">
                        ⏳ Connecting...
                    </button>
                ) : (
                    <button
                        onClick={disconnect}
                        className="w-full py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold rounded-xl transition-all active:scale-95"
                    >
                        ✂️ Disconnect
                    </button>
                )}
            </div>
        </div>
    );
}
