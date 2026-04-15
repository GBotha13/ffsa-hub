"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SlotDetail from "./slot-detail";

interface SlotMember {
  id: string;
  user_id: string;
  role: string;
  instrument: string | null;
  users: { id: string; first_name: string; last_name: string; preferred_name: string | null };
}

interface Slot {
  id: string;
  series_id: string | null;
  slot_date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  status: string;
  notes: string | null;
  color: string | null;
  members: SlotMember[];
}

interface ScheduleViewProps {
  userId: string;
  isAdmin: boolean;
}

const DAY_NAMES_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const HOUR_START = 5; // 5 AM
const HOUR_END = 22; // 10 PM
const TOTAL_HOURS = HOUR_END - HOUR_START;
const HOUR_HEIGHT = 60; // px per hour

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatTimeShort(t: string): string {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  if (m === "00") return `${h12} ${ampm}`;
  return `${h12}:${m} ${ampm}`;
}

function displayName(u: { first_name: string; last_name: string; preferred_name: string | null }) {
  return u.preferred_name || u.first_name;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTop(minutes: number): number {
  return ((minutes - HOUR_START * 60) / 60) * HOUR_HEIGHT;
}

function minutesToHeight(startMin: number, endMin: number): number {
  return ((endMin - startMin) / 60) * HOUR_HEIGHT;
}

const ROLE_COLORS: Record<string, string> = {
  worship_leader: "bg-purple-500/20 text-purple-300",
  prayer_leader: "bg-blue-500/20 text-blue-300",
  musician: "bg-green-500/20 text-green-300",
};

const SLOT_COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-600/80 border-blue-500 hover:bg-blue-600/90",
  purple: "bg-purple-600/80 border-purple-500 hover:bg-purple-600/90",
  teal: "bg-teal-600/80 border-teal-500 hover:bg-teal-600/90",
  indigo: "bg-indigo-600/80 border-indigo-500 hover:bg-indigo-600/90",
  rose: "bg-rose-600/80 border-rose-500 hover:bg-rose-600/90",
  amber: "bg-amber-600/80 border-amber-500 hover:bg-amber-600/90",
  emerald: "bg-emerald-600/80 border-emerald-500 hover:bg-emerald-600/90",
  cyan: "bg-cyan-600/80 border-cyan-500 hover:bg-cyan-600/90",
  pink: "bg-pink-600/80 border-pink-500 hover:bg-pink-600/90",
  orange: "bg-orange-600/80 border-orange-500 hover:bg-orange-600/90",
};

const DEFAULT_SLOT_COLOR = "bg-blue-600/80 border-blue-500 hover:bg-blue-600/90";

export default function ScheduleView({ userId, isAdmin }: ScheduleViewProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  const weekEndStr = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return formatDate(d);
  })();

  const weekEnd = new Date(weekEndStr + "T00:00:00");

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/prayer-room/slots?dateFrom=${formatDate(weekStart)}&dateTo=${weekEndStr}`
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEndStr]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to current time on load
  useEffect(() => {
    if (!loading && gridRef.current) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const scrollTo = minutesToTop(nowMinutes) - 100;
      gridRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [loading]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const today = () => setWeekStart(getWeekStart(new Date()));

  // Group slots by day
  const slotsByDay: Record<string, Slot[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    slotsByDay[formatDate(d)] = [];
  }
  for (const slot of slots) {
    if (slotsByDay[slot.slot_date]) {
      slotsByDay[slot.slot_date].push(slot);
    }
  }

  const weekDays = Object.keys(slotsByDay).sort();
  const todayStr = formatDate(new Date());

  // Current time line position
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const nowTop = minutesToTop(nowMinutes);
  const showTimeLine = nowMinutes >= HOUR_START * 60 && nowMinutes <= HOUR_END * 60;
  const isCurrentWeek = weekDays.includes(todayStr);
  const todayColIndex = weekDays.indexOf(todayStr);

  if (selectedSlot) {
    return (
      <SlotDetail
        slot={selectedSlot}
        userId={userId}
        isAdmin={isAdmin}
        onBack={() => {
          setSelectedSlot(null);
          fetchSlots();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] -mx-4 sm:-mx-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between px-4 sm:px-6 pb-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={today}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-sm font-medium">
          {weekStart.toLocaleDateString("en-ZA", { month: "long", day: "numeric" })} –{" "}
          {weekEnd.toLocaleDateString("en-ZA", { month: "long", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground">Loading schedule...</div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden border rounded-lg">
          {/* Day Headers */}
          <div className="flex border-b bg-muted/30 flex-shrink-0">
            {/* Time gutter header */}
            <div className="w-16 flex-shrink-0 border-r" />
            {weekDays.map((dateStr, i) => {
              const d = new Date(dateStr + "T00:00:00");
              const isToday = todayStr === dateStr;
              return (
                <div
                  key={dateStr}
                  className={`flex-1 text-center py-2 border-r last:border-r-0 ${
                    isToday ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="text-[11px] font-medium tracking-wider text-muted-foreground">
                    {DAY_NAMES_SHORT[i]}
                  </div>
                  <div
                    className={`text-xl font-semibold mt-0.5 ${
                      isToday
                        ? "bg-primary text-primary-foreground w-9 h-9 rounded-full flex items-center justify-center mx-auto"
                        : "text-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable time grid */}
          <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex relative" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
              {/* Time gutter */}
              <div className="w-16 flex-shrink-0 border-r relative">
                {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                  const hour = HOUR_START + i;
                  const ampm = hour >= 12 ? "PM" : "AM";
                  const h12 = hour % 12 || 12;
                  return (
                    <div
                      key={hour}
                      className="absolute w-full text-right pr-2 text-[11px] text-muted-foreground"
                      style={{ top: i * HOUR_HEIGHT - 7 }}
                    >
                      {i === 0 ? "" : `${h12} ${ampm}`}
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              <div className="flex-1 flex relative">
                {/* Hour grid lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={i}
                    className="absolute w-full border-b border-border/40"
                    style={{ top: i * HOUR_HEIGHT }}
                  />
                ))}

                {/* Current time red line */}
                {isCurrentWeek && showTimeLine && (
                  <div
                    className="absolute w-full z-20 pointer-events-none flex items-center"
                    style={{ top: nowTop }}
                  >
                    {/* Position the dot in the correct day column */}
                    <div
                      className="absolute h-3 w-3 bg-red-500 rounded-full -ml-1.5"
                      style={{
                        left: todayColIndex >= 0 ? `${(todayColIndex / 7) * 100}%` : "0%",
                      }}
                    />
                    <div className="w-full h-[2px] bg-red-500" />
                  </div>
                )}

                {weekDays.map((dateStr, colIdx) => {
                  const daySlotsArr = slotsByDay[dateStr] || [];
                  const isToday = todayStr === dateStr;

                  return (
                    <div
                      key={dateStr}
                      className={`flex-1 relative border-r last:border-r-0 ${
                        isToday ? "bg-primary/5" : ""
                      }`}
                    >
                      {daySlotsArr.map((slot) => {
                        const startMin = timeToMinutes(slot.start_time);
                        const endMin = timeToMinutes(slot.end_time);
                        const top = minutesToTop(startMin);
                        const height = Math.max(minutesToHeight(startMin, endMin), 24);
                        const colorClass = slot.color
                          ? (SLOT_COLOR_MAP[slot.color] ?? DEFAULT_SLOT_COLOR)
                          : DEFAULT_SLOT_COLOR;

                        return (
                          <div
                            key={slot.id}
                            className={`absolute left-0.5 right-0.5 rounded-md border-l-4 px-2 py-1 cursor-pointer transition-all overflow-hidden z-10 text-white ${colorClass}`}
                            style={{ top, height }}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            <div className="text-xs font-semibold truncate leading-tight">
                              {slot.title || "Devo Set"}
                            </div>
                            {height > 30 && (
                              <div className="text-[10px] opacity-80 leading-tight">
                                {formatTimeShort(slot.start_time)} – {formatTimeShort(slot.end_time)}
                              </div>
                            )}
                            {height > 55 && slot.members.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-1">
                                {slot.members.slice(0, 3).map((m) => (
                                  <span
                                    key={m.id}
                                    className="text-[9px] bg-white/20 rounded px-1 py-px"
                                  >
                                    {displayName(m.users)}
                                  </span>
                                ))}
                                {slot.members.length > 3 && (
                                  <span className="text-[9px] opacity-70">
                                    +{slot.members.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                            {height > 40 && slot.members.length === 0 && (
                              <div className="text-[10px] text-orange-300 mt-0.5">
                                No team
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
