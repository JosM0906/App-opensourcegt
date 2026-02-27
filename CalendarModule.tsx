import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

export function CalendarModule({ campaigns, onDateSelect, onEditCampaign }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'year' | 'month'>('year');
  const [selectedDayPopover, setSelectedDayPopover] = useState<{date: Date, campaigns: any[]} | null>(null);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0 = Sunday

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDayPopover(null); };
  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDayPopover(null); };
  
  const nextYear = () => { setCurrentDate(new Date(year + 1, month, 1)); setSelectedDayPopover(null); };
  const prevYear = () => { setCurrentDate(new Date(year - 1, month, 1)); setSelectedDayPopover(null); };
  
  const today = () => {
    setCurrentDate(new Date());
    setSelectedDayPopover(null);
  };

  const campaignsByDate = useMemo(() => {
    const map = {};
    campaigns.forEach(c => {
      let datesToMap = [];
      if (c.isCustom) {
         const dSet = new Set();
         (c.numbers || []).forEach(n => {
            if (n.scheduledAt) dSet.add(new Date(n.scheduledAt).toDateString());
         });
         datesToMap = Array.from(dSet);
      } else if (c.scheduledAt) {
         datesToMap = [new Date(c.scheduledAt).toDateString()];
      }
      
      datesToMap.forEach(dateStr => {
        if (!map[dateStr]) map[dateStr] = [];
        if (!map[dateStr].find(existing => existing.id === c.id)) {
           map[dateStr].push(c);
        }
      });
    });
    return map;
  }, [campaigns]);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const renderYearView = () => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    
    return (
      <div className="flex flex-col h-full bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-sm overflow-hidden">
        {/* Year Header (iOS Style, no border on mobile) */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-4">
          <div className="flex items-center">
            <h2 className="text-4xl sm:text-2xl font-bold text-[#0B1F3A] tracking-tight">
              {year}
            </h2>
          </div>
          {/* Controles en móvil visibles como iconos simples, en PC con cajas */}
          <div className="flex items-center gap-1 sm:gap-0 sm:rounded-xl sm:bg-slate-50 sm:border sm:border-slate-200 sm:p-1">
             <button onClick={prevYear} className="p-1.5 sm:p-1 hover:bg-slate-100 sm:hover:bg-white rounded-full sm:rounded-lg transition-all">
               <ChevronLeft className="w-6 h-6 sm:w-5 sm:h-5 text-slate-600 sm:text-slate-600" />
             </button>
             <button onClick={today} className="px-2 sm:px-3 text-sm sm:text-xs font-semibold text-slate-600 hover:text-[#0B1F3A]">
               Hoy
             </button>
             <button onClick={nextYear} className="p-1.5 sm:p-1 hover:bg-slate-100 sm:hover:bg-white rounded-full sm:rounded-lg transition-all">
               <ChevronRight className="w-6 h-6 sm:w-5 sm:h-5 text-slate-600 sm:text-slate-600" />
             </button>
          </div>
        </div>
        
        {/* Year Grid: 3 columnas estrictas en movil, 4 en tablet/desktop */}
        <div className="flex-1 overflow-y-auto px-1 sm:p-6 grid grid-cols-3 lg:grid-cols-4 gap-x-1 sm:gap-x-8 gap-y-4 sm:gap-y-10 custom-scrollbar pb-8 sm:pb-6">
          {months.map(mIndex => {
            const mDaysInMonth = getDaysInMonth(year, mIndex);
            const mFirstDay = getFirstDayOfMonth(year, mIndex);
            
            const mDays = [];
            for (let i = 0; i < mFirstDay; i++) mDays.push(null);
            for (let i = 1; i <= mDaysInMonth; i++) mDays.push(new Date(year, mIndex, i));

            const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

            return (
              <div 
                key={mIndex} 
                className="cursor-pointer group flex flex-col active:opacity-70 transition-opacity" 
                onClick={() => {
                  setCurrentDate(new Date(year, mIndex, 1));
                  setViewMode('month');
                }}
              >
                <h3 className="text-[15px] sm:text-lg font-bold text-[#0B1F3A] mb-1 sm:mb-3 pl-1 leading-none">
                  {monthNamesShort[mIndex]}
                </h3>
                
                <div className="grid grid-cols-7 gap-y-[2px] sm:gap-y-[4px] gap-x-[0px] text-center text-[10px] sm:text-xs font-semibold text-slate-700">
                  {mDays.map((d, i) => {
                    if (!d) return <div key={i} className="" />;
                    const isToday = d.toDateString() === new Date().toDateString();
                    const dateStr = d.toDateString();
                    const hasCampaigns = campaignsByDate[dateStr] && campaignsByDate[dateStr].length > 0;
                    
                    return (
                      <div key={i} className="relative flex flex-col items-center justify-start h-[18px] sm:h-8">
                        <span className={`flex items-center justify-center w-[16px] h-[16px] sm:w-[24px] sm:h-[24px] rounded-full leading-none
                          ${isToday ? 'bg-[#0B1F3A] text-white' : ''}
                        `}>
                          {d.getDate()}
                        </span>
                        
                        {hasCampaigns && (
                           <div className={`mt-[1px] w-[3px] h-[3px] rounded-full sm:w-[5px] sm:h-[5px] ${isToday ? 'bg-transparent' : 'bg-slate-400'}`}></div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

    return (
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
        {/* Month Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 gap-3">
          <div className="flex items-center">
            <button 
              onClick={() => { setViewMode('year'); setSelectedDayPopover(null); }}
              className="flex items-center gap-1 text-[#0B1F3A] hover:text-[#0A1A31] transition-colors font-medium text-lg px-2 py-1 -ml-2 rounded-lg hover:bg-slate-100"
            >
              <ChevronLeft className="w-6 h-6" />
              <span>{year}</span>
            </button>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            <h2 className="text-2xl sm:text-xl font-bold text-slate-900 capitalize">
              {monthNames[month]} <span className="sm:hidden">{year}</span>
            </h2>
            <div className="flex items-center rounded-xl bg-slate-50 border border-slate-200 p-1">
               <button onClick={prevMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all">
                 <ChevronLeft className="w-5 h-5 text-slate-600" />
               </button>
               <button onClick={today} className="px-3 text-xs font-semibold text-slate-600 hover:text-slate-900">
                 Hoy
               </button>
               <button onClick={nextMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all">
                 <ChevronRight className="w-5 h-5 text-slate-600" />
               </button>
            </div>
          </div>
        </div>

        {/* Grid Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {dayLabels.map((day, i) => (
            <div key={i} className="py-2 text-center text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Grid Body */}
        <div className="grid grid-cols-7 flex-1 select-none overflow-y-auto">
          {days.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} className="bg-slate-50/10 border-b border-r border-slate-100 min-h-[70px] sm:min-h-[120px]" />;
            
            const dateKey = date.toDateString();
            const dayCampaigns = campaignsByDate[dateKey] || [];
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div 
                key={i} 
                className={`
                  group relative border-b border-r border-slate-100 p-1 transition-colors hover:bg-slate-50 min-h-[70px] sm:min-h-[120px]
                  ${isToday ? 'bg-[#0B1F3A]/5' : ''}
                  ${dayCampaigns.length > 0 ? 'cursor-pointer' : ''}
                `}
                onClick={() => {
                  const isMobile = window.innerWidth < 640;
                  if (isMobile && dayCampaigns.length > 0) {
                    setSelectedDayPopover({ date, campaigns: dayCampaigns });
                  } else if (!isMobile) {
                    onDateSelect(date);
                  }
                }}
              >
                <div className="flex flex-col items-center sm:items-start h-full">
                  <span className={`
                    text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full mb-1 sm:mb-2
                    ${isToday ? 'bg-[#0B1F3A] text-white' : 'text-slate-700'}
                  `}>
                    {date.getDate()}
                  </span>
                  
                  {/* MOBILE: Indicators - Only checkmarks or dots */}
                  <div className="flex sm:hidden flex-wrap items-center justify-center gap-0.5 max-w-full px-1">
                    {dayCampaigns.slice(0, 4).map(c => {
                       const totalNums = c.isCustom && typeof c.numbers?.[0] === 'object' ? c.numbers.length : (c.numbers?.length || 0);
                       const sentNums = c.stats?.sent || 0;
                       const isCompleted = sentNums === totalNums && totalNums > 0;
                       
                       return isCompleted ? (
                         <CheckCircle2 key={c.id} className="w-3.5 h-3.5 text-emerald-500" />
                       ) : (
                         <div key={c.id} className="w-2 h-2 rounded-full bg-purple-400" />
                       );
                    })}
                    {dayCampaigns.length > 4 && (
                      <span className="text-[8px] font-bold text-slate-400">+{dayCampaigns.length - 4}</span>
                    )}
                  </div>

                  {/* DESKTOP: Full Campaigns List */}
                  <div className="hidden sm:block w-full space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar pr-1">
                    {dayCampaigns.map(c => {
                      const totalNums = c.isCustom && typeof c.numbers?.[0] === 'object' ? c.numbers.length : (c.numbers?.length || 0);
                      const sentNums = c.stats?.sent || 0;
                      const isCompleted = sentNums === totalNums && totalNums > 0;
                      
                      return (
                        <div 
                          key={c.id}
                          onClick={(e) => { e.stopPropagation(); onEditCampaign(c); }}
                          className={`
                            flex items-center justify-between text-[10px] px-1.5 py-1 rounded-md border transition-all shadow-sm group/item
                            ${isCompleted 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300' 
                              : 'bg-purple-50 text-purple-700 border-purple-100 hover:border-purple-300'}
                          `}
                        >
                          <span className="truncate flex-1 pr-1 font-medium">{c.name}</span>
                          {isCompleted ? (
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                          ) : (
                            <span className="text-[9px] font-bold shrink-0">{sentNums}/{totalNums}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detalle flotante (Popover/Tooltip) - Estilo Glassmorphism */}
        {selectedDayPopover && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/5 backdrop-blur-sm">
            <div className="w-[90%] max-w-[320px] bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 animate-in zoom-in-95 duration-200 overflow-hidden">
               <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 bg-white/40">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Campañas del día</span>
                    <span className="text-sm font-bold text-slate-900">{selectedDayPopover.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </div>
                  <button onClick={() => setSelectedDayPopover(null)} className="p-1 rounded-full hover:bg-black/5 text-slate-400">
                    <ChevronRight className="w-5 h-5 rotate-90" />
                  </button>
               </div>
               
               <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {selectedDayPopover.campaigns.map(c => {
                    const totalNums = c.isCustom && typeof c.numbers?.[0] === 'object' ? c.numbers.length : (c.numbers?.length || 0);
                    const sentNums = c.stats?.sent || 0;
                    const isCompleted = sentNums === totalNums && totalNums > 0;
                    
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => { onEditCampaign(c); setSelectedDayPopover(null); }}
                        className={`
                          flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group
                          ${isCompleted 
                            ? 'bg-emerald-50/60 hover:bg-emerald-50 text-emerald-800 border-emerald-100/50' 
                            : 'bg-purple-50/60 hover:bg-purple-50 text-purple-800 border-purple-100/50'}
                        `}
                      >
                        <div className="flex flex-col flex-1 min-w-0 pr-2">
                           <span className="text-xs font-bold truncate">{c.name}</span>
                           <span className={`text-[10px] truncate ${isCompleted ? 'text-emerald-600' : 'text-purple-600'}`}>{c.message}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-bold opacity-60">{sentNums}/{totalNums}</span>
                           {isCompleted ? (
                             <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                           ) : (
                             <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                           )}
                        </div>
                      </div>
                    )
                  })}
               </div>
               
               <div className="p-4 bg-white/40 flex gap-2">
                  <button onClick={() => { onDateSelect(selectedDayPopover.date); setSelectedDayPopover(null); }} className="flex-1 rounded-xl bg-[#0B1F3A] py-2.5 text-xs font-bold text-white hover:bg-[#0A1A31] transition-all">
                    Añadir campaña
                  </button>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  return viewMode === 'year' ? renderYearView() : renderMonthView();
}
