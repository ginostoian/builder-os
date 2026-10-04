import { describe, expect, it } from "vitest";
import { DEFAULT_SURVEY_SETTINGS, availableSlots, londonParts, londonToUtc, outwardCode, parseMinute, parsePostcodeAreas, postcodeCovered, slotLabels, surveyIcs } from "./surveys";

const settings = { ...DEFAULT_SURVEY_SETTINGS, enabled: true, minNoticeHours: 0, maxDaysAhead: 6 };
const times = (slots: { startsAt: Date }[]) => slots.map((s) => `${londonParts(s.startsAt).day} ${slotLabels(s.startsAt).time}`);

describe("UK time", () => {
  it("converts both sides of the clock changes", () => {
    expect(londonToUtc("2026-10-05", 9 * 60).toISOString()).toBe("2026-10-05T08:00:00.000Z"); // BST
    expect(londonToUtc("2026-12-01", 9 * 60).toISOString()).toBe("2026-12-01T09:00:00.000Z"); // GMT
    expect(londonToUtc("2026-10-25", 9 * 60).toISOString()).toBe("2026-10-25T09:00:00.000Z"); // clocks went back at 2am
    expect(londonToUtc("2027-03-28", 9 * 60).toISOString()).toBe("2027-03-28T08:00:00.000Z"); // clocks went forward at 1am
    expect(londonParts(new Date("2026-10-13T23:30:00Z"))).toEqual({ day: "2026-10-14", minute: 30, weekday: 3 });
  });
});

describe("available slots", () => {
  // Monday 5 October 2026, 07:00 UK.
  const now = new Date("2026-10-05T06:00:00Z");
  const jo = "a0000000-0000-4000-8000-000000000001";
  const sam = "a0000000-0000-4000-8000-000000000002";

  it("offers each start on the half hour inside the window, keeping travel time around visits", () => {
    const slots = availableSlots({
      settings,
      now,
      windows: [{ memberId: jo, weekday: 1, startMinute: 9 * 60, endMinute: 13 * 60 }],
      busy: [{ memberId: jo, startsAt: londonToUtc("2026-10-05", 10 * 60), endsAt: londonToUtc("2026-10-05", 11 * 60) }],
    });
    // 9:00 ends 10:00 but needs 30 min travel before the 10:00 visit; 11:00 likewise after it.
    expect(times(slots)).toEqual(["2026-10-05 11:30", "2026-10-05 12:00"]);
  });

  it("respects notice and how far ahead, and shares work between surveyors", () => {
    const slots = availableSlots({
      settings: { ...settings, minNoticeHours: 24, maxDaysAhead: 2, bufferMinutes: 0 },
      now,
      windows: [
        { memberId: jo, weekday: 2, startMinute: 9 * 60, endMinute: 11 * 60 },
        { memberId: sam, weekday: 2, startMinute: 9 * 60, endMinute: 11 * 60 },
      ],
      busy: [{ memberId: sam, startsAt: londonToUtc("2026-10-06", 9 * 60), endsAt: londonToUtc("2026-10-06", 10 * 60) }],
    });
    expect(times(slots)).toEqual(["2026-10-06 09:00", "2026-10-06 09:30", "2026-10-06 10:00"]);
    // Sam already has a visit that day, so Jo gets the 10:00 too.
    expect(slots.map((s) => s.memberId)).toEqual([jo, jo, jo]);
  });

  it("offers nothing without surveyors", () => {
    expect(availableSlots({ settings, now, windows: [], busy: [] })).toEqual([]);
  });
});

describe("postcode areas", () => {
  it("reads outward codes and matches areas", () => {
    expect(outwardCode("ls6 2ab")).toBe("LS6");
    expect(outwardCode("LS62AB")).toBe("LS6");
    expect(outwardCode("SW1A1AA")).toBe("SW1A");
    expect(postcodeCovered("LS6 2AB", ["LS"])).toBe(true);
    expect(postcodeCovered("L6 2AB", ["LS"])).toBe(false);
    expect(postcodeCovered("BD1 4AA", ["LS", "BD1"])).toBe(true);
    expect(postcodeCovered("BD10 4AA", ["BD1"])).toBe(false);
    expect(postcodeCovered("M1 1AA", [])).toBe(true);
    expect(postcodeCovered(undefined, ["LS"])).toBe(true);
    expect(parsePostcodeAreas("ls, bd1 ;  hx  nonsense123 LS")).toEqual(["LS", "BD1", "HX"]);
  });
});

describe("helpers", () => {
  it("parses times", () => {
    expect(parseMinute("9:30")).toBe(570);
    expect(parseMinute("24:00")).toBe(1440);
    expect(parseMinute("25:00")).toBeNull();
  });

  it("writes a calendar file", () => {
    const ics = surveyIcs({ uid: "b1@builderos", startsAt: new Date("2026-10-08T09:30:00Z"), endsAt: new Date("2026-10-08T10:30:00Z"), summary: "Survey, Hale & Sons", location: "14 Elm Road, Leeds", organizer: "Hale & Sons", sequence: 0, now: new Date("2026-10-05T00:00:00Z") });
    expect(ics).toContain("DTSTART:20261008T093000Z");
    expect(ics).toContain("LOCATION:14 Elm Road\\, Leeds");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
