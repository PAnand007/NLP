import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  Database, Send, Activity, Loader2, Mic, MicOff, User,
  MessageSquare, BarChart2, Clock, ChevronDown,
  Code2, ChevronUp, X, TrendingUp, Hash, FileJson,
  CheckCircle2, AlertCircle, Trash2
} from 'lucide-react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const API = `${import.meta.env.VITE_API_BASE_URL}/api/v1`

function extractChartData(metrics: any) {
  if (!metrics) return [];
  const out: { name: string; value: number }[] = [];
  if (metrics.Top_Categories && Object.keys(metrics.Top_Categories).length > 0) {
    const priority = ['product', 'category', 'status', 'customer_name'];
    let bestCol = Object.keys(metrics.Top_Categories)[0];

    for (const p of priority) {
      if (metrics.Top_Categories[p]) {
        bestCol = p;
        break;
      }
    }

    for (const [name, val] of Object.entries(metrics.Top_Categories[bestCol]))
      out.push({ name: String(name), value: val as number });
  } else {
    for (const [key, val] of Object.entries(metrics))
      if (key !== 'Top_Categories' && key !== 'dataframe_shape' && typeof val === 'number')
        out.push({ name: key, value: val });
  }
  return out;
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  metrics?: any;
  structuredQuery?: any;
  error?: boolean;
  detectedLang?: string;
  timestamp: string;
}
type Panel = 'chat' | 'insights' | 'history';

export default function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [panel, setPanel] = useState<Panel>('chat')

  const [dbUrl, setDbUrl] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [collections, setCollections] = useState<string[]>([])
  const [selectedCollection, setSelectedCollection] = useState('')

  const [isListening, setIsListening] = useState(false)
  const [voiceLang, setVoiceLang] = useState<'en-US' | 'hi-IN'>('en-US')
  const recognitionRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [expandedQueryId, setExpandedQueryId] = useState<string | null>(null)

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadMsg, setUploadMsg] = useState('')

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages])

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = voiceLang;

    r.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final) {
        setQuery(p => p ? p + ' ' + final : final);
      }
    };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    recognitionRef.current = r;
  }, [voiceLang]);

  const toggleListen = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    else { setQuery(''); recognitionRef.current?.start(); setIsListening(true); }
  };

  const handleConnect = async () => {
    if (!dbUrl) return;
    setConnecting(true);
    try {
      const res = await axios.post(`${API}/connect`, { uri: dbUrl });
      const cols: string[] = res.data.collections || [];
      setCollections(cols);
      if (cols.length > 0) setSelectedCollection(cols[0]);
      setIsConnected(true);
      addAssistantMsg(`Connected to database: **"${cols[0] || 'your database'}"**.\n\nHow can I help you analyze this data?`);
    } catch (err: any) {
      alert("Connect failed: " + (err.response?.data?.detail || err.message));
    }
    setConnecting(false);
  };

  const addAssistantMsg = (text: string, extras?: Partial<Message>) => {
    setMessages(p => [...p, {
      id: Date.now().toString(), role: 'assistant', text,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      ...extras
    }]);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.json')) { alert('Only .json files are supported.'); return; }
    setUploadStatus('uploading');
    setUploadMsg('Uploading…');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await axios.post(`${API}/upload-json`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { collection, count } = res.data;
      setCollections(p => [...new Set([...p, collection])]);
      setSelectedCollection(collection);
      setIsConnected(true);
      setUploadStatus('success');
      setUploadMsg(`Loaded ${count} records from "${file.name}"`);
      addAssistantMsg(
        `File import complete. I've processed **${count} records** from \`${file.name}\`.\n\nYou can query this data directly by asking questions in the chat.`
      );
      setTimeout(() => { setUploadStatus('idle'); setUploadMsg(''); }, 4000);
    } catch (err: any) {
      setUploadStatus('error');
      setUploadMsg(err.response?.data?.detail || 'Upload failed.');
      setTimeout(() => { setUploadStatus('idle'); setUploadMsg(''); }, 5000);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { handleFileUpload(file); e.target.value = ''; }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleDeleteCollection = async () => {
    if (!selectedCollection || !window.confirm(`Delete collection "${selectedCollection}"? This cannot be undone.`)) return;
    try {
      const res = await axios.delete(`${API}/collections/${selectedCollection}`);
      const newCols: string[] = res.data.collections || [];
      setCollections(newCols);
      if (newCols.length > 0) setSelectedCollection(newCols[0]);
      else {
        setIsConnected(false);
        setSelectedCollection('');
      }
      addAssistantMsg(`Collection **"${selectedCollection}"** has been deleted.`);
    } catch (err: any) {
      alert("Delete failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleQuery = async () => {
    if (!query.trim() || !selectedCollection) return;
    const q = query; setQuery(''); setLoading(true); setPanel('chat');
    setMessages(p => [...p, {
      id: Date.now().toString(), role: 'user', text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    }]);
    try {
      const res = await axios.post(`${API}/query`, { query: q, collection_name: selectedCollection });
      setMessages(p => [...p, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        text: res.data.insight_summary, metrics: res.data.metrics,
        structuredQuery: res.data.structured_query,
        detectedLang: res.data.detected_lang,
        timestamp: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      }]);
    } catch (err: any) {
      addAssistantMsg(err.response?.data?.detail || 'Network error.', { error: true });
    }
    setLoading(false);
  };

  const toggleQuery = (id: string) => setExpandedQueryId(p => p === id ? null : id);

  const historyItems = messages.filter(m => m.role === 'user');
  const insightItems = messages.filter(m => m.role === 'assistant' && m.metrics && !m.error);
  const aggMetrics: Record<string, number[]> = {};
  insightItems.forEach(m => {
    Object.entries(m.metrics || {}).forEach(([k, v]) => {
      if (k === 'Top_Categories' || k === 'dataframe_shape' || typeof v !== 'number') return;
      if (!aggMetrics[k]) aggMetrics[k] = [];
      aggMetrics[k].push(v as number);
    });
  });

  const NavBtn = ({ p, icon, label }: { p: Panel; icon: React.ReactNode; label: string }) => (
    <button onClick={() => setPanel(p)}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-all
        ${panel === p ? 'text-[#4b4eed] bg-indigo-50 font-semibold border border-indigo-100' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );

  const renderMessages = () => (
    <div className="flex flex-col gap-5 w-full pb-4">
      {messages.map(msg => {
        const chartData = msg.metrics ? extractChartData(msg.metrics) : [];
        const isExpanded = expandedQueryId === msg.id;
        return (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center mt-0.5
              ${msg.role === 'user' ? 'bg-[#3c50e0] text-white' : 'bg-slate-200 text-slate-600'}`}>
              {msg.role === 'user' ? <User size={14} /> : <Activity size={14} />}
            </div>
            <div className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end max-w-[80%]' : 'items-start max-w-[90%]'}`}>
              {}
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed break-words
                ${msg.role === 'user' ? 'bg-[#3c50e0] text-white rounded-tr-sm shadow-md' : 'bg-slate-50 border border-slate-100 rounded-tl-sm text-slate-700 shadow-sm'}
                ${msg.error ? '!bg-red-50 !border-red-200 !text-red-600' : ''}`}>
                {msg.role === 'assistant' && !msg.error
                  ? <div className="markdown-body"><ReactMarkdown>{msg.text || ''}</ReactMarkdown></div>
                  : <span>{msg.text}</span>}
              </div>
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                {msg.detectedLang && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-400 border border-indigo-100/50">
                    {msg.detectedLang} detected
                  </span>
                )}
              </div>

              {}
              {msg.role === 'assistant' && msg.metrics && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full mt-0.5">
                  {Object.entries(msg.metrics)
                    .filter(([k, v]) => k !== 'Top_Categories' && k !== 'dataframe_shape' && typeof v === 'number' && v !== null)
                    .slice(0, 6)
                    .map(([k, v]: any, i) => (
                      <div key={i} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{k.replace(/_/g, ' ')}</p>
                        <p className="text-base font-bold text-slate-800 mt-0.5">{v % 1 !== 0 ? v.toFixed(2) : v}</p>
                      </div>
                    ))}
                </div>
              )}

              {}
              {msg.role === 'assistant' && chartData.length > 0 && (
                <div className="bg-white rounded-xl p-3 w-full mt-0.5 border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                    <BarChart2 size={11} /> Distribution
                  </p>
                  <div className="w-full h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} cursor={{ fill: '#f8fafc' }} />
                        <Bar dataKey="value" fill="#3c50e0" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {}
              {msg.role === 'assistant' && msg.structuredQuery && (
                <div className="w-full">
                  <button onClick={() => toggleQuery(msg.id)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-indigo-500 transition px-1">
                    <Code2 size={11} />{isExpanded ? 'Hide Query' : 'View Query'}
                    {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>
                  {isExpanded && (
                    <div className="mt-1.5 bg-slate-900 rounded-xl p-3 max-h-60 overflow-auto">
                      <pre className="text-xs text-emerald-300 leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(msg.structuredQuery, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {loading && (
        <div className="flex gap-2.5">
          <div className="w-8 h-8 shrink-0 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center">
            <Activity size={14} />
          </div>
          <div className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2 shadow-sm">
            <Loader2 size={15} className="text-indigo-500 animate-spin" />
            <span className="text-sm text-slate-500 animate-pulse">Analyzing…</span>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  return (
    <div className="h-screen bg-slate-100 font-sans flex flex-col overflow-hidden">

      {}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={onFileChange}
      />

      {}
      {uploadStatus !== 'idle' && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white
          ${uploadStatus === 'uploading' ? 'bg-indigo-500' : uploadStatus === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {uploadStatus === 'uploading' && <Loader2 size={14} className="animate-spin" />}
          {uploadStatus === 'success' && <CheckCircle2 size={14} />}
          {uploadStatus === 'error' && <AlertCircle size={14} />}
          {uploadMsg}
        </div>
      )}

      {}
      <header className="bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 shrink-0 z-50 shadow-sm sticky top-0" style={{ height: 60 }}>

        {}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#4b4eed] flex items-center justify-center shadow-sm">
            <Database className="text-white" size={16} />
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-[#4b4eed] font-bold text-[15px]">Data Assistant</span>
            <span className="text-[10px] text-slate-400">Database Intelligence</span>
          </div>
          <span className="sm:hidden font-bold text-[#4b4eed] text-[14px]">AI DB</span>
        </div>

        {}
        <div className="flex flex-1 justify-center mx-3 min-w-0">
          {isConnected ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 animate-pulse" />
              <select value={selectedCollection} onChange={e => setSelectedCollection(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white focus:outline-none focus:border-indigo-400 max-w-[140px] sm:max-w-xs truncate">
                {collections.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {selectedCollection.startsWith('upload_') && (
                <button onClick={handleDeleteCollection}
                  title="Delete uploaded collection" className="text-slate-300 hover:text-red-400 transition">
                  <Trash2 size={15} />
                </button>
              )}
              <button onClick={() => { setIsConnected(false); setCollections([]); setSelectedCollection(''); }}
                title="Disconnect" className="text-slate-300 hover:text-red-400 transition">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 w-full max-w-lg">
              <input type="text" placeholder="mongodb+srv:
                onChange={e => setDbUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConnect()}
                className="bg-slate-50 text-xs px-3 py-1.5 rounded-full border border-slate-200 flex-1 min-w-0 text-slate-700 focus:outline-none focus:border-indigo-400 transition" />
              <button onClick={handleConnect} disabled={connecting || !dbUrl}
                className="bg-[#4b4eed] px-3 py-1.5 rounded-full text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-50 transition whitespace-nowrap shrink-0">
                {connecting ? '…' : 'Connect'}
              </button>

              {}
              <span className="text-[10px] text-slate-300 font-bold shrink-0 hidden sm:block">OR</span>

              {}
              <button onClick={openFilePicker}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition shrink-0 whitespace-nowrap opacity-50">
                <FileJson size={13} />
                <span className="hidden sm:inline">Upload JSON</span>
                <span className="sm:hidden">JSON</span>
              </button>
            </div>
          )}
        </div>

        {}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <NavBtn p="chat" icon={<MessageSquare size={14} />} label="Chat" />
          <NavBtn p="insights" icon={<Activity size={14} />} label="Insights" />
          <NavBtn p="history" icon={<Clock size={14} />} label="History" />
        </div>
      </header>

      {}
      <main className="flex-1 w-full max-w-5xl mx-auto my-3 flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-0">

        {}
        {panel === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-5 py-10 px-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                    <Database size={28} className="text-indigo-400" strokeWidth={1.5} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-700 text-lg">Analyze your data with AI</p>
                    <p className="text-sm text-slate-400 mt-1">Connect a MongoDB database, or upload a JSON file directly</p>
                  </div>

                  {}
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm mt-2">
                    <div className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center text-sm text-slate-400 flex flex-col items-center gap-1.5">
                      <Database size={22} className="text-slate-300" strokeWidth={1.5} />
                      <span className="font-semibold text-slate-500">MongoDB URL</span>
                      <span className="text-xs">Paste your URI above</span>
                    </div>
                    <div className="flex items-center justify-center text-xs font-bold text-slate-300">OR</div>
                    <button onClick={openFilePicker}
                      className="flex-1 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-2xl p-4 text-center text-sm flex flex-col items-center gap-1.5 hover:bg-slate-50 transition cursor-pointer group">
                      <FileJson size={22} className="text-slate-300 group-hover:text-slate-500 transition" strokeWidth={1.5} />
                      <span className="font-semibold text-slate-500">Upload JSON File</span>
                      <span className="text-xs text-slate-400">Click to choose a .json file</span>
                    </button>
                  </div>
                </div>
              ) : (
                renderMessages()
              )}
            </div>

            {}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-100 shrink-0">
              <div className="w-full flex items-center gap-2 border border-slate-200 rounded-xl p-1.5 pr-2 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all">
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleQuery()}
                  disabled={loading || !isConnected}
                  placeholder={isListening ? 'Listening…' : isConnected ? 'Ask anything about your data…' : 'Connect a database or upload a JSON file first'}
                  className="flex-1 bg-transparent border-none px-2 py-1.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none disabled:opacity-50" />

                {}
                <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                  <button onClick={() => setVoiceLang('en-US')} disabled={isListening}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${voiceLang === 'en-US' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    EN
                  </button>
                  <button onClick={() => setVoiceLang('hi-IN')} disabled={isListening}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition ${voiceLang === 'hi-IN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    HI
                  </button>
                </div>

                <button onClick={toggleListen} disabled={!isConnected}
                  className={`p-2 rounded-lg transition ${isListening ? 'bg-red-50 text-red-500 animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
                <button onClick={handleQuery} disabled={loading || !isConnected || !query.trim()}
                  className="p-2.5 bg-[#4b4eed] hover:bg-indigo-600 disabled:opacity-40 text-white rounded-lg transition shadow-sm">
                  <Send size={15} />
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                Powered by ZERO ONE Engine
              </p>
            </div>
          </>
        )}

        {}
        {panel === 'insights' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp size={18} className="text-indigo-500" /> Insights
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{insightItems.length} queries analyzed</p>
              </div>
            </div>
            {insightItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Activity size={40} className="text-slate-200" strokeWidth={1.5} />
                <p className="font-semibold text-slate-500 text-sm">No insights yet</p>
                <p className="text-xs text-slate-400">Ask questions in Chat to generate insights</p>
                <button onClick={() => setPanel('chat')} className="mt-2 px-4 py-2 bg-[#4b4eed] text-white text-sm rounded-lg font-medium hover:bg-indigo-600 transition">Go to Chat →</button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {}
                {Object.keys(aggMetrics).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><Hash size={10} /> Latest Metrics</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {Object.entries(aggMetrics).map(([key, vals]) => {
                        const latest = vals[vals.length - 1];
                        const prev = vals.length > 1 ? vals[vals.length - 2] : null;
                        const change = prev !== null ? ((latest - prev) / Math.abs(prev || 1)) * 100 : null;
                        return (
                          <div key={key} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate">{key.replace(/_/g, ' ')}</p>
                            <p className="text-xl font-bold text-slate-800 mt-1">{latest % 1 !== 0 ? latest.toFixed(2) : latest}</p>
                            {change !== null && (
                              <p className={`text-[11px] font-semibold mt-0.5 ${change >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                                {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs prev
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1"><BarChart2 size={10} /> Per-Query Charts</p>
                  <div className="flex flex-col gap-3">
                    {insightItems.map((msg, idx) => {
                      const cd = extractChartData(msg.metrics);
                      const userMsg = messages[messages.indexOf(msg) - 1];
                      return (
                        <div key={msg.id} className="border border-slate-100 rounded-xl p-3 bg-white shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-semibold text-slate-600 truncate flex-1 pr-2">{userMsg?.text || `Query #${idx + 1}`}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">{msg.timestamp}</span>
                          </div>
                          {cd.length > 0 && (
                            <div className="w-full h-32">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={cd}>
                                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
                                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} cursor={{ fill: '#f8fafc' }} />
                                  <Bar dataKey="value" fill="#818cf8" radius={[3, 3, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {}
        {panel === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Clock size={18} className="text-indigo-500" /> History
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{historyItems.length} queries this session</p>
              </div>
              {historyItems.length > 0 && (
                <button onClick={() => { setMessages([]); setPanel('chat'); }}
                  className="flex items-center gap-1 text-xs font-semibold text-red-400 border border-red-100 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            {historyItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <Clock size={40} className="text-slate-200" strokeWidth={1.5} />
                <p className="font-semibold text-slate-500 text-sm">No history yet</p>
                <button onClick={() => setPanel('chat')} className="mt-1 px-4 py-2 bg-[#4b4eed] text-white text-sm rounded-lg font-medium hover:bg-indigo-600 transition">Go to Chat →</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[...historyItems].reverse().map((msg, idx) => {
                  const msgIdx = messages.indexOf(msg);
                  const ai = messages[msgIdx + 1]?.role === 'assistant' ? messages[msgIdx + 1] : null;
                  return (
                    <div key={msg.id} onClick={() => { setPanel('chat'); setTimeout(scrollToBottom, 100); }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-indigo-50/40 hover:border-indigo-100 cursor-pointer group shadow-sm transition">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center text-xs font-bold shrink-0">
                        {historyItems.length - idx}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate group-hover:text-indigo-600">{msg.text}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                          {ai && !ai.error && <span className="text-[10px] font-semibold text-green-500">✓ Answered</span>}
                          {ai?.error && <span className="text-[10px] font-semibold text-red-400">✗ Error</span>}
                          {selectedCollection && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{selectedCollection}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center z-50 shadow-lg safe-bottom">
        {([
          ['chat', <MessageSquare size={19} />, 'Chat'],
          ['insights', <Activity size={19} />, 'Insights'],
          ['history', <Clock size={19} />, 'History'],
        ] as [Panel, React.ReactNode, string][]).map(([p, icon, label]) => (
          <button key={p} onClick={() => setPanel(p)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-[11px] font-semibold transition
              ${panel === p ? 'text-[#4b4eed]' : 'text-slate-400'}`}>
            {icon}
            {label}
            {panel === p && <div className="w-1.5 h-1.5 rounded-full bg-[#4b4eed]" />}
          </button>
        ))}
      </nav>

      {}
      <div className="sm:hidden h-14 shrink-0" />
    </div>
  );
}