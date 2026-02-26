import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, AlertTriangle } from "lucide-react";

type LogItem = {
  at: string;
  text_in: string;
  text_out: string;
};

export default function LogsPanel() {
  const backend = String(import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? "" : "http://localhost:4000"));
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const backendOk = true;

  async function load() {
    try {
      setLoading(true);
      setError("");
      const r = await fetch(`${backend}/logs`, {
        cache: "no-store",
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (e: any) {
      setError(e?.message || "Error cargando logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!backendOk) return;
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [backendOk]);

  if (!backendOk) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <div className="text-sm font-semibold text-slate-900">Falta configurar VITE_BACKEND_URL</div>
            <div className="mt-1 text-sm text-slate-600">
              Configuralo en <code className="rounded bg-slate-100 px-1 py-0.5">.env</code> o <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code>.
            </div>
            <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
{`VITE_BACKEND_URL=http://localhost:4000
# o con ngrok:
# VITE_BACKEND_URL=https://TU_URL_NGROK.ngrok-free.dev`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-slate-500">
          Se refresca automáticamente
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
        >
          <RefreshCcw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      {error ? (
        <div className="p-4 text-sm text-red-600 bg-red-50 rounded-2xl">{error}</div>
      ) : (
        <div className="flex flex-col gap-4 pb-10">
          {logs.length === 0 ? (
            <div className="p-6 text-sm text-slate-600 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
              No hay logs todavía.
            </div>
          ) : (
            logs.map((l, idx) => (
              <div key={idx} className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="text-[13px] font-medium text-slate-600">
                     {new Date(l.at).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'medium' })}
                  </div>
                  <div className="text-slate-400">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {/* Entrada */}
                  <div className="bg-[#F0F4FF] rounded-2xl p-3 sm:p-4">
                    <div className="text-[10px] font-bold text-blue-600/80 mb-1">ENTRADA (IN)</div>
                    <div className="whitespace-pre-wrap text-[13px] text-slate-800 font-mono break-all">{l.text_in || "—"}</div>
                  </div>

                  {/* Respuesta */}
                  <div className="bg-[#F2FAF6] rounded-2xl p-3 sm:p-4">
                    <div className="text-[10px] font-bold text-emerald-600/70 mb-1">RESPUESTA (OUT)</div>
                    <div className="whitespace-pre-wrap text-[13px] text-slate-800 font-mono break-all">{l.text_out || "—"}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
