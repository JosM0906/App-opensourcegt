
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarModule } from "./CalendarModule";
import {
  LayoutDashboard,
  Package,
  ScrollText,
  Link2,
  Bot,
  Megaphone,
  CalendarClock,
  CalendarDays,
  Settings,
  Cloud,
  Search,
  LayoutGrid,
  List,
  Plus,
  Trash2,
  Edit2,
  Play,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  Pause,
  ExternalLink,
  Menu,
  FileEdit,
  Trash,
  UploadCloud,
  Image as ImageIcon,
  MessageCircle,
  BarChart3, // Added BarChart3
  Save, // Added for AI Config
  RefreshCw, // Added for AI Config
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

import { AppTab, Campaign, Message, Product } from "./types";
import { INITIAL_CATALOG, formatProductId } from "./constants";
import { geminiService } from "./services/geminiService";
import LogsPanel from "./src/components/LogsPanel";
// import SheetsModule from "./src/components/SheetsModule"; // Commented out until module exists

const backend = String(import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? window.location.origin : "http://localhost:4000"));

// Ngrok (evita la pantalla de warning)
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" };

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
    processing: "bg-purple-50 text-purple-700 border-purple-200",
    sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <span className={classNames("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", map[status] || "bg-slate-50 text-slate-700 border-slate-200")}>
      {status}
    </span>
  );
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={className} 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      fill="#ffffff" 
      d="M12.072 1.761a10.05 10.05 0 00-8.654 15.157L2 22l5.226-1.351a10.05 10.05 0 104.846-18.888z" 
    />
    <path 
      fill="#25D366" 
      d="M12.072 3.012a8.8 8.8 0 00-7.574 13.264l-.48 2.505 2.548-.66a8.8 8.8 0 105.506-15.109z" 
    />
    <path 
      fill="#ffffff" 
      d="M16.92 14.156c-.287-.144-1.705-.838-1.968-.934-.264-.096-.456-.144-.648.144-.191.288-.742.936-.91 1.127-.167.192-.335.216-.622.072-.287-.144-1.21-.448-2.304-1.423-.852-.76-1.428-1.7-1.595-1.987-.167-.288-.018-.443.126-.586.13-.128.287-.336.43-.504.144-.168.192-.288.287-.48.096-.192.048-.36-.024-.504-.072-.144-.648-1.56-.887-2.136-.233-.56-.47-.484-.647-.492-.168-.008-.36-.01-.551-.01-.192 0-.503.072-.767.36-.263.287-1.006.984-1.006 2.398 0 1.415 1.03 2.784 1.173 2.976.144.192 2.025 3.091 4.904 4.335.684.296 1.219.472 1.636.604.688.22 1.314.188 1.807.114.551-.082 1.696-.694 1.936-1.365.24-.67.24-1.246.167-1.366-.072-.12-.263-.191-.55-.335z" 
    />
  </svg>
);


type Role = "guest" | "client" | "admin";

function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-xl font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{actions}</div> : null}
    </div>
  );
}


function SendProductModal({
  isOpen,
  onClose,
  product,
  backend
}: {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  backend: string;
}) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheetNumbers, setSheetNumbers] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPhone("");
      setSent(false);
      setError("");
      setLoading(false);
      setSheetNumbers([]);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  async function loadFromSheets() {
    setLoadingSheets(true);
    setError("");
    try {
      const res = await fetch(`${backend}/api/sheets/numbers`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error cargando números de Google Sheets");
      
      if (Array.isArray(data.numbers) && data.numbers.length > 0) {
        setSheetNumbers(data.numbers);
      } else {
        setError("No se encontraron números válidos en la hoja de cálculo.");
      }
    } catch (e: any) {
      setError(e.message || "Error de conexión");
    } finally {
      setLoadingSheets(false);
    }
  }

  async function handleSend() {
    if (!phone.trim()) return;
    setLoading(true);
    setError("");
    
    try {
      // Construct logic
      let imgLink = product?.imageUrl || "";
      if (imgLink && imgLink.startsWith("/")) {
        imgLink = `${backend}${imgLink}`;
      }
      
      const caption = `Hola! Aquí está el producto: *${product?.name}* a Q${Number(product?.price).toFixed(2)}`;
      
      const res = await fetch(`${backend}/api/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: phone,
          message: caption,
          mediaUrl: imgLink.includes("placehold") ? null : imgLink
        })
      });
      
      if (!res.ok) throw new Error("Error enviando mensaje");
      
      setSent(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (e: any) {
      setError(e.message || "Error al enviar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Enviar por WhatsApp 📱</h3>
        <p className="text-sm text-slate-600 mb-4">
          Se enviará <b>{product.name}</b> a este número:
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Número de WhatsApp (con 502)</label>
            <input 
              value={phone} onChange={e => {
                let val = e.target.value.trim();
                // Si el usuario selecciona del autocomplete y no tiene 502, se lo agregamos
                if (val && sheetNumbers.includes(val) && !val.startsWith("502")) {
                  val = "502" + val;
                }
                setPhone(val);
              }}
              list="sheet-phone-numbers"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              placeholder="Ej. 50212345678"
              autoFocus
            />
            {sheetNumbers.length > 0 && (
              <datalist id="sheet-phone-numbers">
                {sheetNumbers.map((num, i) => (
                  <option key={i} value={num} />
                ))}
              </datalist>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
             <button
               onClick={loadFromSheets}
               disabled={loadingSheets}
               className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
             >
               {loadingSheets ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cloud className="h-3 w-3" />}
               Cargar números desde Google Sheets
             </button>
             {sheetNumbers.length > 0 && (
               <div className="text-xs text-slate-500 text-center">
                 Se cargaron {sheetNumbers.length} números. Empieza a escribir arriba para usarlos.
               </div>
             )}
          </div>

          {error && (
             <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600">
               {error}
             </div>
          )}
          
          {sent && (
             <div className="rounded-xl bg-green-50 p-3 text-xs text-green-600 flex items-center gap-2">
               <CheckCircle2 className="h-4 w-4" /> Enviado correctamente
             </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button 
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSend}
              disabled={loading || sent || !phone}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A1A31] disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppIcon className="h-4 w-4" />}
              {sent ? "Enviado" : "Enviar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductModal({
  isOpen,
  onClose,
  initialData,
  onSave,
  loading
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData: Product | null;
  onSave: (p: Partial<Product>) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || "");
      setPrice(initialData?.price ? String(initialData.price) : "");
      setCategory(initialData?.category || "General");
      setStock(initialData?.stock ? String(initialData.stock) : "0");
      setImageUrl(initialData?.imageUrl || "https://placehold.co/400");
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 transition-all">
      <div className="w-full max-w-md sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl pb-safe p-6 sm:p-8 animate-in slide-in-from-bottom duration-300">
        <h3 className="text-xl sm:text-lg font-bold text-slate-900 mb-6 sm:mb-5">
          {initialData ? "Editar Producto" : "Nuevo Producto"}
        </h3>
        
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide ml-1 mb-1 block">Nombre</label>
            <input 
              value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-2xl border-none bg-slate-100 px-4 py-3.5 sm:py-3 text-sm font-medium text-slate-800 outline-none focus:bg-slate-200/60 transition-colors placeholder-slate-400"
              placeholder="Ej. Taza..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide ml-1 mb-1 block">Precio (Q)</label>
              <input 
                type="number"
                value={price} onChange={e => setPrice(e.target.value)}
                className="w-full rounded-2xl border-none bg-slate-100 px-4 py-3.5 sm:py-3 text-sm font-medium text-slate-800 outline-none focus:bg-slate-200/60 transition-colors placeholder-slate-400"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide ml-1 mb-1 block">Stock</label>
              <input 
                type="number"
                value={stock} onChange={e => setStock(e.target.value)}
                className="w-full rounded-2xl border-none bg-slate-100 px-4 py-3.5 sm:py-3 text-sm font-medium text-slate-800 outline-none focus:bg-slate-200/60 transition-colors placeholder-slate-400"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide ml-1 mb-1 block">Categoría</label>
            <input 
              value={category} onChange={e => setCategory(e.target.value)}
              className="w-full rounded-2xl border-none bg-slate-100 px-4 py-3.5 sm:py-3 text-sm font-medium text-slate-800 outline-none focus:bg-slate-200/60 transition-colors placeholder-slate-400"
              placeholder="General"
            />
          </div>
           <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide ml-1 mb-1 block">URL Imagen</label>
            <input 
              value={imageUrl} onChange={e => setImageUrl(e.target.value)}
              className="w-full rounded-2xl border-none bg-slate-100 px-4 py-3.5 sm:py-3 text-sm font-medium text-slate-800 outline-none focus:bg-slate-200/60 transition-colors placeholder-slate-400"
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-2">
          <button 
            onClick={onClose} 
            className="w-full sm:w-auto rounded-2xl bg-slate-100 px-5 py-3.5 sm:py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button 
            disabled={loading}
            onClick={() => onSave({ name, price: Number(price), category, stock: Number(stock), imageUrl })}
            className="w-full sm:w-auto rounded-2xl bg-[#0B1F3A] px-5 py-3.5 sm:py-2.5 text-sm font-semibold text-white hover:bg-[#0A1A31] disabled:opacity-50 transition-colors"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const CLIENT_PASS = String(import.meta.env.VITE_CLIENT_PASSWORD || "");
  const ADMIN_PASS = String(import.meta.env.VITE_ADMIN_PASSWORD || "");

  const [role, setRole] = useState<Role>(() => {
    const saved = localStorage.getItem("osgt_role") as Role | null;
    return saved || "guest";
  });

  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");

  // Admin unlock (desde panel cliente)
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminErr, setAdminErr] = useState("");

  function doLogout() {
    if (role === "admin") {
      // Downgrade to client
      localStorage.setItem("osgt_role", "client");
      setRole("client");
      setAdminPass("");
      setAdminErr("");
      setAdminModalOpen(false);
      setActiveTab(AppTab.METRICS); // Go to a safe client tab
    } else {
      // Full logout
      localStorage.removeItem("osgt_role");
      setRole("guest");
      setLoginPass("");
      setLoginErr("");
      setAdminPass("");
      setAdminErr("");
      setAdminModalOpen(false);
    }
  }

  function doClientLogin() {
    setLoginErr("");
    if (!CLIENT_PASS) {
      setLoginErr("Configura VITE_CLIENT_PASSWORD en .env.local");
      return;
    }
    if (loginPass.trim() !== CLIENT_PASS.trim()) {
      setLoginErr("Contraseña incorrecta.");
      return;
    }
    localStorage.setItem("osgt_role", "client");
    setRole("client");
    setLoginPass("");
    setLoginErr("");
  }

  function doAdminUnlock() {
    setAdminErr("");
    if (!ADMIN_PASS) {
      setAdminErr("Configura VITE_ADMIN_PASSWORD en .env.local");
      return;
    }
    if (adminPass.trim() !== ADMIN_PASS.trim()) {
      setAdminErr("Contraseña admin incorrecta.");
      return;
    }
    localStorage.setItem("osgt_role", "admin");
    setRole("admin");
    setAdminPass("");
    setAdminErr("");
    setAdminModalOpen(false);
  }


  // LOGIN 
  const loginScreen = (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <div className="h-24 w-24 flex items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <img 
              src="/img/logo.png" 
              alt="Logo"
              className="h-full w-full object-contain p-2"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </div>

        {/* Título centrado */}
        <div className="mt-5 text-center">
          <div className="text-2xl font-semibold text-slate-900">OpenSourceGT</div>
          <div className="text-sm text-slate-600 mt-1">Bienvenido Almacén el Tesoro</div>
        </div>

        {/* Card */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600">Contraseña</label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="••••••••"
                onKeyDown={(e) => {
                  if (e.key === "Enter") doClientLogin();
                }}
              />
            </div>

            {loginErr ? <div className="text-sm text-red-600">{loginErr}</div> : null}

            <button
              type="button"
              onClick={doClientLogin}
              className="w-full rounded-2xl bg-[#0B1F3A] text-white py-3 text-sm font-semibold hover:bg-[#0A1A31] active:scale-[0.99] transition"
            >
              Iniciar sesión
            </button>

          </div>
        </div>
      </div>
    </div>
  );

  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.METRICS);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Catalog
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Send Modal
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [productToSend, setProductToSend] = useState<Product | null>(null);

  
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogView, setCatalogView] = useState<"cards" | "list">("cards");
  const [catalogFolder, setCatalogFolder] = useState("");
  
  // Product Modal
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);

  async function handleSaveProduct(partial: Partial<Product>) {
     if (!backendOk) return;
     setCatalogLoading(true);
     try {
       const url = editingProd ? `${backend}/catalog/${editingProd.id}` : `${backend}/catalog`;
       const method = editingProd ? "PUT" : "POST";
       
       const start = Date.now();
       const res = await fetch(url, {
         method,
         headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
         body: JSON.stringify(partial)
       });
       
       if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || res.statusText);
       }
       
       await loadCatalog();
       setProdModalOpen(false);
       setEditingProd(null);
     } catch (e: any) {
       alert("Error guardando producto: " + e.message);
     } finally {
       setCatalogLoading(false);
     }
  }

  function openNewProduct() {
    setEditingProd(null);
    setProdModalOpen(true);
  }

  function openEditProduct(p: Product) {
    setEditingProd(p);
    setProdModalOpen(true);
  }

  async function loadCatalog() {
    setCatalogLoading(true);
    setCatalogError("");

    try {
      const res = await fetch(`${backend}/catalog`, { headers: NGROK_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Asegura array
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setCatalog(items);
    } catch (err: any) {
      // Fallback para que no quede vacío
      setCatalog(INITIAL_CATALOG);
      setCatalogError(
        `No pude cargar el catálogo desde el backend (${backend}). ` +
          `Usando catálogo local temporal. Detalle: ${err?.message ?? err}`
      );
    } finally {
      setCatalogLoading(false);
    }
  }


  async function uploadCatalogPdf(file: File) {
    setUploading(true);
    setCatalogError(null);

    try {
      const form = new FormData();
      form.append("archivo", file);
      if (catalogFolder.trim()) {
        form.append("folderName", catalogFolder.trim());
      }

      const res = await fetch(`${backend}/catalog/upload`, {
        method: "POST",
        headers: NGROK_HEADERS,
        body: form,
      });

      // Si el server responde HTML, esto tronará -> lo capturamos
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      // Recarga desde /catalog (ya guardado)
      await loadCatalog();
    } catch (err: any) {
      setCatalogError(`No pude subir el PDF. Detalle: ${err?.message ?? err}`);
    } finally {
      setUploading(false);
    }
  }

  // AI tester
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campLoading, setCampLoading] = useState(false);
  const [campError, setCampError] = useState<string>("");
  const [campFormOpen, setCampFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const [formName, setFormName] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formScheduledAtLocal, setFormScheduledAtLocal] = useState(""); // yyyy-mm-ddThh:mm
  const [formNumbersRaw, setFormNumbersRaw] = useState("");
  const [formDelayMs, setFormDelayMs] = useState<number>(2500);
  const [formMediaUrl, setFormMediaUrl] = useState("");
  const [parseInfo, setParseInfo] = useState<{ valid: number; invalid: number; duplicatesRemoved: number } | null>(null);

  // Custom Campaigns
  const [customCampFormOpen, setCustomCampFormOpen] = useState(false);
  const [customFormName, setCustomFormName] = useState("");
  const [customFormMessage, setCustomFormMessage] = useState("");
  const [customFormDelayMs, setCustomFormDelayMs] = useState<number>(2500);
  const [customFormMediaUrl, setCustomFormMediaUrl] = useState("");
  const [customNumbersInput, setCustomNumbersInput] = useState("");
  const [customNumbersList, setCustomNumbersList] = useState<{ id: string, phone: string, scheduledAtLocal: string }[]>([]);

  const backendOk = true;

  // Fake metrics (replace with real API later)
  // Real Metrics
  const [metrics, setMetrics] = useState({
    totalConversations: 0,
    totalOrders: 0,
    revenue: 0,
    avgReplyMin: 0,
    chartBars: [],
    chartLine: [],
    interactions: null as any
  });

  // Bot Panel Persistence
  const [hasOpenedBotPanel, setHasOpenedBotPanel] = useState(false);
  useEffect(() => {
    if (activeTab === AppTab.BOT_PANEL && !hasOpenedBotPanel) {
      setHasOpenedBotPanel(true);
    }
  }, [activeTab]);

  async function loadMetrics() {
    if (!backendOk) return;
    try {
      const r = await fetch(`${backend}/api/metrics`, { headers: { "ngrok-skip-browser-warning": "true" } });
      const data = await r.json();
      if (data && !data.error) {
        setMetrics(data);
      }
    } catch (e) {
      console.error("Error loading metrics:", e);
    }
  }

  // AI Config
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Load initial data
    loadMetrics();
    // Load prompt if admin
    if (role === 'admin') {
      fetch(`${backend}/admin/prompt`, { headers: NGROK_HEADERS })
        .then(r => r.json())
        .then(d => d.prompt && setSystemPrompt(d.prompt))
        .catch(e => console.error("Error loading prompt:", e));
    }
  }, [role, backend]);

  const handleSavePrompt = async () => {
    setIsSavingPrompt(true);
    try {
      const res = await fetch(`${backend}/admin/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
        body: JSON.stringify({ prompt: systemPrompt })
      });
      if (res.ok) {
        alert("Prompt actualizado correctamente");
      } else {
        alert("Error al guardar el prompt");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleSyncPrompt = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${backend}/admin/prompt/sync`, {
        method: "POST",
        headers: NGROK_HEADERS
      });
      const data = await res.json();
      
      if (res.ok && data.prompt) {
        setSystemPrompt(data.prompt);
        alert("Prompt sincronizado correctamente desde BuilderBot Cloud");
      } else {
        alert("Error al sincronizar: " + (data.error || "Desconocido"));
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión al sincronizar");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (activeTab === AppTab.METRICS || activeTab === AppTab.QR) loadMetrics();
  }, [activeTab]);

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q) || (p.id || "").toLowerCase().includes(q));
  }, [catalog, catalogQuery]);

  async function loadCampaigns() {
    if (!backendOk) return;
    try {
      setCampLoading(true);
      setCampError("");
      const r = await fetch(`${backend}/campaigns`, { headers: { "ngrok-skip-browser-warning": "true" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : Array.isArray(data) ? data : []);
    } catch (e: any) {
      setCampError(e?.message || "Error cargando campañas");
    } finally {
      setCampLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === AppTab.CAMPAIGNS || activeTab === AppTab.CAMPAIGN_CALENDAR) {
      loadCampaigns();
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab === AppTab.CATALOG) {
      // Si ya hay data, no recargar cada vez (opcional)
      if (catalog.length === 0) loadCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, backend]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  function openCreateCampaign() {
    setEditing(null);
    setFormName("");
    setFormMessage("");
    setFormNumbersRaw("");
    setFormDelayMs(2500);
    setFormMediaUrl("");
    setParseInfo(null);
    setFormScheduledAtLocal("");
    setCampFormOpen(true);
  }

  function openEditCampaign(c: Campaign) {
    if (c.isCustom) {
      setEditing(c);
      setCustomFormName(c.name || "");
      setCustomFormMessage(c.message || "");
      setCustomFormDelayMs(Number(c.delayMs ?? 2500));
      setCustomFormMediaUrl(c.mediaUrl || "");
      
      const numsList = (c.numbers || []).map((n: any) => {
         const phone = typeof n === "string" ? n : n.phone;
         const rawDate = typeof n === "string" ? "" : (n.scheduledAt || "");
         
         let localStr = "";
         if (rawDate) {
            try {
              const d = new Date(rawDate);
              const pad = (v: number) => String(v).padStart(2, '0');
              localStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            } catch {
              localStr = rawDate;
            }
         }

         return {
            id: Math.random().toString(36).substring(7),
            phone,
            scheduledAtLocal: localStr
         };
      });
      setCustomNumbersList(numsList);
      setCustomNumbersInput("");
      setCustomCampFormOpen(true);
      return;
    }

    setEditing(c);
    setFormName(c.name || "");
    setFormMessage(c.message || "");
    setFormDelayMs(Number(c.delayMs ?? 2500));
    setFormMediaUrl(c.mediaUrl || "");
    setFormNumbersRaw((c.numbers || []).join("\n"));
    setParseInfo(null);
    try {
      const d = new Date(c.scheduledAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      setFormScheduledAtLocal(`${yyyy}-${mm}-${dd}T${hh}:${mi}`);
    } catch {
      setFormScheduledAtLocal("");
    }
    setCampFormOpen(true);
  }

  async function parseNumbers() {
    if (!backendOk) return;
    try {
      setParseInfo(null);
      const r = await fetch(`${backend}/campaigns/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ raw: formNumbersRaw }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const numbers = Array.isArray(data.numbers) ? data.numbers : [];
      setFormNumbersRaw(numbers.join("\n"));
      setParseInfo({
        valid: Number(data.valid ?? numbers.length ?? 0),
        invalid: Number(data.invalid ?? 0),
        duplicatesRemoved: Number(data.duplicatesRemoved ?? 0),
      });
    } catch (e: any) {
      setParseInfo(null);
      setCampError(e?.message || "Error parseando números");
    }
  }

  async function saveCampaign() {
    if (!backendOk) return;
    if (!formName.trim() || !formMessage.trim() || !formScheduledAtLocal) {
      setCampError("Completa nombre, mensaje y fecha/hora.");
      return;
    }
    const scheduledISO = new Date(formScheduledAtLocal).toISOString();
    const numbers = formNumbersRaw
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    try {
      setCampLoading(true);
      setCampError("");
      const payload = { name: formName.trim(), message: formMessage.trim(), scheduledAt: scheduledISO, numbers, delayMs: formDelayMs, mediaUrl: formMediaUrl };
      const url = editing ? `${backend}/campaigns/${editing.id}` : `${backend}/campaigns`;
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCampFormOpen(false);
      setEditing(null);
      await loadCampaigns();
    } catch (e: any) {
      setCampError(e?.message || "Error guardando campaña");
    } finally {
      setCampLoading(false);
    }
  }

  // --- Custom Campaigns ---
  async function openCustomCampaign() {
    setEditing(null);
    setCustomFormName("");
    setCustomFormMessage("");
    setCustomNumbersInput("");
    setCustomFormDelayMs(2500);
    setCustomFormMediaUrl("");
    setCustomNumbersList([]);
    setCustomCampFormOpen(true);
  }

  async function parseAndAddCustomNumbers() {
    if (!backendOk || !customNumbersInput.trim()) return;
    try {
      setCampLoading(true);
      const r = await fetch(`${backend}/campaigns/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ raw: customNumbersInput }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const numbers = Array.isArray(data.numbers) ? data.numbers : [];
      
      const newItems = numbers.map((phone: string, index: number) => {
        const d = new Date();
        // Arrancar en 2 minutos a partir de ahora, y espaciar cada número por 1 minuto adicional
        d.setMinutes(d.getMinutes() + 2 + index); 
        
        const pad = (n: number) => n < 10 ? '0'+n : n;
        const localStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

        return {
          id: Math.random().toString(36).substring(7),
          phone,
          scheduledAtLocal: localStr
        };
      });

      // Merge avoiding duplicates
      setCustomNumbersList(prev => {
         const existingPhones = new Set(prev.map(p => p.phone));
         const uniqueNew = newItems.filter((i: any) => !existingPhones.has(i.phone));
         return [...prev, ...uniqueNew];
      });
      
      setCustomNumbersInput(""); // clear input
    } catch (e: any) {
      setCampError(e?.message || "Error parseando números");
    } finally {
      setCampLoading(false);
    }
  }

  function removeCustomNumber(id: string) {
    setCustomNumbersList(prev => prev.filter(n => n.id !== id));
  }

  function updateCustomNumberDate(id: string, dateStr: string) {
    setCustomNumbersList(prev => prev.map(n => n.id === id ? { ...n, scheduledAtLocal: dateStr } : n));
  }

  async function saveCustomCampaign() {
    if (!backendOk) return;
    if (!customFormName.trim() || !customFormMessage.trim() || customNumbersList.length === 0) {
      setCampError("Completa nombre, mensaje y al menos un número.");
      return;
    }

    try {
      setCampLoading(true);
      setCampError("");
      
      // Convert entries to server format
      const formattedNumbers = customNumbersList.map(n => ({
        phone: n.phone,
        scheduledAt: n.scheduledAtLocal ? new Date(n.scheduledAtLocal).toISOString() : null,
        status: "scheduled",
        attempts: 0
      })).filter(n => n.scheduledAt);

      if (formattedNumbers.length === 0) {
        throw new Error("Todas las fechas deben ser válidas.");
      }

      const payload = { 
        name: customFormName.trim(), 
        message: customFormMessage.trim(), 
        mediaUrl: customFormMediaUrl,
        numbers: formattedNumbers, 
        delayMs: customFormDelayMs,
        isCustom: true
      };
      
      const url = editing ? `${backend}/campaigns/${editing.id}` : `${backend}/campaigns`;
      const method = editing ? "PUT" : "POST";

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setCustomCampFormOpen(false);
      setEditing(null);
      await loadCampaigns();
    } catch (e: any) {
       setCampError(e?.message || "Error guardando campaña personalizada");
    } finally {
       setCampLoading(false);
    }
  }

  async function deleteCampaign(id: string) {
    if (!backendOk) return;
    try {
      setCampLoading(true);
      setCampError("");
      const r = await fetch(`${backend}/campaigns/${id}`, { method: "DELETE", headers: { "ngrok-skip-browser-warning": "true" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadCampaigns();
    } catch (e: any) {
      setCampError(e?.message || "Error eliminando campaña");
    } finally {
      setCampLoading(false);
    }
  }

  async function togglePauseCampaign(id: string) {
    if (!backendOk) return;
    try {
      setCampLoading(true);
      const r = await fetch(`${backend}/campaigns/${id}/toggle-pause`, {
        method: "POST",
        headers: { "ngrok-skip-browser-warning": "true" }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await loadCampaigns();
    } catch (e: any) {
      setCampError(e?.message || "Error alternando pausa de campaña");
    } finally {
      setCampLoading(false);
    }
  }

  async function runCampaignNow(id: string) {
    if (!backendOk) return;
    try {
      setCampLoading(true);
      setCampError("");
      const r = await fetch(`${backend}/campaigns/${id}/run`, { method: "POST", headers: { "ngrok-skip-browser-warning": "true" } });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      await loadCampaigns();
    } catch (e: any) {
      setCampError(e?.message || "Error ejecutando campaña");
    } finally {
      setCampLoading(false);
    }
  }

  async function handleCampaignImageUpload(file: File | undefined, isCustom: boolean) {
    if (!file || !backendOk) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setCampLoading(true);
      setCampError("");
      const r = await fetch(`${backend}/upload-media`, {
        method: "POST",
        body: formData,
      });
      const data = await r.json();
      if (data.ok && data.mediaUrl) {
         if (isCustom) setCustomFormMediaUrl(data.mediaUrl);
         else setFormMediaUrl(data.mediaUrl);
      } else {
         throw new Error(data.error || "Error al subir imagen");
      }
    } catch(e: any) {
      setCampError(e.message);
    } finally {
      setCampLoading(false);
    }
  }

  const [showCatalogForMedia, setShowCatalogForMedia] = useState<{isOpen: boolean, isCustom: boolean}>({isOpen: false, isCustom: false});
  const [catalogMediaSearch, setCatalogMediaSearch] = useState("");

  function selectCatalogImage(url: string | undefined, isCustom: boolean) {
     if (!url) return;
     let finalUrl = url.startsWith('/') ? `${backend}${url}` : url;
     if (isCustom) setCustomFormMediaUrl(finalUrl);
     else setFormMediaUrl(finalUrl);
     setShowCatalogForMedia({isOpen: false, isCustom: false});
     setCatalogMediaSearch("");
  }

  async function tickCron() {
    if (!backendOk) return;
    try {
      setCampLoading(true);
      setCampError("");
      const r = await fetch(`${backend}/cron/tick`, { headers: { "ngrok-skip-browser-warning": "true" } });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${r.status}`);
      }
      await loadCampaigns();
    } catch (e: any) {
      setCampError(e?.message || "Error en cron tick");
    } finally {
      setCampLoading(false);
    }
  }

  async function sendTestMessage() {
    if (!chatInput.trim()) return;
    const userMsg: Message = { role: "user", text: chatInput.trim(), timestamp: new Date() };
    setChatMessages((m) => [...m, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      if (!backendOk) {
        // fallback to local gemini service
        const reply = await geminiService.generateResponse(userMsg.text, catalog);
        setChatMessages((m) => [...m, { role: "model", text: reply, timestamp: new Date() }]);
      } else {
        const r = await fetch(`${backend}/mensaje`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
          body: JSON.stringify({ text: userMsg.text, history: chatMessages.map(({ role, text }) => ({ role, text })), catalog }),
        });
        const data = await r.json();
        const textToDisplay = data?.reply || data?.text || data?.error || "Error: El bot no devolvió una respuesta vacía";
        setChatMessages((m) => [...m, { role: "model", text: String(textToDisplay), timestamp: new Date() }]);
      }
    } catch (e: any) {
      setChatMessages((m) => [...m, { role: "model", text: `Error: ${e?.message || e}`, timestamp: new Date() }]);
    } finally {
      setChatLoading(false);
    }
  }

    const CLIENT_NAV = [
    { key: AppTab.METRICS, label: "Métricas", icon: LayoutDashboard },
    { key: AppTab.AI_STUDIO, label: "AI Studio", icon: Bot },
    { key: AppTab.CATALOG, label: "Catálogo", icon: Package },
    { key: AppTab.CAMPAIGN_CALENDAR, label: "Calendario", icon: CalendarDays },
    { key: AppTab.MASS_MESSAGES, label: "Mensajes masivos", icon: Megaphone },
  ] as const;

  const ADMIN_NAV = [
    { key: AppTab.METRICS, label: "Métricas", icon: LayoutDashboard },
    { key: AppTab.CATALOG, label: "Catálogo", icon: Package },
    { key: AppTab.LOGS, label: "Logs", icon: ScrollText },
    { key: AppTab.SHEETS, label: "Sheet bridge", icon: Link2 },
    { key: AppTab.AI_STUDIO, label: "AI Studio", icon: Bot }, // Unified
    { key: AppTab.BOT_PANEL, label: "Panel del Bot", icon: ExternalLink },
    { key: AppTab.MASS_MESSAGES, label: "Mensajes masivos", icon: Megaphone },
    { key: AppTab.CAMPAIGN_CALENDAR, label: "Calendario", icon: CalendarDays },
    { key: AppTab.CAMPAIGNS, label: "Campañas", icon: CalendarClock },
  ] as const;

  const nav = useMemo(() => {
    if (role === "admin") return ADMIN_NAV;
    return CLIENT_NAV;
  }, [role]);




  const calendarGrouped = useMemo(() => {
    const groups: Record<string, Campaign[]> = {};
    for (const c of campaigns) {
      const d = new Date(c.scheduledAt);
      const key = isNaN(d.getTime()) ? "Sin fecha" : d.toLocaleDateString();
      groups[key] = groups[key] || [];
      groups[key].push(c);
    }
    Object.values(groups).forEach((arr) => arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()));
    return groups;
  }, [campaigns]);

  return role === "guest" ? loginScreen : (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar (mobile) */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            <Menu className="h-4 w-4" />
            Menú
          </button>
          <div className="flex items-center gap-2">
            <img src="/img/logo.png" alt="Logo" className="h-6 w-auto object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
            <div className="text-sm font-semibold text-slate-900">OpenSourceGT</div>
          </div>
        </div>
      </div>

      <div className="flex w-full min-h-screen items-stretch md:gap-6 px-0 md:px-6 py-0 md:py-6">

        {/* Sidebar Overlay (mobile only) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-10 bg-slate-900/40 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={classNames(
            "fixed inset-y-0 left-0 z-20 w-72 transform bg-slate-50 transition-transform duration-300 md:relative md:z-auto md:translate-x-0 md:bg-transparent",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-full md:sticky md:top-6 md:h-[calc(100vh-3rem)] rounded-none md:rounded-3xl border-r md:border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/img/logo.png" alt="Logo" className="h-8 w-8 object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">OpenSourceGT</div>
                    <div className="text-xs text-slate-500">{role === "admin" ? "Panel administrativo" : "Panel cliente"}</div>
                  </div>
                </div>
                <span
                  className={classNames("h-2.5 w-2.5 shrink-0 rounded-full", backendOk ? "bg-emerald-500" : "bg-slate-300")}
                  title={backendOk ? "Backend OK" : "Sin backend"}
                />
              </div>
            </div>

            {/* Menu (scroll si crece) */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="space-y-1">
                {nav.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActiveTab(item.key)}
                      className={classNames(
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium",
                        active ? "bg-[#0B1F3A] text-white" : "text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <Icon className={classNames("h-4 w-4", active ? "text-white" : "text-slate-500")} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

           {/* Footer */}
            <div className="border-t border-slate-100 p-3">
              <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                {/* Solo la tuerquita */}
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setActiveTab(AppTab.SETTINGS)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100"
                    title="Configuración"
                    type="button"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                </div>

                {/* Admin unlock (solo cliente) */}
                {role === "client" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAdminErr("");
                      setAdminPass("");
                      setAdminModalOpen(true);
                    }}
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Modo Administrador
                  </button>
                ) : null}

                {/* Logout */}
                <button
                  type="button"
                  onClick={doLogout}
                  className="mt-3 w-full rounded-2xl bg-[#0B1F3A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0A1A31]"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </aside>


        {/* Main */}
        <main className="flex-1 px-4 py-6 md:px-0 md:py-0 pb-10">
          {/* METRICS */}
          {activeTab === AppTab.METRICS && (
            <>
              <PageHeader title="Métricas" subtitle="Vista general del rendimiento. " />
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-500">Conversaciones</div>
                  <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold text-slate-900">{metrics.totalConversations}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-500">Pedidos</div>
                  <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold text-slate-900">{metrics.totalOrders}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-500">Ingresos</div>
                  <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold text-slate-900">Q{metrics.revenue.toLocaleString()}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                  <div className="text-[10px] sm:text-xs font-semibold text-slate-500">Resp. promedio</div>
                  <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold text-slate-900">{metrics.avgReplyMin} min</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Pedidos por día" subtitle="Ejemplo semanal">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.chartBars}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="orders" fill="#0B1F3A" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="Leads por día" subtitle="Ejemplo semanal">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics.chartLine}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="leads" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* ADMIN INTERACTIONS */}
              {role === "admin" && metrics.interactions && (
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Actividad Administrativa</h3>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                    <Card title="Mensajes Manuales" subtitle="Enviados por botón">
                       <div className="text-xl sm:text-2xl font-bold text-[#0B1F3A]">{metrics.interactions.manual_messages || 0}</div>
                    </Card>
                    <Card title="Ediciones Catálogo" subtitle="Creación/Edición">
                       <div className="text-xl sm:text-2xl font-bold text-[#0B1F3A]">{metrics.interactions.catalog_updates || 0}</div>
                    </Card>
                    <Card title="PDFs Subidos" subtitle="Actualizaciones masivas">
                       <div className="text-xl sm:text-2xl font-bold text-[#0B1F3A]">{metrics.interactions.pdf_uploads || 0}</div>
                    </Card>
                    <Card title="Campañas" subtitle="Creadas">
                       <div className="text-xl sm:text-2xl font-bold text-[#0B1F3A]">{metrics.interactions.campaigns_created || 0}</div>
                    </Card>
                  </div>
                </div>
              )}
            </>
          )}


          {/* AI STUDIO */}
          {activeTab === AppTab.AI_STUDIO && (
            <>
              <PageHeader 
                title="AI Studio" 
                subtitle="Entrena y prueba tu asistente en un solo lugar."
                actions={
                  <div className="flex gap-2">
                     <button
                        onClick={handleSyncPrompt}
                        disabled={isSyncing || isSavingPrompt}
                        className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4 text-blue-600" />}
                        {isSyncing ? "Sincronizando..." : "Sincronizar Cloud"}
                      </button>
                      <button
                        onClick={() => setChatMessages([])}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Trash2 className="h-4 w-4" /> Limpiar Chat
                      </button>
                  </div>
                }
              />

              <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 lg:h-[75vh]">
                
                 {/* CHAT AREA (Left) */}
                 <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-slate-200 p-4 text-sm font-semibold text-slate-900 bg-slate-50 flex items-center justify-between">
                    <span className="flex items-center gap-2"><Bot className="h-4 w-4 text-indigo-600"/> Chat de Prueba</span>
                    <span className="text-xs text-slate-500 font-normal">Prueba tus cambios en tiempo real</span>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Bot className="h-12 w-12 mb-2 opacity-20" />
                        <div className="text-sm">Escribí un mensaje para probar el flujo.</div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatMessages.map((m, idx) => (
                          <div key={idx} className={classNames("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                            <div
                              className={classNames(
                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                                m.role === "user" ? "bg-[#0B1F3A] text-white" : "bg-white text-slate-900 border border-slate-100"
                              )}
                            >
                              <div className="whitespace-pre-wrap">{m.text}</div>
                              <div className={classNames("mt-1 text-[11px]", m.role === "user" ? "text-white/70" : "text-slate-400")}>
                                {m.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </div>
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-100 px-4 py-3 text-sm text-slate-500 shadow-sm">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-slate-200 p-3 bg-white">
                    <div className="flex gap-2">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") sendTestMessage();
                        }}
                        placeholder="Escribe un mensaje de prueba..."
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white transition-colors"
                      />
                      <button
                        onClick={sendTestMessage}
                        disabled={chatLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0A1A31] disabled:opacity-60 transition-colors"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* EDITOR AREA (Right) */}
                <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[75vh] sm:min-h-[500px] lg:min-h-0">
                   <div className="border-b border-slate-200 p-4 flex items-center justify-between bg-slate-50">
                     <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                       <FileEdit className="h-4 w-4 text-emerald-600" /> Editor de Prompt
                     </div>
                     <button
                        onClick={handleSavePrompt}
                        disabled={isSavingPrompt}
                        className="px-3 py-1.5 bg-[#0B1F3A] text-white rounded-lg hover:bg-[#0A1A31] disabled:opacity-50 text-xs font-semibold flex items-center gap-2"
                      >
                        {isSavingPrompt ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Guardar Prompt
                      </button>
                   </div>
                   <div className="flex-1 relative min-h-[65vh] sm:min-h-[400px] lg:min-h-0">
                      <textarea
                        className="w-full h-full p-4 font-mono text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none resize-none overflow-y-auto"
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Cargando prompt..."
                      />
                   </div>
                   <div className="p-2 bg-slate-100 text-[10px] text-slate-500 text-center border-t border-slate-200">
                     Los cambios guardados se aplican inmediatamente al bot.
                   </div>
                </div>

              </div>
            </>
          )}

          {/* CATALOG */}
          {activeTab === AppTab.CATALOG && (
            <>
              <PageHeader
                title="Catálogo"
                subtitle="Historial de productos disponibles. Puedes verlos por tarjetas o listado."
                actions={
                  <>
                  <div className="flex flex-wrap w-full items-center gap-2 pb-2 md:w-auto md:pb-0">
                    <div className="relative shrink-0 flex-1 min-w-[140px]">
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        value={catalogQuery}
                        onChange={(e) => setCatalogQuery(e.target.value)}
                        placeholder="Buscar producto…"
                        className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
                      />
                    </div>
                    <button
                      onClick={loadCatalog}
                      disabled={catalogLoading}
                      className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      title="Recargar catálogo"
                    >
                      <RefreshCcw className={classNames("h-4 w-4", catalogLoading ? "animate-spin" : "")} />
                    </button>

                    <button
                      onClick={() => setCatalogView((v) => (v === "cards" ? "list" : "cards"))}
                      className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      title={catalogView === "cards" ? "Ver Lista" : "Ver Tarjetas"}
                    >
                      {catalogView === "cards" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                    </button>

                    <button
                      onClick={openNewProduct}
                      className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[#0B1F3A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0A1A31]"
                    >
                      <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo</span>
                    </button>
                    
                    <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadCatalogPdf(f);
                          e.currentTarget.value = ""; 
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Carpeta (ej: 2024)"
                        value={catalogFolder}
                        onChange={(e) => setCatalogFolder(e.target.value)}
                        className="flex-1 min-w-[120px] rounded-2xl border border-slate-200 bg-white py-2 px-3 text-sm outline-none focus:border-slate-400"
                      />
                      <button
                        onClick={() => {
                          if (!catalogFolder.trim()) {
                            alert("Ingresa la carpeta.");
                            return;
                          }
                          fileRef.current?.click();
                        }}
                        disabled={uploading}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                         <UploadCloud className="h-4 w-4" />
                         <span className="text-xs sm:text-sm">{uploading ? "..." : "Subir PDF"}</span>
                      </button>
                    </div>
                  </div>
                  </>
                }
              />

              {catalogLoading && <div style={{ padding: 12, opacity: 0.8 }}>Cargando catálogo…</div>}

              {catalogError && (
                <div style={{ padding: 12, color: "#b00020" }}>
                  {catalogError}
                </div>
              )}

              {catalogView === "cards" ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredCatalog.map((p) => (
                    <div key={p.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
                      <div className="p-4 flex-1">
                        
                        {/* Fila 1: Título y Precio */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="text-[15px] font-bold text-slate-900 leading-tight flex-1">
                            {p.name}
                          </div>
                          <div className="text-[15px] font-bold text-slate-900 shrink-0">
                            Q{Number(p.price).toFixed(2)}
                          </div>
                        </div>

                        {/* Fila 2: Categoría, ID y Botón Editar */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                           <div className="text-[13px] text-slate-500 leading-snug">
                             {p.category} - <span className="font-mono">{p.id}</span>
                           </div>
                           <button 
                             onClick={() => openEditProduct(p)}
                             className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors shrink-0 mt-1"
                             title="Editar"
                           >
                              <Edit2 className="h-4 w-4" />
                           </button>
                        </div>

                        {/* Fila 3: Stock */}
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 mb-2">
                          <div className="text-[13px] font-medium text-slate-500">Stock Disponible</div>
                          <div className="text-[14px] font-bold text-slate-900">{p.stock}</div>
                        </div>

                      </div>
                      
                      {/* Fila 4: Botones (Copiar y WhatsApp) */}
                      <div className="px-4 pb-4 flex gap-3">
                        <button
                          onClick={() => navigator.clipboard.writeText(`${p.name} - Q${Number(p.price).toFixed(2)}`)}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-3 text-[14px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                          title="Copiar información"
                        >
                          Copiar
                        </button>
                         <button
                           onClick={() => {
                             setProductToSend(p);
                             setSendModalOpen(true);
                           }}
                           className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#0F2035] px-2 py-3 text-[14px] font-semibold text-white hover:bg-[#0A1A31] transition-colors shadow-sm"
                         >
                           <WhatsAppIcon className="h-5 w-5 shrink-0 text-emerald-400" /> 
                           <span>Enviar</span>
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                    <div className="col-span-5">Producto</div>
                    <div className="col-span-3">Categoría</div>
                    <div className="col-span-2 text-right">Precio</div>
                    <div className="col-span-2 text-right">Stock</div>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {filteredCatalog.map((p) => (
                      <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm">
                        <div className="col-span-5">
                          <div className="font-medium text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500">{formatProductId(p.id)}</div>
                        </div>
                        <div className="col-span-3 text-slate-700">{p.category}</div>
                        <div className="col-span-2 text-right font-semibold text-slate-900">Q{Number(p.price).toFixed(2)}</div>
                        <div className="col-span-2 text-right text-slate-700">{p.stock}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* LOGS */}
          {activeTab === AppTab.LOGS && (
            <>
              <PageHeader title="Logs" subtitle="Historial de pedidos y conversaciones (entrada/salida)." />
              <LogsPanel />
            </>
          )}

          {/* SHEETS */}
          {activeTab === AppTab.SHEETS && (
            <SheetsModule backend={backend} backendOk={backendOk} />
          )}



          {/* BOT PANEL (iframe) - Persistente para evitar recargas */}
          <div className={activeTab === AppTab.BOT_PANEL ? "block" : "hidden"}>
            {hasOpenedBotPanel && (
              <>
                <PageHeader 
                  title="Panel del Bot" 
                  subtitle="Configura y gestiona el bot." 
                  actions={
                    <a
                      href="https://script.google.com/macros/s/AKfycbw5ursMj-vJkCibr4-x-6IeaMSS1gTiYRAVTPyXlYh44QjrdrSKVR-tjgi3GFTnBsozQg/exec"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#0B1F3A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0A1A31] w-full sm:w-auto justify-center"
                    >
                      <ExternalLink className="h-4 w-4" /> Abrir en nueva ventana
                    </a>
                  }
                />
                
                {/* Advertencia Solo en Móvil acerca de cookies y Google Login */}
                <div className="md:hidden mb-4 rounded-xl bg-amber-50 p-4 border border-amber-200 shadow-sm">
                  <p className="text-xs text-amber-800">
                    <strong>Nota para móviles:</strong> Si ves un "Error 403" de Google, se debe a la seguridad de tu teléfono. Toca el botón <strong>"Abrir en nueva ventana"</strong> de arriba.
                  </p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm h-[78vh]">
                  <iframe 
                    title="panel-bot" 
                    src="/embedded/panel.html" 
                    className="h-full w-full border-none" 
                  />
                </div>
              </>
            )}
          </div>

          {/* MASS MESSAGES (iframe) */}
          {activeTab === AppTab.MASS_MESSAGES && (
            <>
              <PageHeader title="Mensajes masivos" subtitle="Carga Excel o pega números." />
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <iframe 
                  title="mensajes-masivos" 
                  src={`/embedded/mensajes.html?backend=${encodeURIComponent(backend)}`} 
                  className="h-[78vh] w-full" 
                />
              </div>
            </>
          )}

          {/* CALENDAR INFO */}
          {activeTab === AppTab.CAMPAIGN_CALENDAR && (
            <>
              <PageHeader
                title="Calendario"
                subtitle="Vista informativa de campañas por día."
                actions={
                  <button
                    onClick={loadCampaigns}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCcw className={campLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Actualizar
                  </button>
                }
              />

              {!backendOk ? (
                <Card title="Backend requerido" subtitle="Configura VITE_BACKEND_URL para ver campañas.">
                  <div className="text-sm text-slate-600">Sin backend no hay campañas guardadas.</div>
                </Card>
              ) : campError ? (
                <Card title="Error">
                  <div className="text-sm text-red-600">{campError}</div>
                </Card>
              ) : (
                <div className="w-full h-[70vh] sm:h-[700px]">
                  <CalendarModule 
                    campaigns={campaigns}
                    onDateSelect={(date) => {
                         // Open create modal with this date
                         setEditing(false);
                         setFormName("");
                         setFormMessage("");
                         // Set time to 10:00 AM of selected date
                         const atom = new Date(date);
                         atom.setHours(10, 0, 0, 0);
                         
                         const pad = (n) => n < 10 ? '0'+n : n;
                         const localStr = `${atom.getFullYear()}-${pad(atom.getMonth()+1)}-${pad(atom.getDate())}T10:00`;
                         
                         setFormScheduledAtLocal(localStr);
                         setFormNumbersRaw("");
                         setParseInfo(null);
                         
                         // We need to switch tab to Campaigns to show the modal? 
                         // Check if modal is global. Yes it is global but rendered inside CAMPAIGNS tab conditional.
                         // We need to move the modal outside or switch tabs.
                         // For now, let's switch tab to CAMPAIGNS and open modal.
                         setActiveTab(AppTab.CAMPAIGNS);
                         setCampFormOpen(true);
                      }}
                    onEditCampaign={(c) => {
                      setActiveTab(AppTab.CAMPAIGNS);
                      openEditCampaign(c);
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* CAMPAIGNS CRUD */}
          {activeTab === AppTab.CAMPAIGNS && (
            <>
              <PageHeader
                title="Campañas"
                subtitle="Crea, programa y dispara campañas. El envío automático se ejecuta desde /cron/tick."
                actions={
                  <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                      onClick={tickCron}
                      className="col-span-1 inline-flex items-center justify-center gap-1 sm:gap-2 rounded-2xl border border-slate-200 bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Play className="h-3 w-3 sm:h-4 sm:w-4" /> Ejecutar tick
                    </button>
                    <button
                      onClick={openCreateCampaign}
                      className="col-span-1 inline-flex items-center justify-center gap-1 sm:gap-2 rounded-2xl bg-[#0B1F3A] px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#0A1A31]"
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" /> Nueva
                    </button>
                    <button
                      onClick={openCustomCampaign}
                      className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1 sm:gap-2 rounded-2xl bg-[#0B1F3A] px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#0A1A31]"
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" /> Personalizada
                    </button>
                  </div>
                }
              />

              {!backendOk ? (
                <Card title="Backend requerido" subtitle="Configura VITE_BACKEND_URL para usar campañas.">
                  <div className="text-sm text-slate-600">Sin backend, no se pueden guardar campañas.</div>
                </Card>
              ) : (
                <>
                  {campError ? (
                    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{campError}</div>
                  ) : null}

                  {/* Mobile View: Cards */}
                  <div className="md:hidden space-y-4">
                    {campaigns.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No hay campañas todavía.</div>
                    ) : (
                      campaigns
                        .slice()
                        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                        .map((c) => (
                           <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-bold text-slate-900">{c.name}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 tracking-wider uppercase">{c.isCustom ? "Personalizada" : "Estándar"}</div>
                                </div>
                                <Badge status={c.status} />
                              </div>
                              <div className="text-sm text-slate-600 line-clamp-2 italic">"{c.message}"</div>
                              <div className="flex flex-col gap-1 text-[11px] text-slate-500 pt-2 border-t border-slate-50">
                                <div className="flex items-center gap-1.5">
                                   <CalendarClock className="w-3.5 h-3.5" />
                                   {new Date(c.scheduledAt).toLocaleString()}
                                </div>
                                <div className="flex items-center gap-1.5">
                                   <ScrollText className="w-3.5 h-3.5" />
                                   {c.isCustom && typeof c.numbers[0] === 'object' ? c.numbers.length : c.numbers?.length ?? 0} destinatarios
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 pt-2">
                                {c.status === "scheduled" || c.status === "paused" ? (
                                  <button
                                    onClick={() => togglePauseCampaign(c.id)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    {c.status === "paused" ? <Play className="h-3.5 w-3.5 text-emerald-600" /> : <Pause className="h-3.5 w-3.5 text-amber-600" />}
                                    {c.status === "paused" ? "Reanudar" : "Pausar"}
                                  </button>
                                ) : null}
                                <button
                                  onClick={() => runCampaignNow(c.id)}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  <Send className="h-3.5 w-3.5" /> Enviar
                                </button>
                                <button
                                  onClick={() => openEditCampaign(c)}
                                  className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteCampaign(c.id)}
                                  className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                           </div>
                        ))
                    )}
                  </div>

                  {/* Desktop View: Table */}
                  <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="min-w-[800px]">
                      <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
                        <div className="col-span-4">Campaña</div>
                        <div className="col-span-3">Fecha/Hora</div>
                        <div className="col-span-2">Estado</div>
                        <div className="col-span-1 text-right">#</div>
                        <div className="col-span-2 text-right">Acciones</div>
                      </div>

                      <div className="divide-y divide-slate-200">
                        {campaigns.length === 0 ? (
                          <div className="p-6 text-sm text-slate-600">No hay campañas todavía.</div>
                        ) : (
                          campaigns
                            .slice()
                            .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
                            .map((c) => (
                              <div key={c.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                                <div className="col-span-4">
                                  <div className="font-semibold text-slate-900">{c.name}</div>
                                  <div className="line-clamp-1 text-xs text-slate-500">{c.message}</div>
                                </div>
                                <div className="col-span-3 text-slate-700">
                                  {c.isCustom 
                                    ? (() => {
                                        if (!c.numbers || c.numbers.length === 0) return "Sin fechas";
                                        const dates = c.numbers.map((n: any) => new Date(n.scheduledAt || ""));
                                        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
                                        return minDate.toLocaleString();
                                      })()
                                    : new Date(c.scheduledAt).toLocaleString()}
                                </div>
                                <div className="col-span-2">
                                  <Badge status={c.status} />
                                </div>
                                <div className="col-span-1 text-right text-slate-700">
                                  {c.isCustom && typeof c.numbers[0] === 'object' ? c.numbers.length : c.numbers?.length ?? 0}
                                </div>
                                <div className="col-span-2 flex justify-end gap-1">
                                  {c.status === "scheduled" || c.status === "paused" ? (
                                    <button
                                      onClick={() => togglePauseCampaign(c.id)}
                                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                      title={c.status === "paused" ? "Reanudar" : "Pausar"}
                                    >
                                      {c.status === "paused" ? <Play className="h-3.5 w-3.5 text-emerald-600" /> : <Pause className="h-3.5 w-3.5 text-amber-600" />}
                                    </button>
                                  ) : null}
                                  <button
                                    onClick={() => runCampaignNow(c.id)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    title="Enviar"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => openEditCampaign(c)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    title="Editar"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteCampaign(c.id)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Modal */}
              {campFormOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
                  <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{editing ? "Editar campaña" : "Nueva campaña"}</div>
                        <div className="text-xs text-slate-500">Los números se limpian y deduplican con /campaigns/parse.</div>
                      </div>
                      <button onClick={() => setCampFormOpen(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Cerrar
                      </button>
                    </div>

                    <div className="space-y-4 p-5">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Nombre</label>
                          <input value={formName} onChange={(e) => setFormName(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Fecha/hora (local)</label>
                          <input type="datetime-local" value={formScheduledAtLocal} onChange={(e) => setFormScheduledAtLocal(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600">Mensaje</label>
                        <textarea value={formMessage} onChange={(e) => setFormMessage(e.target.value)} rows={4} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                          <label className="text-xs font-semibold text-slate-800">Imagen / Archivo Adjunto (Opcional)</label>
                          <div className="mt-2 flex overflow-hidden flex-col sm:flex-row gap-2">
                            <input 
                              type="text" 
                              value={formMediaUrl} 
                              onChange={(e) => setFormMediaUrl(e.target.value)} 
                              placeholder="URL del archivo o sube uno..." 
                              className="w-full flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 bg-white" 
                            />
                            <div className="flex gap-2">
                              <div className="relative shrink-0">
                                <input 
                                  type="file" 
                                  accept="image/*,video/mp4,application/pdf"
                                  onChange={(e) => handleCampaignImageUpload(e.target.files?.[0], false)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <button type="button" className="inline-flex w-full whitespace-nowrap items-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300">
                                  <UploadCloud className="h-4 w-4" /> Subir PC
                                </button>
                              </div>
                              <button type="button" onClick={() => setShowCatalogForMedia({isOpen: true, isCustom: false})} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                                <ImageIcon className="h-4 w-4" /> Catálogo
                              </button>
                            </div>
                          </div>
                          {formMediaUrl && (
                             <div className="mt-3">
                               <img src={formMediaUrl} alt="Preview" className="h-[80px] w-auto max-w-[200px] object-cover rounded-lg border border-slate-200 shadow-sm" onError={(e) => e.currentTarget.style.display='none'}/>
                             </div>
                          )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Delay (ms) entre mensajes</label>
                          <input
                            type="number"
                            value={formDelayMs}
                            onChange={(e) => setFormDelayMs(Number(e.target.value || 0))}
                            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                          />
                          <div className="mt-1 text-xs text-slate-500">Recomendado: 2000–4000ms</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-700">Tip</div>
                          <div className="mt-1 text-xs text-slate-600">Usá el módulo “Mensajes masivos” si querés subir Excel. Aquí podés pegar números.</div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-600">Números (uno por línea)</label>
                          <button
                            onClick={parseNumbers}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Limpiar / Deduplicar
                          </button>
                        </div>
                        <textarea value={formNumbersRaw} onChange={(e) => setFormNumbersRaw(e.target.value)} rows={6} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
                        {parseInfo ? (
                          <div className="mt-2 text-xs text-slate-600">
                            ✅ Válidos: <b>{parseInfo.valid}</b> • ❌ Inválidos: <b>{parseInfo.invalid}</b> • 🔁 Duplicados removidos: <b>{parseInfo.duplicatesRemoved}</b>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                      <button onClick={() => setCampFormOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Cancelar
                      </button>
                      <button
                        onClick={saveCampaign}
                        disabled={campLoading}
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A1A31] disabled:opacity-60"
                      >
                        {campLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Custom Campaign Modal */}
              {customCampFormOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl flex flex-col max-h-[90vh]">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Nueva campaña personalizada</div>
                        <div className="text-xs text-slate-500">Asigna fechas y horas distintas a cada número. Se guardará como 1 sola campaña.</div>
                      </div>
                      <button onClick={() => setCustomCampFormOpen(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        Cerrar
                      </button>
                    </div>

                    <div className="p-5 flex-1 overflow-y-auto space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Nombre de la campaña</label>
                          <input value={customFormName} onChange={e => setCustomFormName(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600">Delay entre mensajes (ms)</label>
                          <input type="number" value={customFormDelayMs} onChange={e => setCustomFormDelayMs(Number(e.target.value))} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-600">Mensaje (El mismo para todos)</label>
                        <textarea value={customFormMessage} onChange={e => setCustomFormMessage(e.target.value)} rows={3} className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400" />
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                          <label className="text-xs font-semibold text-slate-800">Imagen / Archivo Adjunto (Opcional)</label>
                          <div className="mt-2 flex flex-col sm:flex-row gap-2">
                            <input 
                              type="text" 
                              value={customFormMediaUrl} 
                              onChange={(e) => setCustomFormMediaUrl(e.target.value)} 
                              placeholder="URL del archivo o sube uno..." 
                              className="w-full flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 bg-white" 
                            />
                            <div className="flex gap-2">
                              <div className="relative shrink-0">
                                <input 
                                  type="file" 
                                  accept="image/*,video/mp4,application/pdf"
                                  onChange={(e) => handleCampaignImageUpload(e.target.files?.[0], true)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <button type="button" className="inline-flex w-full whitespace-nowrap items-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300">
                                  <UploadCloud className="h-4 w-4" /> Subir PC
                                </button>
                              </div>
                              <button type="button" onClick={() => setShowCatalogForMedia({isOpen: true, isCustom: true})} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                                <ImageIcon className="h-4 w-4" /> Catálogo
                              </button>
                            </div>
                          </div>
                          {customFormMediaUrl && (
                             <div className="mt-3">
                               <img src={customFormMediaUrl} alt="Preview" className="h-[80px] w-auto max-w-[200px] object-cover rounded-lg border border-slate-200 shadow-sm" onError={(e) => e.currentTarget.style.display='none'}/>
                             </div>
                          )}
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50 space-y-3">
                        <div className="font-semibold text-sm text-slate-800">1. Agregar números masivamente</div>
                        <p className="text-xs text-slate-600">Pega tu lista de números. Al parsear, se les asignará automáticamente una fecha espaciada (arrancando en 2 minutos y sumando 1 minuto a cada número subsecuente) y podrás ajustarla individualmente abajo.</p>
                        <textarea value={customNumbersInput} onChange={e => setCustomNumbersInput(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 bg-white" placeholder="Pega números uno por línea..."></textarea>
                        <div className="flex justify-end">
                           <button onClick={parseAndAddCustomNumbers} disabled={campLoading || !customNumbersInput.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0A1A31] disabled:opacity-50">
                             {campLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : <Plus className="h-3 w-3" />}
                             Parsear y añadir a la tabla
                           </button>
                        </div>
                      </div>

                      <div>
                        <div className="font-semibold text-sm text-slate-800 mb-2">2. Fechas individualizadas ({customNumbersList.length} números)</div>
                        {customNumbersList.length === 0 ? (
                          <div className="text-xs text-slate-400 text-center p-4 border border-dashed rounded-xl border-slate-200">Aún no has agregado números a la tabla.</div>
                        ) : (
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                             <div className="grid grid-cols-12 gap-2 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">
                               <div className="col-span-5">Número de teléfono</div>
                               <div className="col-span-5">Fecha / Hora (Local)</div>
                               <div className="col-span-2 text-right">Acción</div>
                             </div>
                             <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto bg-white">
                                {customNumbersList.map(n => (
                                  <div key={n.id} className="grid grid-cols-12 gap-2 px-4 py-2 items-center text-sm">
                                    <div className="col-span-5 font-medium">{n.phone}</div>
                                    <div className="col-span-5">
                                      <input type="datetime-local" value={n.scheduledAtLocal} onChange={e => updateCustomNumberDate(n.id, e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-indigo-400" />
                                    </div>
                                    <div className="col-span-2 flex justify-end">
                                       <button onClick={() => removeCustomNumber(n.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded-lg">
                                         <Trash2 className="h-4 w-4" />
                                       </button>
                                    </div>
                                  </div>
                                ))}
                             </div>
                          </div>
                        )}
                      </div>

                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4 shrink-0 bg-slate-50">
                      <button onClick={() => setCustomCampFormOpen(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                        Cancelar
                      </button>
                      <button
                        onClick={saveCustomCampaign}
                        disabled={campLoading || customNumbersList.length === 0}
                        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {campLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Guardar Campaña
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {/* SETTINGS */}
          {activeTab === AppTab.SETTINGS && (
            <>
              <PageHeader title="Configuración" subtitle="Ajustes rápidos del panel." />
              <div className="grid gap-4 xl:grid-cols-2">
                <Card title="Backend" subtitle="URL del backend para consumir logs, campañas y tester AI.">
                  <div className="text-sm text-slate-700">
                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      <div className="font-semibold text-slate-700">Frontend (.env / .env.local)</div>
                      <div className="mt-1">
                        <code>VITE_BACKEND_URL={backend || "http://localhost:4000"}</code>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card title="Notas" subtitle="Siguientes mejoras (si querés)">
                  <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                    <li>Roles: Admin vs Cliente (ocultar Panel del Bot / masivos)</li>
                    <li>Catálogo: persistencia en Sheets o DB</li>
                    <li>Métricas: conectar a logs reales y dashboard histórico</li>
                    <li>Campañas: log por número (sent/failed), reintentos y "cancelar"</li>
                  </ul>
                </Card>
              </div>
            </>
          )}




        </main>
      </div>

      {/* Catalog Image Selector Modal */}
      {showCatalogForMedia.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
           <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl flex flex-col max-h-[85vh]">
             <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
               <div>
                 <div className="text-sm font-semibold text-slate-900">Elegir imagen del catálogo</div>
                 <div className="text-xs text-slate-500">Selecciona un producto para usar su imagen principal.</div>
               </div>
               <button onClick={() => { setShowCatalogForMedia({isOpen: false, isCustom: showCatalogForMedia.isCustom}); setCatalogMediaSearch(""); }} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                 Cerrar
               </button>
             </div>
             
             <div className="p-4 border-b border-slate-100 bg-white shrink-0">
               <input
                 type="text"
                 placeholder="Buscar producto por nombre..."
                 value={catalogMediaSearch}
                 onChange={(e) => setCatalogMediaSearch(e.target.value)}
                 className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-400"
               />
             </div>

             <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto flex-1 bg-slate-50 custom-scrollbar">
               {catalog
                 .filter(p => !!p.imageUrl && !p.imageUrl.includes("placehold"))
                 .filter(p => p.name.toLowerCase().includes(catalogMediaSearch.toLowerCase()))
                 .map(p => (
                  <div key={p.id} onClick={() => selectCatalogImage(p.imageUrl, showCatalogForMedia.isCustom)} className="group relative rounded-2xl bg-white border border-slate-200 overflow-hidden cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all">
                     <div className="aspect-square bg-slate-100 flex items-center justify-center relative">
                        <img src={p.imageUrl?.startsWith('/') ? `${backend}${p.imageUrl}` : p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     </div>
                     <div className="p-2 text-center text-xs font-medium text-slate-800 line-clamp-1 flex flex-col items-center">
                       <span>{p.name}</span>
                       <span className="text-[10px] text-slate-500 font-normal">Q{typeof p.price === 'number' ? p.price.toFixed(2) : p.price}</span>
                     </div>
                  </div>
               ))}
               {catalog.filter(p => !!p.imageUrl && !p.imageUrl.includes("placehold") && p.name.toLowerCase().includes(catalogMediaSearch.toLowerCase())).length === 0 && (
                 <div className="col-span-full py-10 text-center text-sm text-slate-500">
                   {catalog.length === 0 ? "No hay imágenes en el catálogo actual." : "Ningún producto coincide con la búsqueda."}
                 </div>
               )}
             </div>
           </div>
        </div>
      )}

      {/* Admin unlock modal */}
      {adminModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4">
          <div className="w-full max-w-md max-h-[95vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Acceso Administrador</div>
                <div className="text-xs text-slate-500">Ingresá la clave para habilitar módulos admin.</div>
              </div>
              <button
                onClick={() => setAdminModalOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Contraseña admin</label>
                <input
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                       doAdminUnlock();
                       if (ADMIN_PASS && e.currentTarget.value.trim() === ADMIN_PASS.trim()) {
                         setActiveTab(AppTab.LOGS);
                       }
                    } 
                  }}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="••••••••"
                />
              </div>

              {adminErr ? <div className="text-sm text-red-600">{adminErr}</div> : null}

              <button
                onClick={() => {
                  doAdminUnlock();
                  if (ADMIN_PASS && adminPass.trim() === ADMIN_PASS.trim()) {
                    setActiveTab(AppTab.LOGS);
                  }
                }}
                className="w-full rounded-2xl bg-[#0B1F3A] text-white py-2.5 text-sm font-semibold"
              >
                Entrar como Admin
              </button>

          
            </div>
          </div>
        </div>
      ) : null}
      {/* Product Modal */}
      <ProductModal
        isOpen={prodModalOpen}
        onClose={() => setProdModalOpen(false)}
        initialData={editingProd}
        onSave={handleSaveProduct}
        loading={catalogLoading}
      />
      <SendProductModal 
        isOpen={sendModalOpen} 
        onClose={() => setSendModalOpen(false)} 
        product={productToSend} 
        backend={backend} 
      />
    </div>
  );
}

function SheetsModule({ backend, backendOk }: { backend: string; backendOk: boolean }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (!backendOk) return;
    // Load current config
    fetch(`${backend}/sheets/test`, { headers: { "ngrok-skip-browser-warning": "true" } })
      .then(r => r.json())
      .then(d => {
        if (d.url) setUrl(d.url);
      })
      .catch(() => {});
  }, [backend, backendOk]);

  async function saveConfig() {
    if (!backendOk) return;
    setLoading(true);
    try {
      const r = await fetch(`${backend}/api/config/sheets`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }) 
      });
      if (!r.ok) throw new Error("Error guardando");
      alert("Guardado correctamente");
    } catch (e) {
      alert("Error: " + e);
    } finally {
      setLoading(false);
    }
  }

  async function sendTestOrder() {
    if (!backendOk) return;
    setLoading(true);
    setTestResult(null);
    try {
      const payload = {
        customerName: "Test User",
        phone: "50200000000",
        address: "Ciudad de Guatemala",
        items: ["Producto Test 1", "Producto Test 2"],
        total: 150.00
      };
      
      const r = await fetch(`${backend}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await r.json();
      if (data.ok) {
        setTestResult("✅ Orden enviada correctamente a Sheets (si la URL es válida).");
      } else {
         setTestResult("❌ Error del backend: " + (data.error || "Desconocido"));
      }
    } catch (e: any) {
      setTestResult("❌ Error de red: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Sheets Bridge" subtitle="Conecta tus pedidos con Google Sheets." />
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-900 flex items-center gap-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            Configuración
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Google Apps Script Web App URL
              </label>
              <input 
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                Asegúrate de haber desplegado el script como "Web App" y acceso "Anyone".
              </p>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={saveConfig}
                disabled={loading}
                className="rounded-xl bg-[#0B1F3A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A1A31] disabled:opacity-50"
              >
                {loading ? "Guardando..." : "Guardar URL"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
           <h3 className="mb-4 text-base font-semibold text-slate-900 flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-600" />
            Prueba de Integración
          </h3>
          
          <p className="text-sm text-slate-600 mb-4">
            Envía un pedido de prueba para verificar que los datos lleguen a tu hoja de cálculo.
          </p>
          
          <button
            onClick={sendTestOrder}
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar Pedido de Prueba"}
          </button>
          
          {testResult && (
            <div className={`mt-4 rounded-xl p-3 text-sm ${testResult.includes("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult}
            </div>
          )}
        </div>
      </div>
    </>
  );
}


