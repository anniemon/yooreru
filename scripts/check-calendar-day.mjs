// Run: node --import tsx scripts/check-calendar-day.mjs
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import calendar from "../src/components/home-calendar.tsx";

const entries = [
  { day: 2, href: "/first/", title: "First", monthIndex: 7, year: 2025 },
  { day: 2, href: "/second/", title: "Second", monthIndex: 7, year: 2025 },
  { day: 3, href: "/single/", title: "Single", monthIndex: 7, year: 2025 },
];
const html = renderToStaticMarkup(createElement(calendar.HomeCalendarClient, {
  entries,
  initialMonthIndex: 7,
  initialYear: 2025,
}));

assert.match(html, /href="\/2025\/08\/02"/);
assert.match(html, /href="\/single"/);
assert.doesNotMatch(html, /href="\/(first|second)"/);
console.log("Calendar day links passed (multiple posts -> date, single post -> article).");
