import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

export function CalendarModule({ campaigns, onDateSelect, onEditCampaign }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'year' | 'month'>('year');

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0 = Sunday

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  
  const nextYear = () => setCurrentDate(new Date(year + 1, month, 1));
  const prevYear = () => setCurrentDate(new Date(year - 1, month, 1));
  
  const today = () => {
    setCurrentDate(new Date());
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
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Year Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl sm:text-2xl font-bold text-[#0B1F3A]">
              {year}
            </h2>
          </div>
          {/* Ocultamos los controles en móvil, solo los mostramos en pantallas sm en adelante */}
          <div className="hidden sm:flex items-center rounded-xl bg-slate-50 border border-slate-200 p-1">
             <button onClick={prevYear} className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all">
               <ChevronLeft className="w-5 h-5 text-slate-600" />
             </button>
             <button onClick={today} className="px-3 text-xs font-semibold text-slate-600 hover:text-slate-900">
               Hoy
             </button>
             <button onClick={nextYear} className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all">
               <ChevronRight className="w-5 h-5 text-slate-600" />
             </button>
          </div>
        </div>
        
        {/* Year Grid: 3 columnas en movil, 4 en tablet/desktop */}
        <div className="flex-1 overflow-y-auto px-2 py-4 sm:p-6 grid grid-cols-3 lg:grid-cols-4 gap-x-1 sm:gap-x-8 gap-y-6 sm:gap-y-10 custom-scrollbar">
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
                className="cursor-pointer group flex flex-col hover:bg-slate-50 transition-colors" 
                onClick={() => {
                  setCurrentDate(new Date(year, mIndex, 1));
                  setViewMode('month');
                }}
              >
                <h3 className="text-[12px] sm:text-lg font-bold text-slate-800 group-hover:text-[#0B1F3A] transition-colors mb-1 sm:mb-3 pl-1">
                  {monthNamesShort[mIndex]}
                </h3>
                {/* Grid de días en vista anual sin las letras de la semana para una vista limpia */}
                <div className="grid grid-cols-7 gap-y-[2px] gap-x-[1px] text-center text-[8px] sm:text-xs font-medium text-slate-700">
                  {mDays.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const isToday = d.toDateString() === new Date().toDateString();
                    const dateStr = d.toDateString();
                    const hasCampaigns = campaignsByDate[dateStr] && campaignsByDate[dateStr].length > 0;
                    
                    return (
                      <div key={i} className="relative flex justify-center items-center h-[16px] w-[16px] sm:h-8 sm:w-8 mx-auto">
                        <span className={`w-full h-full flex items-center justify-center rounded-full leading-none
                          ${isToday ? 'bg-[#0B1F3A] text-white font-bold shadow-sm' : ''}
                        `}>
                          {d.getDate()}
                        </span>
                        {hasCampaigns && (
                           <div className={`absolute -bottom-[2px] w-[3px] h-[3px] sm:w-[5px] sm:h-[5px] rounded-full ${isToday ? 'bg-white' : 'bg-slate-300'}`}></div>
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
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Month Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 gap-3">
          <div className="flex items-center">
            <button 
              onClick={() => setViewMode('year')}
              className="flex items-center gap-1 text-[#0B1F3A] hover:text-[#0A1A31] transition-colors font-medium text-lg px-2 py-1 -ml-2 rounded-lg hover:bg-slate-100"
            >
              <ChevronLeft className="w-6 h-6" />
              <span>{year}</span>
            </button>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            <h2 className="text-3xl sm:text-xl font-bold text-slate-900 capitalize">
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
        <div className="grid grid-cols-7 grid-rows-5 flex-1 select-none overflow-y-auto min-h-[500px]">
          {days.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} className="bg-slate-50/30 border-b border-r border-slate-100 min-h-[100px] sm:min-h-[120px]" />;
            
            const dateKey = date.toDateString();
            const dayCampaigns = campaignsByDate[dateKey] || [];
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div 
                key={i} 
                className={`
                  group relative border-b border-r border-slate-100 p-1.5 sm:p-2 min-h-[100px] sm:min-h-[120px] transition-colors hover:bg-slate-50
                  ${isToday ? 'bg-[#0B1F3A]/5' : ''}
                `}
                onClick={() => onDateSelect(date)}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`
                    text-xs sm:text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-[#0B1F3A] text-white' : 'text-slate-700'}
                  `}>
                    {date.getDate()}
                  </span>
                  <div className="flex items-center gap-1">
                    {dayCampaigns.length > 0 && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 bg-slate-100 px-1 sm:px-1.5 py-0.5 rounded transition-all">
                        {(() => {
                          let totalDay = 0;
                          let sentDay = 0;
                          dayCampaigns.forEach(c => {
                            totalDay += (c.isCustom && typeof c.numbers?.[0] === 'object') ? c.numbers.length : (c.numbers?.length || 0);
                            sentDay += (c.stats?.sent || 0);
                          });
                          return `${sentDay}/${totalDay}`;
                        })()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Campaigns List for this Day */}
                <div className="space-y-1.5 overflow-y-auto max-h-[70px] sm:max-h-[85px] custom-scrollbar pr-0.5">
                  {dayCampaigns.map(c => {
                    const totalNums = c.isCustom && typeof c.numbers?.[0] === 'object' ? c.numbers.length : (c.numbers?.length || 0);
                    const sentNums = c.stats?.sent || 0;
                    
                    let titleText = "";
                    if (c.isCustom) {
                       titleText = `Pers.`;
                    } else {
                       titleText = `${new Date(c.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ${c.name}`;
                    }

                    const isCompleted = sentNums === totalNums && totalNums > 0;
                    
                    return (
                      <div 
                        key={c.id}
                        onClick={(e) => { e.stopPropagation(); onEditCampaign(c); }}
                        className={`
                          group/item flex items-center justify-between text-[9px] sm:text-xs px-1 sm:px-2 py-1 sm:py-1.5 rounded-md border cursor-pointer transition-all hover:shadow-sm
                          ${c.status === 'completed' || c.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 
                            c.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
                            c.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                            'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}
                        `}
                        title={c.name + ' - ' + c.message}
                      >
                        <span className="truncate pr-1 font-medium">{titleText}</span>
                        <div className={`
                          shrink-0 flex items-center justify-center text-[8px] sm:text-[10px] font-bold rounded
                          ${isCompleted ? 'bg-emerald-200/50 text-emerald-800 w-4 h-4 sm:w-5 sm:h-5' : 'bg-white/60 text-current opacity-90 px-1 sm:px-1.5 py-0.5'}
                        `}>
                          {isCompleted ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <span>{sentNums}/{totalNums}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  return viewMode === 'year' ? renderYearView() : renderMonthView();
}
