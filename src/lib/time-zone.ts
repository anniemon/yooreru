const DEFAULT_APP_TIME_ZONE = "Asia/Seoul";

type DateParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function getAppTimeZone() {
  const timeZone = process.env.APP_TIME_ZONE?.trim() || DEFAULT_APP_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return timeZone;
  } catch {
    return DEFAULT_APP_TIME_ZONE;
  }
}

function getDateTimeFormatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function getZonedDateParts(date: Date, timeZone = getAppTimeZone()): DateParts {
  const values = Object.fromEntries(
    getDateTimeFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<keyof DateParts, string>;

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function getZonedCalendarParts(date: Date, timeZone = getAppTimeZone()) {
  const parts = getZonedDateParts(date, timeZone);

  return {
    year: Number(parts.year),
    monthIndex: Number(parts.month) - 1,
    day: Number(parts.day),
  };
}

export function formatDatePathParts(date: Date, timeZone = getAppTimeZone()) {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  return { year, month, day };
}

export function formatWpDate(date: Date | null, timeZone = getAppTimeZone()) {
  if (!date) {
    return "";
  }

  const { year, month, day } = formatDatePathParts(date, timeZone);
  return `${year}.${month}.${day}.`;
}

export function formatDateTimeLocal(date?: Date | null, timeZone = getAppTimeZone()) {
  if (!date) {
    return "";
  }

  const { year, month, day, hour, minute } = getZonedDateParts(date, timeZone);
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function getZonedMonthKey(date: Date, timeZone = getAppTimeZone()) {
  const { year, month } = getZonedDateParts(date, timeZone);
  return `${year}-${month}`;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getZonedDateParts(date, timeZone);
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return zonedAsUtc - date.getTime();
}

export function parseDateTimeLocalInTimeZone(input: string, timeZone = getAppTimeZone()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const utcMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  let offsetMs = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
  let date = new Date(utcMs - offsetMs);
  const nextOffsetMs = getTimeZoneOffsetMs(date, timeZone);

  if (nextOffsetMs !== offsetMs) {
    offsetMs = nextOffsetMs;
    date = new Date(utcMs - offsetMs);
  }

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parsedLocalTime = `${year}-${month}-${day}T${hour}:${minute}`;
  return formatDateTimeLocal(date, timeZone) === parsedLocalTime ? date : null;
}
