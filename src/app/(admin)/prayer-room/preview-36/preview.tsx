"use client";

import { useState } from "react";
import { AfternoonWall, PhonePractice } from "../components/practice-view";
import PracticeDrawers, { type PracticeTarget } from "../components/practice-drawers";
import type { Band } from "../components/wall";
import type { CalendarSet } from "../components/calendar";
import { PRACTICE, ME } from "../preview-8a/practice-fixture";

const BANDS: Band[] = [1, 2, 3, 4, 5].map((d) => ({
  id: `NIGHT-${d}`,
  band_name: "NIGHT",
  day_of_week: d,
  start_time: "17:30",
  end_time: "20:00",
  weekly_focus: null,
}));

const set = (id: string, date: string, start: string, end: string, title: string): CalendarSet =>
  ({ id, set_date: date, start_time: start, end_time: end, title, theme: null, status: "scheduled", slots: [] }) as unknown as CalendarSet;

const SETS: CalendarSet[] = [
  set("s1", "2026-08-03", "14:00", "16:00", "Intercession · Nations"),
  set("s2", "2026-08-03", "17:30", "20:00", "NIGHT · Fire on the altar"),
  set("s3", "2026-08-04", "14:30", "16:00", "Worship · open mic"),
  set("s4", "2026-08-05", "14:00", "15:30", "Soaking"),
  set("s5", "2026-08-06", "14:00", "16:00", "Prayer for the schools"),
  set("s6", "2026-08-06", "17:30", "20:00", "NIGHT · Thursday night set"),
  set("s7", "2026-08-07", "14:30", "16:00", "Intercession · Cape Flats"),
];

export default function Preview36() {
  const [target, setTarget] = useState<PracticeTarget>(null);
  const [staff, setStaff] = useState(false);
  const week = { ...PRACTICE, me: { ...PRACTICE.me, isStaff: staff } };
  return (
    <div className="ffsa-screen">
      <div className="flex items-end justify-between border-b border-ink bg-white px-5 pb-4 pt-5 md:px-8">
        <div>
          <div className="masthead-context">Turn 36 · fixtures · dev only</div>
          <h1 className="masthead-title">Practice</h1>
        </div>
        <label className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em]">
          <input type="checkbox" checked={staff} onChange={(e) => setStaff(e.target.checked)} />
          View as admin
        </label>
      </div>
      <div className="px-5 py-6 md:px-8">
        <div className="hidden md:block">
          <AfternoonWall week={week} sets={SETS} bands={BANDS} userId={ME} onOpen={setTarget} />
        </div>
        <div className="mx-auto max-w-[390px] md:mt-8">
          <PhonePractice week={week} userId={ME} onOpen={setTarget} />
        </div>
      </div>
      <PracticeDrawers week={week} target={target} setTarget={setTarget} userId={ME} onChanged={() => {}} />
    </div>
  );
}
