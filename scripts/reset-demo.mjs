import { createClient } from "@supabase/supabase-js";

import cabins from "./seed/cabins.json" assert { type: "json" };
import guests from "./seed/guests.json" assert { type: "json" };
import bookingSeeds from "./seed/bookings.json" assert { type: "json" };


// ---------- small utilities ----------
function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function must(res, label) {
  if (res?.error) throw new Error(`${label} failed: ${res.error.message}`);
  return res;
}

// Dates from offsets (replaces date-fns/add + fromToday from frontend seed)
function fromToday(offsetDays, withTime = false) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);

  if (!withTime) {
    d.setUTCHours(0, 0, 0, 0);
  }

  return d.toISOString();
}

function subtractDates(dateStr1, dateStr2) {
  return Math.round(
    (new Date(dateStr1).getTime() - new Date(dateStr2).getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

// Booking status logic (replaces date-fns isPast/isToday/isFuture)
function isTodayUTC(date) {
  const now = new Date();
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}
function isPast(date) {
  // "past" but not including "today" is handled by caller
  return date.getTime() < Date.now();
}
function isFuture(date) {
  return date.getTime() > Date.now();
}

// ---------- Supabase client ----------
const supabase = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

// ---------- delete in FK-safe order ----------
async function deleteAll() {
  must(await supabase.from("bookings").delete().neq("id", 0), "delete bookings");
  must(await supabase.from("guests").delete().neq("id", 0), "delete guests");
  must(await supabase.from("cabins").delete().neq("id", 0), "delete cabins");
}

// ---------- insert base tables ----------
async function insertGuests() {
  const res = must(
    await supabase.from("guests").insert(guests).select("id").order("id"),
    "insert guests"
  );
  return res.data.map((g) => g.id);
}

async function insertCabins() {
  const res = must(
    await supabase.from("cabins").insert(cabins).select("id").order("id"),
    "insert cabins"
  );
  return res.data.map((c) => c.id);
}

// ---------- bookings (FK remap + derived fields) ----------
async function insertBookings(guestIds, cabinIds) {
  const breakfastPrice = 15;

  const finalBookings = bookingSeeds.map((seed) => {
    // Turn offsets into ISO strings
    const created_at = fromToday(seed.createdOffset, true);
    const startDate = fromToday(seed.startOffset, false);
    const endDate = fromToday(seed.endOffset, false);

    // Compute derived fields based on cabin pricing
    const cabinSeed = cabins.at(seed.cabinId - 1);
    const numNights = subtractDates(endDate, startDate);

    const cabinPrice = numNights * (cabinSeed.regularPrice - cabinSeed.discount);
    const extrasPrice = seed.hasBreakfast
      ? numNights * breakfastPrice * seed.numGuests
      : 0;

    // Status computation (same logic as instructor)
    let status;
    const end = new Date(endDate);
    const start = new Date(startDate);

    if (isPast(end) && !isTodayUTC(end)) status = "checked-out";
    if (isFuture(start) || isTodayUTC(start)) status = "unconfirmed";
    if (
      (isFuture(end) || isTodayUTC(end)) &&
      isPast(start) &&
      !isTodayUTC(start)
    )
      status = "checked-in";

    return {
      // base columns expected by your DB
      created_at,
      startDate,
      endDate,
      hasBreakfast: seed.hasBreakfast,
      observations: seed.observations,
      isPaid: seed.isPaid,
      numGuests: seed.numGuests,

      // derived columns expected by your app
      numNights,
      cabinPrice,
      extrasPrice,
      totalPrice: cabinPrice + extrasPrice,
      status,

      // FK remap (IMPORTANT)
      guestId: guestIds.at(seed.guestId - 1),
      cabinId: cabinIds.at(seed.cabinId - 1),
    };
  });

  must(await supabase.from("bookings").insert(finalBookings), "insert bookings");
}

// ---------- orchestrator ----------
async function resetDemo() {
  console.log("Resetting Oasis demo data...");

  await deleteAll();
  const guestIds = await insertGuests();
  const cabinIds = await insertCabins();
  await insertBookings(guestIds, cabinIds);

  console.log("Demo reset complete.");
}

resetDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
