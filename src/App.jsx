import { useState, useRef, useCallback, useEffect } from "react";
import ExifReader from "exifreader";
import {
  ShieldCheck, ShieldAlert, ShieldX, Upload, Download, Moon, Sun, Loader2, X, FileImage,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────
const RISK_LEVELS = {
  CRITICAL: {
    label: "Critical",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-400/10 border-red-200 dark:border-red-400/30",
    dot: "bg-red-500",
    icon: ShieldX,
    emoji: "🔴",
    desc: "GPS/Location data found – your precise whereabouts are embedded in this image.",
  },
  WARNING: {
    label: "Warning",
    color: "text-amber-600 dark:text-yellow-400",
    bg: "bg-amber-50 dark:bg-yellow-400/10 border-amber-200 dark:border-yellow-400/30",
    dot: "bg-amber-500",
    icon: ShieldAlert,
    emoji: "🟡",
    desc: "Camera/Date metadata found – device specifications and timestamps are exposed.",
  },
  SAFE: {
    label: "Safe",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/30",
    dot: "bg-emerald-500",
    icon: ShieldCheck,
    emoji: "🟢",
    desc: "No sensitive metadata detected. Your privacy is intact.",
  },
};

const GPS_TAGS = ["GPSLatitude", "GPSLongitude", "GPSAltitude", "GPSPosition", "GPS"];
const CAMERA_TAGS = ["Make", "Model", "Software", "DateTime", "DateTimeOriginal", "LensModel"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function assessRisk(tags) {
  const keys = Object.keys(tags);
  if (keys.some((k) => GPS_TAGS.some((g) => k.startsWith(g)))) return "CRITICAL";
  if (keys.some((k) => CAMERA_TAGS.includes(k))) return "WARNING";
  return "SAFE";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function tagValue(tag) {
  if (!tag) return "—";
  if (typeof tag === "object" && tag.description !== undefined) return String(tag.description);
  return String(tag);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  const isError = type === "error";
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border shadow-2xl animate-slide-up
        ${isError ? "bg-red-900 border-red-500/40 text-red-50" : "bg-emerald-900 border-emerald-500/40 text-emerald-50"}`}>
      {isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={15} /></button>
    </div>
  );
}

function MetaTable({ title, tags, empty }) {
  const [open, setOpen] = useState(true);
  const rows = Object.entries(tags);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden bg-gray-50/50 dark:bg-white/2">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-3 bg-gray-100/50 dark:bg-white/3 hover:bg-gray-200/50 dark:hover:bg-white/5 transition-colors">
        <span className="text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">{title}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{rows.length} tags</span>
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/5">
                <th className="text-left px-5 py-2 text-gray-400 font-medium w-1/3">Tag</th>
                <th className="text-left px-5 py-2 text-gray-400 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={2} className="px-5 py-4 text-center text-gray-400 italic">No metadata found</td></tr>
              ) : (
                rows.map(([key, val]) => (
                  <tr key={key} className="border-b border-gray-100 dark:border-white/4 last:border-0 hover:bg-gray-200/20 dark:hover:bg-white/2 transition-colors">
                    <td className="px-5 py-2 text-gray-500 dark:text-gray-400 font-mono">{key}</td>
                    <td className={`px-5 py-2 font-mono break-all ${empty ? "text-gray-300 dark:text-gray-600 line-through" : "text-gray-700 dark:text-gray-300"}`}>
                      {tagValue(val)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SizeBar({ original, cleaned }) {
  const pct = cleaned ? Math.round((1 - cleaned / original) * 100) : 0;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/2 px-5 py-4 space-y-3">
      <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">Security Compression</p>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-[11px] text-gray-400 mb-1">Original</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatBytes(original)}</p>
        </div>
        <div className="text-gray-300 pb-1">→</div>
        <div>
          <p className="text-[11px] text-gray-400 mb-1">Cleaned</p>
          <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{cleaned ? formatBytes(cleaned) : "—"}</p>
        </div>
        {pct > 0 && (
          <div className="ml-auto pb-1">
            <span className="text-xs bg-emerald-100 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-400/25 rounded-full px-3 py-1">
              -{pct}% footprint
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [tags, setTags] = useState(null);
  const [risk, setRisk] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [counter, setCounter] = useState(null);
  const inputRef = useRef();

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const analyzeFile = useCallback(async (f) => {
    if (!f.type.startsWith("image/")) {
      showToast("Unsupported file type.", "error");
      return;
    }
    setFile(f);
    setResult(null);
    setTags(null);
    setRisk(null);
    try {
      const buf = await f.arrayBuffer();
      const extracted = ExifReader.load(buf, { expanded: true });
      const flat = {};
      for (const group of Object.values(extracted)) {
        if (group && typeof group === "object") Object.assign(flat, group);
      }
      delete flat.MakerNote;
      setTags(flat);
      setRisk(assessRisk(flat));
    } catch {
      setTags({});
      setRisk("SAFE");
    }
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) analyzeFile(f);
  };

  const handleStrip = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/strip", { method: "POST", body: form });
      if (!res.ok) throw new Error("Processing failed.");
      const blob = await res.blob();
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
      const cnt = res.headers.get("X-Total-Processed");
      if (cnt) setCounter(Number(cnt));
      showToast("Metadata stripped successfully!");
    } catch (err) {
      showToast("Server error. Try again.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => { setFile(null); setTags(null); setRisk(null); setResult(null); };

  const RiskIcon = risk ? RISK_LEVELS[risk].icon : null;
  const riskInfo = risk ? RISK_LEVELS[risk] : null;

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gray-50 dark:bg-[#030712] text-gray-900 dark:text-white font-sans transition-colors duration-500">
        <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-200 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <ShieldCheck size={18} />
            </div>
            <span className="font-bold tracking-tight text-lg">StealthStrip</span>
          </div>
          <div className="flex items-center gap-4">
            {counter !== null && (
              <span className="text-xs text-gray-500">
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{counter.toLocaleString()}</span> files secured
              </span>
            )}
            <button onClick={() => setDark(!dark)} className="p-2 rounded-lg bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 transition-colors">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-6 pt-16 pb-20">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Scrub Image Metadata <br />
              <span className="text-indigo-600 dark:text-indigo-400">Privately & Securely</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-base max-w-xl mx-auto">
              Metadata Analysis: Sensitive location coordinates and device identifiers detected.
            </p>
          </div>

          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current.click()}
              className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 py-20
                ${dragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/5" : "border-gray-300 dark:border-white/10 bg-white dark:bg-white/2 hover:border-gray-400 dark:hover:border-white/20"}`}
            >
              <Upload size={32} className={dragging ? "text-indigo-500" : "text-gray-400"} />
              <div className="text-center">
                <p className="font-semibold text-gray-700 dark:text-gray-300">Select or drop an image</p>
                <p className="text-gray-400 text-sm">PNG, JPG, WEBP, HEIC</p>
              </div>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && analyzeFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="space-y-6 animate-slide-up">
              <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/2 px-5 py-4">
                <div className="flex items-center gap-3">
                  <FileImage size={20} className="text-indigo-500" />
                  <div>
                    <p className="text-sm font-bold truncate max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button onClick={reset} className="text-gray-400 hover:text-red-500"><X size={20} /></button>
              </div>

              {riskInfo && (
                <div className={`flex gap-4 rounded-xl border px-5 py-4 ${riskInfo.bg}`}>
                  <RiskIcon size={24} className={`shrink-0 ${riskInfo.color}`} />
                  <div>
                    <p className={`font-bold text-sm ${riskInfo.color}`}>{riskInfo.emoji} {riskInfo.label} Privacy Risk</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1 leading-relaxed">{riskInfo.desc}</p>
                  </div>
                </div>
              )}

              <SizeBar original={file.size} cleaned={result?.size} />

              <div className="space-y-4">
                <MetaTable title="Source Metadata Analysis" tags={tags} empty={false} />
                <MetaTable title="Cleaned Output Structure" tags={result ? {} : tags} empty={!result} />
              </div>

              <div className="flex gap-4 pt-2">
                {!result ? (
                  <button onClick={handleStrip} disabled={processing} className="flex-1 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all">
                    {processing ? <><Loader2 size={18} className="animate-spin"/> Scrubbing...</> : <><ShieldCheck size={18}/> Remove Metadata</>}
                  </button>
                ) : (
                  <a href={result.url} download={`clean_${file.name}`} className="flex-1 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-all">
                    <Download size={18}/> Download Secured Copy
                  </a>
                )}
                <button onClick={reset} className="px-6 py-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 transition-all">Reset</button>
              </div>
            </div>
          )}
        </main>

        <footer className="text-center text-xs text-gray-400 pb-10">
          StealthStrip — Production Build 1.0.0
        </footer>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}
