import { useState, useRef, useCallback } from "react";
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
    icon: ShieldX,
    emoji: "🔴",
    desc: "GPS/Location data found – your precise whereabouts are embedded in this image.",
  },
  WARNING: {
    label: "Warning",
    color: "text-amber-600 dark:text-yellow-400",
    bg: "bg-amber-50 dark:bg-yellow-400/10 border-amber-200 dark:border-yellow-400/30",
    icon: ShieldAlert,
    emoji: "🟡",
    desc: "Camera metadata found – device specifications and timestamps are exposed.",
  },
  SAFE: {
    label: "Safe",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/30",
    icon: ShieldCheck,
    emoji: "🟢",
    desc: "No sensitive metadata detected. Your privacy is intact.",
  },
};

const GPS_TAGS = ["GPSLatitude", "GPSLongitude", "GPSAltitude", "GPSPosition", "GPS"];
const CAMERA_TAGS = ["Make", "Model", "Software", "DateTime", "DateTimeOriginal", "LensModel"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
function MetaTable({ title, tags, empty }) {
  const [open, setOpen] = useState(true);
  const rows = Object.entries(tags || {});
  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden bg-white dark:bg-[#0c111d]">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
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

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const assessRisk = (extractedTags) => {
    const keys = Object.keys(extractedTags);
    if (keys.some((k) => GPS_TAGS.some((g) => k.startsWith(g)))) return "CRITICAL";
    if (keys.some((k) => CAMERA_TAGS.includes(k))) return "WARNING";
    return "SAFE";
  };

  const analyzeFile = useCallback(async (f) => {
    if (!f.type.startsWith("image/")) {
      showToast("Unsupported file type.", "error");
      return;
    }
    setFile(f);
    setResult(null);
    try {
      const buf = await f.arrayBuffer();
      const extracted = ExifReader.load(buf, { expanded: true });
      const flat = {};
      Object.values(extracted).forEach(group => {
        if (group && typeof group === "object") Object.assign(flat, group);
      });
      delete flat.MakerNote;
      setTags(flat);
      setRisk(assessRisk(flat));
    } catch (e) {
      setTags({});
      setRisk("SAFE");
    }
  }, [showToast]);

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

  const riskInfo = risk ? RISK_LEVELS[risk] : null;
  const RiskIcon = riskInfo?.icon;

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
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{counter.toLocaleString()}</span> secured
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
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-400">Privately & Securely</span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Metadata Analysis: Sensitive location coordinates and device identifiers detected.</p>
          </div>

          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if(e.dataTransfer.files[0]) analyzeFile(e.dataTransfer.files[0]); }}
              onClick={() => inputRef.current.click()}
              className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-4 py-20
                ${dragging ? "border-indigo-500 bg-indigo-500/10" : "border-gray-300 dark:border-white/10 bg-white dark:bg-[#0c111d] hover:border-gray-400 dark:hover:border-white/20"}`}
            >
              <Upload size={28} className={dragging ? "text-indigo-500" : "text-gray-400"} />
              <div className="text-center">
                <p className="font-semibold text-gray-700 dark:text-gray-200">Select or drop an image</p>
                <p className="text-gray-400 text-sm">PNG, JPG, WEBP, HEIC</p>
              </div>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && analyzeFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Info Card */}
              <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0c111d] px-5 py-4">
                <div className="flex items-center gap-3">
                  <FileImage size={20} className="text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500"><X size={20} /></button>
              </div>

              {/* Risk Badge */}
              {riskInfo && RiskIcon && (
                <div className={`flex gap-4 rounded-xl border px-5 py-4 ${riskInfo.bg}`}>
                  <RiskIcon size={24} className={`shrink-0 ${riskInfo.color}`} />
                  <div>
                    <p className={`font-bold text-sm ${riskInfo.color}`}>{riskInfo.emoji} {riskInfo.label} Risk</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs mt-1 leading-relaxed">{riskInfo.desc}</p>
                  </div>
                </div>
              )}

              {/* Size Reduction Card */}
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0c111d] px-5 py-4">
                 <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-3">Security Compression</p>
                 <div className="flex items-center gap-6">
                    <div>
                       <p className="text-[11px] text-gray-400 mb-1">Original</p>
                       <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatBytes(file.size)}</p>
                    </div>
                    <div className="text-gray-300">→</div>
                    <div>
                       <p className="text-[11px] text-gray-400 mb-1">Cleaned</p>
                       <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{result ? formatBytes(result.size) : "—"}</p>
                    </div>
                 </div>
              </div>

              {/* Tables */}
              <div className="space-y-4">
                <MetaTable title="Source Metadata Analysis" tags={tags} empty={false} />
                <MetaTable title="Cleaned Output Structure" tags={result ? {} : tags} empty={!result} />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-2">
                {!result ? (
                  <button onClick={handleStrip} disabled={processing} className="flex-1 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                    {processing ? <><Loader2 size={18} className="animate-spin"/> Scrubbing...</> : <><ShieldCheck size={18}/> Remove Metadata</>}
                  </button>
                ) : (
                  <a href={result.url} download={`clean_${file.name}`} className="flex-1 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2">
                    <Download size={18}/> Download Secured Copy
                  </a>
                )}
                <button onClick={() => setFile(null)} className="px-6 py-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">Reset</button>
              </div>
            </div>
          )}
        </main>
        
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border bg-gray-900 text-white shadow-2xl animate-slide-up">
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
