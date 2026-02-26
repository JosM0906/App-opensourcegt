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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">Logs de pedidos</div>
          <div className="text-xs text-slate-500">Se refresca automáticamente</div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {loading ? "Cargando" : "Refrescar"}
        </button>
      </div>

      {error ? (
        <div className="p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="max-h-[70vh] overflow-auto">
          {logs.length === 0 ? (
            <div className="p-6 text-sm text-slate-600">No hay logs todavía.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {logs.map((l, idx) => (
                <div key={idx} className="p-4">
                  <div className="text-xs text-slate-500">{new Date(l.at).toLocaleString()}</div>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-700">IN</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{l.text_in}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-700">OUT</div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{l.text_out}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
