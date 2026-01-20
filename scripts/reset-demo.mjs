import { createClient } from "@supabase/supabase-js";

import { bookings } from "../src/data/data-bookings.js";
import { cabins } from "../src/data/data-cabins.js";
import { guests } from "../src/data/data-guests.js";

function subtractDates(dateStr1, dateStr2) {
  return Math.round(
    (new Date(dateStr1).getTime() - new Date(dateStr2).getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function isToday(date) {
  const d = new Date(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isPast(date) {
  const d = new Date(date);
  return d < new Date() && !isToday(d);
}

function isFuture(date) {
  const d = new Date(date);
  return d > new Date() && !isToday(d);
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

function must(label, res) {
  if (res?.error) throw new Error(`${label} failed: ${res.error.message}`);
  return res.data;
}

async function deleteAll() {
  must("delete bookings", await supabase.from("bookings").delete().neq("id", 0));
  must("delete guests", await supabase.from("guests").delete().neq("id", 0));
  must("delete cabins", await supabase.from("cabins").delete().neq("id", 0));
}

async function insertGuests() {
  must("insert guests", await supabase.from("guests").insert(guests));
  const rows = must(
    "fetch guest ids",
    await supabase.from("guests").select("id").order("id")
  );
  return rows.map((g) => g.id);
}

async function insertCabins() {
  must("insert cabins", await supabase.from("cabins").insert(cabins));
  const rows = must(
    "fetch cabin ids",
    await supabase.from("cabins").select("id").order("id")
  );
  return rows.map((c) => c.id);
}

async function insertBookings(guestIds, cabinIds) {
  const finalBookings = bookings.map((booking) => {
    const cabin = cabins.at(booking.cabinId - 1);
    const numNights = subtractDates(booking.endDate, booking.startDate);

    const cabinPrice = numNights * (cabin.regularPrice - cabin.discount);
    const extrasPrice = booking.hasBreakfast
      ? numNights * 15 * booking.numGuests
      : 0;

    let status;
    if (isPast(booking.endDate)) status = "checked-out";
    if (isFuture(booking.startDate) || isToday(booking.startDate))
      status = "unconfirmed";
    if (
      (isFuture(booking.endDate) || isToday(booking.endDate)) &&
      isPast(booking.startDate)
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

  must("insert bookings", await supabase.from("bookings").insert(finalBookings));
}

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
