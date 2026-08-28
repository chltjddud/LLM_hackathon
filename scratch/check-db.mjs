import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load .env.local
const envContent = readFileSync("shield-web/.env.local", "utf8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

async function check() {
  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select("id, tenant_user_id, landlord_user_id")
    .limit(1);

  console.log("Sessions query:", { data: sessionData, error: sessionError });

  const { data: clauseData, error: clauseError } = await supabase
    .from("clauses")
    .select("id, original_text")
    .limit(1);

  console.log("Clauses query:", { data: clauseData, error: clauseError });
}

check();
