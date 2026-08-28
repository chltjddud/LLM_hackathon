import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync("shield-web/.env.local", "utf8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ""
);

async function check() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ limit: 10 });
  if (error) {
    console.log("Cannot list users using admin API:", error.message);
  } else {
    for (const u of users) {
      console.log(u.email, JSON.stringify(u.user_metadata));
    }
  }
}
check();
