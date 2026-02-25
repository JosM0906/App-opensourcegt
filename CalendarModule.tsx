
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export function CalendarModule({ campaigns, onDateSelect, onEditCampaign }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helpers to get days
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0 = Sunday

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  // Adjust for Monday start if desired (currently Sunday start for simplicity)
  // Let's stick to standard Sunday start for now, or match locale. 
  // 0=Sun, 1=Mon...

  const days = useMemo(() => {
    const d = [];
    // Padding for previous month
    for (let i = 0; i < firstDay; i++) {
      d.push(null);
    }
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      d.push(new Date(year, month, i));
    }
    return d;
  }, [year, month]);

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const today = () => setCurrentDate(new Date());

  // Group campaigns by date str
  const campaignsByDate = useMemo(() => {
    const map = {};
    campaigns.forEach(c => {
      let datesToMap = [];
      if (c.isCustom) {
         // Gather unique dates from its numbers
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
        // Only push if not already in that specific day (avoid duplicate badge for same campaign on same day)
        if (!map[dateStr].find(existing => existing.id === c.id)) {
          map[dateStr].push(c);
        }
      });
    });
    return map;
  }, [campaigns]);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-900 capitalize">
            {monthNames[month]} {year}
          </h2>
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
             <button onClick={prevMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
               <ChevronLeft className="w-5 h-5" />
             </button>
             <button onClick={today} className="px-3 text-xs font-semibold text-slate-600 hover:text-slate-900">
               Hoy
             </button>
             <button onClick={nextMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
               <ChevronRight className="w-5 h-5" />
             </button>
          </div>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="grid grid-cols-7 grid-rows-5 flex-1 select-none">
        {days.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="bg-slate-50/30 border-b border-r border-slate-100 min-h-[120px]" />;
          
          const dateKey = date.toDateString();
          const dayCampaigns = campaignsByDate[dateKey] || [];
          const isToday = date.toDateString() === new Date().toDateString();

          return (
            <div 
              key={i} 
              className={`
                group relative border-b border-r border-slate-100 p-2 min-h-[120px] transition-colors hover:bg-slate-50
                ${isToday ? 'bg-blue-50/30' : ''}
              `}
              onClick={() => onDateSelect(date)}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`
                  text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'}
                `}>
                  {date.getDate()}
                </span>
                <div className="flex items-center gap-1">
                  {dayCampaigns.length > 0 && (
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md hidden group-hover:block transition-all">
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
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 text-blue-600 rounded-full transition-all">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Campaigns List for this Day */}
              <div className="space-y-1.5 overflow-y-auto max-h-[85px] custom-scrollbar pr-1">
                {dayCampaigns.map(c => {
                  const totalNums = c.isCustom && typeof c.numbers?.[0] === 'object' ? c.numbers.length : (c.numbers?.length || 0);
                  const sentNums = c.stats?.sent || 0;
                  
                  let titleText = "";
                  if (c.isCustom) {
                     titleText = `Personalizada`;
                  } else {
                     titleText = `${new Date(c.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} ${c.name}`;
                  }

                  const isCompleted = sentNums === totalNums && totalNums > 0;
                  
                  return (
                    <div 
                      key={c.id}
                      onClick={(e) => { e.stopPropagation(); onEditCampaign(c); }}
                      className={`
                        group/item flex items-center justify-between text-xs px-2 py-1.5 rounded-md border cursor-pointer transition-all hover:shadow-sm
                        ${c.status === 'completed' || c.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 
                          c.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
                          c.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                          'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}
                      `}
                      title={c.name + ' - ' + c.message}
                    >
                      <span className="truncate pr-2 font-medium">{titleText}</span>
                      <div className={`
                        shrink-0 flex items-center justify-center text-[10px] font-bold rounded
                        ${isCompleted ? 'bg-emerald-200/50 text-emerald-800 w-5 h-5' : 'bg-white/60 text-current opacity-90 px-1.5 py-0.5'}
                      `}>
                        {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{sentNums}/{totalNums}</span>}
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
}
