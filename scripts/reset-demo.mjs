import { createClient } from "@supabase/supabase-js";
import { isFuture, isPast, isToday } from "date-fns";

import bookings from "../src/data/data-bookings.js";
import cabins from "../src/data/data-cabins.js";
import guests from "../src/data/data-guests.js";

function subtractDates(dateStr1, dateStr2) {
  return Math.round(
    (new Date(dateStr1).getTime() - new Date(dateStr2).getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const supabase = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

async function must({ error }, label) {
  if (error) throw new Error(`${label} failed: ${error.message}`);
}

/* -------- delete in FK-safe order -------- */
async function deleteAll() {
  await must(await supabase.from("bookings").delete().neq("id", 0), "delete bookings");
  await must(await supabase.from("guests").delete().neq("id", 0), "delete guests");
  await must(await supabase.from("cabins").delete().neq("id", 0), "delete cabins");
}

/* -------- insert base tables -------- */
async function insertGuests() {
  const res = await supabase.from("guests").insert(guests).select("id");
  await must(res, "insert guests");
  return res.data.map(g => g.id);
}

async function insertCabins() {
  const res = await supabase.from("cabins").insert(cabins).select("id");
  await must(res, "insert cabins");
  return res.data.map(c => c.id);
}

/* -------- bookings (with FK remap + derived fields) -------- */
async function insertBookings(guestIds, cabinIds) {
  const finalBookings = bookings.map((booking) => {
    const cabin = cabins.at(booking.cabinId - 1);
    const numNights = subtractDates(booking.endDate, booking.startDate);

    const cabinPrice = numNights * (cabin.regularPrice - cabin.discount);
    const extrasPrice = booking.hasBreakfast
      ? numNights * 15 * booking.numGuests
      : 0;

    let status;
    if (isPast(new Date(booking.endDate)) && !isToday(new Date(booking.endDate)))
      status = "checked-out";
    if (isFuture(new Date(booking.startDate)) || isToday(new Date(booking.startDate)))
      status = "unconfirmed";
    if (
      (isFuture(new Date(booking.endDate)) || isToday(new Date(booking.endDate))) &&
      isPast(new Date(booking.startDate)) &&
      !isToday(new Date(booking.startDate))
    )
      status = "checked-in";

    return {
      ...booking,
      numNights,
      cabinPrice,
      extrasPrice,
      totalPrice: cabinPrice + extrasPrice,
      guestId: guestIds.at(booking.guestId - 1),
      cabinId: cabinIds.at(booking.cabinId - 1),
      status,
    };
  });

  const res = await supabase.from("bookings").insert(finalBookings);
  await must(res, "insert bookings");
}

/* -------- orchestrator -------- */
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
