import { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

export default function WebcamStreamNode({ id, data, selected }: any) {
    const { setNodes, setEdges } = useReactFlow();
    const { def } = data;

    const [status, setStatus] = useState<'idle' | 'streaming' | 'error'>('idle');
    const [deviceId, setDeviceId] = useState('default');
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

    const onDelete = () => {
        stopStream();
        setNodes((nodes) => nodes.filter((n) => n.id !== id));
        setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
    };

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setStatus('idle');
    }, []);

    const startStream = useCallback(async () => {
        stopStream();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: deviceId === 'default' ? true : { deviceId: { exact: deviceId } } 
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setStatus('streaming');
        } catch (err) {
            console.error("Webcam error:", err);
            setStatus('error');
        }
    }, [deviceId, stopStream]);

    // Broadcast logic — throttled to ~10 FPS for smooth performance
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;
        const SEND_WIDTH = 320; // Downscale for socket transmission
        const FPS = 10;

        if (status === 'streaming') {
            intervalId = setInterval(() => {
                if (!videoRef.current || videoRef.current.readyState < 4) return;

                const video = videoRef.current;

                // Full-res canvas for local preview event
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.drawImage(video, 0, 0);

                // High-quality frame for local Live-Monitor preview
                const previewB64 = canvas.toDataURL('image/jpeg', 0.7);
                window.dispatchEvent(new CustomEvent('live-monitor-frame', { detail: previewB64 }));

                // Low-res frame for AI Bridge (saves bandwidth dramatically)
                const ratio = video.videoHeight / video.videoWidth;
                canvas.width = SEND_WIDTH;
                canvas.height = Math.round(SEND_WIDTH * ratio);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const smallB64 = canvas.toDataURL('image/jpeg', 0.5);

                const socket = (window as any).socket;
                if (socket) {
                    socket.emit('video_frame_from_webcam', { image: smallB64 });
                }
            }, 1000 / FPS);
        }
        
        return () => clearInterval(intervalId);
    }, [status]);

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(ds => {
            setDevices(ds.filter(d => d.kind === 'videoinput'));
        });
        return () => stopStream();
    }, [stopStream]);

    const statusColor = {
        idle: 'bg-slate-400',
        streaming: 'bg-emerald-400 animate-pulse',
        error: 'bg-red-400',
    }[status];

    return (
        <div className={`workspace-node bg-white dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-sm hover:shadow-md dark:shadow-none border border-slate-200/80 dark:border-slate-700/80 min-w-[300px] transition-all duration-200 ${selected ? 'ring-2 ring-indigo-500 shadow-xl dark:ring-indigo-400' : ''}`}>
            <Handle type="source" position={Position.Right} className="w-4 h-4 bg-white dark:bg-slate-800 border-2 border-slate-400 dark:border-slate-500 rounded-full hover:bg-indigo-500 hover:border-indigo-500 hover:scale-125 -right-2 transition-all shadow-sm" />

            {/* Header */}
            <div className="wb-header py-3.5 px-4 flex items-center justify-between rounded-t-2xl blue-header border-b border-white/50 dark:border-slate-800/50">
                <div className="flex items-center gap-3">
                    <span className="text-2xl drop-shadow-md">🎥</span>
                    <div className="pt-0.5">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">Webcam Stream</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">Local Camera Feed</p>
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
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className={`w-full h-full object-cover ${status === 'streaming' ? 'block' : 'hidden'} scale-x-[-1]`}
                    />
                    {status !== 'streaming' && (
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                            <span className="text-3xl">📷</span>
                            <span className="text-[11px] font-medium">{status === 'error' ? 'Camera Error' : 'Ready to Stream'}</span>
                        </div>
                    )}
                    {/* Status dot */}
                    <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${statusColor} shadow-lg`} />
                </div>

                {/* Device Selection */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Select Camera</label>
                    <select 
                        value={deviceId}
                        onChange={e => setDeviceId(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-2 bg-slate-50 dark:bg-slate-800/80 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                        <option value="default">Default Camera</option>
                        {devices.map(d => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0,5)}`}</option>
                        ))}
                    </select>
                </div>

                {/* Controls */}
                {status !== 'streaming' ? (
                    <button
                        onClick={startStream}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 active:scale-95"
                    >
                        ▶️ Start Webcam
                    </button>
                ) : (
                    <button
                        onClick={stopStream}
                        className="w-full py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold rounded-xl transition-all active:scale-95"
                    >
                        ⏹️ Stop Stream
                    </button>
                )}
            </div>
        </div>
    );
}
