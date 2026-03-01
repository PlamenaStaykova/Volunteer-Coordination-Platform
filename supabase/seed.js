// supabase/seed.js
// Seed script for Volunteer Coordination Platform sample data.
//
// Usage:
//   SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> node supabase/seed.js
//
// It creates four accounts, profiles, sample events/shifts, and one volunteer
// with past participation. Organizers are the two users who own events; the
// "experienced" volunteer will have a signup marked attended.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// load .env for local convenience
import dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(url, key);
const USERS_PER_PAGE = 200;

async function findUserByEmail(email) {
  const targetEmail = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    });

    if (error) {
      console.error("failed to list users while resolving existing account", email, error);
      return null;
    }

    const users = data?.users ?? [];
    const existing = users.find((user) => user.email?.toLowerCase() === targetEmail);
    if (existing) {
      return existing;
    }

    if (users.length < USERS_PER_PAGE) {
      return null;
    }

    page += 1;
  }
}

function isDuplicateUserError(error) {
  const details = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    details.includes("already") ||
    details.includes("exists") ||
    details.includes("registered") ||
    details.includes("duplicate")
  );
}

async function getOrCreateUser(userSpec) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: userSpec.email,
    password: userSpec.password,
    email_confirm: true,
  });

  if (!error) {
    const createdUserId = data?.user?.id;
    if (!createdUserId) {
      console.error("failed to resolve created user id", userSpec.email, data);
      return null;
    }
    return createdUserId;
  }

  if (isDuplicateUserError(error)) {
    const existingUser = await findUserByEmail(userSpec.email);
    if (existingUser?.id) {
      return existingUser.id;
    }
  }

  console.error("failed to create user", userSpec.email, error);
  return null;
}

async function seed() {
  console.log("creating users...");
  const usersSpec = [
    { email: "plamena@gmail.com", password: "123456", display_name: "Plamena Organizer", type: "organizer" },
    { email: "mikki@gmail.com", password: "123456", display_name: "Mikki Organizer", type: "organizer" },
    { email: "peter@gmail.com", password: "123456", display_name: "Peter Volunteer", type: "volunteer" },
    { email: "jenny@gmail.com", password: "123456", display_name: "Jenny Experienced", type: "volunteer" },
  ];

  const created = [];
  for (const u of usersSpec) {
    const createdUserId = await getOrCreateUser(u);
    if (!createdUserId) {
      continue;
    }

    created.push({ ...u, id: createdUserId });
  }

  console.log("upserting profiles...");
  for (const u of created) {
    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: u.id,
          display_name: u.display_name,
        },
        { onConflict: "id" },
      );
    if (error) console.error("profile upsert error for", u.email, error);
  }

  // ensure events for organizers in different statuses
  console.log("creating events...");
  const now = new Date();
  const eventSpecs = [];
  for (const org of created.filter((u) => u.type === "organizer")) {
    const base = org.display_name.split(" ")[0];
    const statuses = ["draft", "published", "cancelled"];
    statuses.forEach((status, idx) => {
      const start = new Date(now.getTime() + (idx * 10 + 20) * 24 * 3600 * 1000);
      const end = new Date(start.getTime() + 3 * 3600 * 1000);
      eventSpecs.push({
        id: randomUUID(),
        title: `${base} ${status} Campaign`,
        description: `${status} campaign for ${base}`,
        location: "City Hall",
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        created_by: org.id,
        status,
      });
    });
  }
  const events = [];
  for (const spec of eventSpecs) {
    const { data: existingRows, error: existingErr } = await supabase
      .from("events")
      .select("id")
      .eq("created_by", spec.created_by)
      .eq("title", spec.title)
      .limit(1);

    if (existingErr) {
      console.error("events lookup error", spec.title, existingErr);
      continue;
    }

    const existingId = existingRows?.[0]?.id;
    if (existingId) {
      events.push({ ...spec, id: existingId });
      continue;
    }

    const { error: eventInsertErr } = await supabase.from("events").insert(spec);
    if (eventInsertErr) {
      console.error("events insert error", spec.title, eventInsertErr);
      continue;
    }

    events.push(spec);
  }

  console.log("creating shifts for published events...");
  const published = events.filter((e) => e.status === "published");
  const shifts = [];
  for (const event of published) {
    const { data: existingRows, error: existingErr } = await supabase
      .from("shifts")
      .select("id")
      .eq("event_id", event.id)
      .eq("title", "Default shift")
      .limit(1);

    if (existingErr) {
      console.error("shifts lookup error", event.title, existingErr);
      continue;
    }

    const existingId = existingRows?.[0]?.id;
    if (existingId) {
      shifts.push({
        id: existingId,
        event_id: event.id,
        title: "Default shift",
      });
      continue;
    }

    const shift = {
      id: randomUUID(),
      event_id: event.id,
      title: "Default shift",
      starts_at: event.start_at,
      ends_at: event.end_at,
      capacity: 10,
    };

    const { error: shiftInsertErr } = await supabase.from("shifts").insert(shift);
    if (shiftInsertErr) {
      console.error("shifts insert error", event.title, shiftInsertErr);
      continue;
    }

    shifts.push(shift);
  }

  // volunteer participation
  console.log("adding sample signups...");
  const experienced = created.find((u) => u.email === "jenny@gmail.com");
  if (experienced) {
    const signupRows = [];
    if (shifts[0]) {
      signupRows.push({ shift_id: shifts[0].id, user_id: experienced.id, status: "attended" });
    }
    if (shifts[1]) {
      signupRows.push({ shift_id: shifts[1].id, user_id: experienced.id, status: "signed" });
    }

    if (signupRows.length > 0) {
      const { error: sigErr } = await supabase
        .from("shift_signups")
        .upsert(signupRows, { onConflict: "shift_id,user_id" });
      if (sigErr) console.error("signup upsert error", sigErr);
    }
  }

  console.log("seed finished");
}

seed().catch((err) => {
  console.error("unexpected error", err);
  process.exit(1);
});
