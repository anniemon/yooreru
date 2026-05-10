"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CalendarEntry = {
  day: number;
  href: string;
  monthIndex: number;
  title: string;
  year: number;
};

type CalendarCell =
  | {
      day: number;
      href: string | null;
      title: string | null;
    }
  | null;

type HomeCalendarClientProps = {
  entries: CalendarEntry[];
  initialMonthIndex: number;
  initialYear: number;
};

function monthKey(year: number, monthIndex: number) {
  return year * 12 + monthIndex;
}

function monthParts(value: number) {
  return {
    year: Math.floor(value / 12),
    monthIndex: value % 12,
  };
}

function buildCalendarMonth(
  entries: CalendarEntry[],
  monthValue: number,
) {
  const { year, monthIndex } = monthParts(monthValue);
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlankDays = firstDay.getDay();
  const postsByDay = new Map<number, CalendarEntry[]>();
  const cells: CalendarCell[] = [];

  for (const entry of entries) {
    if (entry.year !== year || entry.monthIndex !== monthIndex) {
      continue;
    }

    postsByDay.set(entry.day, [...(postsByDay.get(entry.day) ?? []), entry]);
  }

  for (let index = 0; index < leadingBlankDays; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= lastDay; day += 1) {
    const linkedPost = postsByDay.get(day)?.[0] ?? null;
    cells.push({
      day,
      href: linkedPost?.href ?? null,
      title: linkedPost?.title ?? null,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return {
    caption: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(firstDay),
    nextLabel: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(year, monthIndex + 1, 1)),
    previousLabel: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(year, monthIndex - 1, 1)),
    weeks: Array.from({ length: Math.ceil(cells.length / 7) }, (_, index) =>
      cells.slice(index * 7, index * 7 + 7),
    ),
  };
}

export function HomeCalendarClient({
  entries,
  initialMonthIndex,
  initialYear,
}: HomeCalendarClientProps) {
  const initialMonthValue = monthKey(initialYear, initialMonthIndex);
  const [visibleMonthValue, setVisibleMonthValue] = useState(initialMonthValue);
  const calendar = useMemo(() => buildCalendarMonth(entries, visibleMonthValue), [entries, visibleMonthValue]);
  const canNavigateNext = visibleMonthValue < initialMonthValue;

  return (
    <div className="aligncenter wp-block-calendar">
      <table
        id="wp-calendar"
        className="wp-calendar-table has-text-color has-luminous-vivid-orange-color has-background has-custom-background-color has-link-color"
      >
        <caption>{calendar.caption}</caption>
        <thead>
          <tr>
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <th key={`${label}-${index}`} scope="col" aria-label={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendar.weeks.map((week, index) => (
            <tr key={`week-${index}`}>
              {week.map((cell, cellIndex) => {
                if (!cell) {
                  return (
                    <td key={`blank-${index}-${cellIndex}`} className="pad">
                      &nbsp;
                    </td>
                  );
                }

                return (
                  <td
                    key={cell.day}
                    className={cell.href ? "has-post" : undefined}
                  >
                    {cell.href ? (
                      <Link href={cell.href} aria-label={cell.title ? `${cell.day}: ${cell.title}` : `${cell.day}`}>
                        {cell.day}
                      </Link>
                    ) : (
                      cell.day
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <nav aria-label="Previous and next months" className="wp-calendar-nav">
        <span className="wp-calendar-nav-prev">
          <button
            type="button"
            className="calendar-nav-button calendar-nav-button-prev"
            onClick={() => setVisibleMonthValue((value) => value - 1)}
          >
            <span className="calendar-nav-arrow" aria-hidden="true">
              &laquo;
            </span>
            <span> {calendar.previousLabel}</span>
          </button>
        </span>
        <span className="pad">&nbsp;</span>
        {canNavigateNext ? (
          <span className="wp-calendar-nav-next">
            <button
              type="button"
              className="calendar-nav-button calendar-nav-button-next"
              onClick={() => setVisibleMonthValue((value) => value + 1)}
            >
              <span>{calendar.nextLabel} </span>
              <span className="calendar-nav-arrow" aria-hidden="true">
                &raquo;
              </span>
            </button>
          </span>
        ) : null}
      </nav>
    </div>
  );
}
