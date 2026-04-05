import { useState, useRef, useCallback } from "react";
import ExifReader from "exifreader";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Upload,
  Download,
  Moon,
  Sun,
  Loader2,
  X,
  FileImage,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────
const RISK_LEVELS = {
  CRITICAL: {
    label: "Critical",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/30",
    dot: "bg-red-400",
    icon: ShieldX,
    emoji: "🔴",
    desc: "GPS/Location data found – your precise whereabouts are embedded.",
  },
  WARNING: {
    label: "Warning",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/30",
    dot: "bg-yellow-400",
    icon: ShieldAlert,
    emoji: "🟡",
    desc: "Camera/Date metadata found – device info is exposed.",
  },
  SAFE: {
    label: "Safe",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/30",
    dot: "bg-emerald-400",
    icon: ShieldCheck,
    emoji: "🟢",
    desc: "No sensitive metadata detected.",
  },
};

const GPS_TAGS = ["GPSLatitude", "GPSLongitude", "GPSAltitude", "GPSPosition", "GPS"];
const CAMERA_TAGS = [
  "Make", "Model", "Software", "DateTime", "DateTimeOriginal",
  "DateTimeDigitized", "LensModel", "LensMake",
];

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
  if (typeof tag === "object") return JSON.stringify(tag);
  return String(tag);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  const isError = type === "error";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border shadow-2xl animate-slide-up
        ${isError ? "bg-red-950 border-red-500/40 text-red-200" : "bg-emerald-950 border-emerald-500/40 text-emerald-200"}`}
    >
      {isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}

function MetaTable({ title, tags, empty }) {
  const [open, setOpen] = useState(true);
  const rows = Object.entries(tags);

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-white/3 hover:bg-white/5 transition-colors"
      >
        <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">{title}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{rows.length} tags</span>
          {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-2 text-gray-500 font-medium w-1/3">Tag</th>
                <th className="text-left px-5 py-2 text-gray-500 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-4 text-center text-gray-600 italic">No metadata</td>
                </tr>
              ) : (
                rows.map(([key, val]) => (
                  <tr key={key} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                    <td className="px-5 py-2 text-gray-400 font-mono">{key}</td>
                    <td className={`px-5 py-2 font-mono break-all ${empty ? "text-gray-600 line-through" : "text-gray-300"}`}>
                      {empty ? tagValue(val) : tagValue(val)}
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
    <div className="rounded-xl border border-white/8 bg-white/2 px-5 py-4 space-y-3">
      <p className="text-xs font-semibold tracking-widest uppercase text-gray-400">Size Reduction</p>
      <div className="flex items-end gap-6">
        <div>
          <p className="text-[11px] text-gray-500 mb-1">Original</p>
          <p className="text-lg font-semibold text-white">{formatBytes(original)}</p>
        </div>
        <div className="text-gray-600 pb-1">→</div>
        <div>
          <p className="text-[11px] text-gray-500 mb-1">Cleaned</p>
          <p className="text-lg font-semibold text-emerald-400">{cleaned ? formatBytes(cleaned) : "—"}</p>
        </div>
        {pct > 0 && (
          <div className="ml-auto pb-1">
            <span className="text-xs bg-emerald-400/15 text-emerald-400 border border-emerald-400/25 rounded-full px-3 py-1">
              -{pct}% smaller
            </span>
          </div>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
          style={{ width: `${100 - pct}%` }}
        />
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
  const [result, setResult] = useState(null); // { url, size }
  const [toast, setToast] = useState(null);
  const [counter, setCounter] = useState(null);
  const inputRef = useRef();

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const analyzeFile = useCallback(async (f) => {
    if (!f.type.startsWith("image/")) {
      showToast("Only image files are supported.", "error");
      return;
    }
    setFile(f);
    setResult(null);
    setTags(null);
    setRisk(null);

    try {
      const buf = await f.arrayBuffer();
      const extracted = ExifReader.load(buf, { expanded: true });
      // Flatten all tag groups
      const flat = {};
      for (const group of Object.values(extracted)) {
        if (group && typeof group === "object") {
          Object.assign(flat, group);
        }
      }
      // Remove the MakerNote bloat
      delete flat.MakerNote;
      setTags(flat);
      setRisk(assessRisk(flat));
    } catch {
      setTags({});
      setRisk("SAFE");
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) analyzeFile(f);
    },
    [analyzeFile]
  );

  const handleStrip = async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/strip", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResult({ url, size: blob.size });

      // Get updated counter from header
      const cnt = res.headers.get("X-Total-Processed");
      if (cnt) setCounter(Number(cnt));

      showToast("Metadata stripped successfully!");
    } catch (err) {
      showToast(err.message || "Server error. Check your API deployment.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setTags(null);
    setRisk(null);
    setResult(null);
  };

  const RiskIcon = risk ? RISK_LEVELS[risk].icon : null;
  const riskInfo = risk ? RISK_LEVELS[risk] : null;

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-[#030712] text-white font-sans">
        {/* ── Nav ── */}
        <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <ShieldCheck size={14} />
            </div>
            <span className="font-bold tracking-tight text-lg">StealthStrip</span>
          </div>
          <div className="flex items-center gap-4">
            {counter !== null && (
              <span className="text-xs text-gray-500">
                <span className="text-violet-400 font-semibold">{counter.toLocaleString()}</span> files cleaned globally
              </span>
            )}
            <button
              onClick={() => setDark((d) => !d)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </nav>

        {/* ── Hero ── */}
        <main className="max-w-3xl mx-auto px-6 pt-16 pb-20">
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Strip Image Metadata
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
                Privately & Instantly
              </span>
            </h1>
            <p className="text-gray-400 text-base max-w-xl mx-auto leading-relaxed">
              Your EXIF data reveals GPS coordinates, camera model, timestamps and more.
              StealthStrip removes it all — processed securely on our server, never shared.
            </p>
          </div>

          {/* ── Drop Zone ── */}
          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current.click()}
              className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
                flex flex-col items-center justify-center gap-4 py-20
                ${dragging
                  ? "border-violet-400 bg-violet-400/5"
                  : "border-white/10 bg-white/2 hover:border-white/20 hover:bg-white/3"}`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all
                ${dragging ? "bg-violet-400/20" : "bg-white/5"}`}>
                <Upload size={24} className={dragging ? "text-violet-400" : "text-gray-400"} />
              </div>
              <div className="text-center">
                <p className="text-white font-medium mb-1">Click, or drop your files here</p>
                <p className="text-gray-500 text-sm">Supports JPEG, PNG, HEIC, WEBP, TIFF</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files[0] && analyzeFile(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="space-y-5">
              {/* File header */}
              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/2 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <FileImage size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white truncate max-w-[220px]">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                  </div>
                </div>
                <button onClick={reset} className="text-gray-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Risk Badge */}
              {riskInfo && (
                <div className={`flex items-start gap-4 rounded-xl border px-5 py-4 ${riskInfo.bg}`}>
                  <RiskIcon size={20} className={`mt-0.5 shrink-0 ${riskInfo.color}`} />
                  <div>
                    <p className={`font-semibold text-sm ${riskInfo.color}`}>
                      {riskInfo.emoji} {riskInfo.label} Risk
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">{riskInfo.desc}</p>
                  </div>
                </div>
              )}

              {/* Size Bar */}
              <SizeBar original={file.size} cleaned={result?.size} />

              {/* Metadata Tables */}
              {tags && (
                <div className="space-y-3">
                  <MetaTable title="Before — Detected Metadata" tags={tags} empty={false} />
                  <MetaTable
                    title="After — Cleaned Output"
                    tags={result ? {} : tags}
                    empty={!result}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                {!result ? (
                  <button
                    onClick={handleStrip}
                    disabled={processing}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                      bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500
                      font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-900/30"
                  >
                    {processing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Stripping metadata…
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        Strip All Metadata
                      </>
                    )}
                  </button>
                ) : (
                  <a
                    href={result.url}
                    download={`clean_${file.name}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                      bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500
                      font-semibold text-sm transition-all shadow-lg shadow-emerald-900/30"
                  >
                    <Download size={16} />
                    Download Cleaned Image
                  </a>
                )}
                <button
                  onClick={reset}
                  className="px-5 py-3 rounded-xl border border-white/10 bg-white/3 hover:bg-white/6
                    text-sm text-gray-400 hover:text-white transition-all"
                >
                  New File
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="text-center text-xs text-gray-600 pb-8">
          StealthStrip — Your privacy, stripped clean.
        </footer>

        {/* ── Toast ── */}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    </div>
  );
}
