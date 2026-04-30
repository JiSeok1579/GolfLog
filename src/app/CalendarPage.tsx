import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { currentMonthKey, formatMonthLabel, todayDateKey, toMonthKey } from "../data/dates";
import { text, useLanguage } from "../data/i18n";
import { japanHolidaysByDate } from "../data/japanHolidays";
import { calendarSessionSummaryByDay } from "../data/selectors";
import { useGolfLog } from "../data/store";

const days = {
  ko: ["일", "월", "화", "수", "목", "금", "토"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export function CalendarPage() {
  const { data } = useGolfLog();
  const { language } = useLanguage();
  const [activeMonth, setActiveMonth] = useState(currentMonthKey);
  const [year, month] = activeMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const leadingBlankDays = firstDay;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((leadingBlankDays + daysInMonth) / 7) * 7;
  const summaryByDay = calendarSessionSummaryByDay(data, activeMonth);
  const monthLabel = formatMonthLabel(new Date(year, month - 1, 1), language);
  const holidays = useMemo(() => japanHolidaysByDate(year, language), [language, year]);
  const todayKey = todayDateKey();
  const monthEntryCount = data.sessions.filter((session) => session.date.startsWith(activeMonth)).length;
  const monthHolidayCount = Array.from(holidays.values()).filter((holiday) => holiday.date.startsWith(activeMonth)).length;

  const shiftMonth = (offset: number) => {
    setActiveMonth(toMonthKey(new Date(year, month - 1 + offset, 1)));
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1>{monthLabel}</h1>
          <p>{text(language, "운동 강도, 주말, 일본 공휴일을 한눈에 확인합니다.", "Review activity, weekends, and Japan holidays at a glance.")}</p>
        </div>
        <div className="page-actions calendar-actions">
          <Button aria-label={text(language, "이전 달", "Previous month")} onClick={() => shiftMonth(-1)} title={text(language, "이전 달", "Previous month")} type="button" variant="secondary">
            <ChevronLeft size={16} />
          </Button>
          <label className="month-picker">
            <span>{text(language, "월 선택", "Month")}</span>
            <input aria-label={text(language, "표시할 월", "Month to display")} onChange={(event) => setActiveMonth(event.target.value)} type="month" value={activeMonth} />
          </label>
          <Button aria-label={text(language, "다음 달", "Next month")} onClick={() => shiftMonth(1)} title={text(language, "다음 달", "Next month")} type="button" variant="secondary">
            <ChevronRight size={16} />
          </Button>
          <Button onClick={() => setActiveMonth(currentMonthKey())} title={text(language, "오늘이 포함된 달", "Month containing today")} type="button" variant="ghost">
            <RotateCcw size={16} />
            {text(language, "오늘", "Today")}
          </Button>
          <Chip tone="accent">{monthEntryCount} {text(language, "기록", "records")}</Chip>
          <Chip>{monthHolidayCount} {text(language, "공휴일", "holidays")}</Chip>
        </div>
      </header>

      <Card>
        <div className="calendar-grid">
          {days[language].map((day, index) => (
            <div className="calendar-day-label" data-weekend={index === 0 ? "sun" : index === 6 ? "sat" : undefined} key={day}>
              {day}
            </div>
          ))}
          {Array.from({ length: totalCells }).map((_, index) => {
            const day = index - leadingBlankDays + 1;
            const inMonth = day > 0 && day <= daysInMonth;
            const summary = inMonth ? summaryByDay.get(day) : undefined;
            const dateKey = inMonth ? `${activeMonth}-${String(day).padStart(2, "0")}` : "";
            const date = inMonth ? new Date(year, month - 1, day) : undefined;
            const weekDay = date?.getDay();
            const weekend = weekDay === 6 ? "sat" : weekDay === 0 ? "sun" : undefined;
            const holiday = dateKey ? holidays.get(dateKey) : undefined;
            const isToday = inMonth && dateKey === todayKey;

            return (
              <div
                className="calendar-cell"
                data-blank={!inMonth ? "true" : undefined}
                data-entry={summary ? "true" : undefined}
                data-holiday={holiday ? "true" : undefined}
                data-today={isToday ? "true" : undefined}
                data-weekend={weekend}
                key={index}
              >
                {inMonth ? (
                  <>
                    <div className="calendar-cell-head">
                      <span>{day}</span>
                    </div>
                    {holiday ? <small className="calendar-holiday">{holiday.name}</small> : null}
                  </>
                ) : null}
                {summary && inMonth ? (
                  <NavLink className="calendar-entry-link" to={`/sessions/${summary.firstSessionId}`}>
                    {summary.count}{text(language, "회", "x")}
                    <br />
                    {summary.totalMinutes}{text(language, "분", " min")}
                  </NavLink>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
