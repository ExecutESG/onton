import { db } from "@/db/db";
import { users } from "@/db/schema";
import { user_custom_flags } from "@/db/schema/user_custom_flags";
import { eq, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

// Load env vars from root (adjust path if needed)
dotenv.config({ path: "../.env" });

async function main() {
    console.log("🔍 Finding an Admin or Organizer...");

    const user = await db.query.users.findFirst({
        where: or(eq(users.role, "admin"), eq(users.role, "organizer")),
    });

    if (!user) {
        console.error("❌ No Admin or Organizer found in the database.");
        process.exit(1);
    }

    console.log(`✅ Found User: ${user.user_id} (${user.first_name} ${user.last_name || ""}) - Role: ${user.role}`);

    // Check if they already have an API Key
    const existingKey = await db.query.user_custom_flags.findFirst({
        where: (fields, { and, eq }) =>
            and(
                eq(fields.user_id, user.user_id),
                eq(fields.user_flag, "api_key"),
                eq(fields.enabled, true)
            ),
    });

    if (existingKey) {
        console.log("\n📦 Existing API Key found:");
        console.log("--------------------------------------------------");
        console.log(`API KEY: ${existingKey.value}`);
        console.log("--------------------------------------------------");
        return;
    }

    // Generate new key
    const newKey = uuidv4();

    console.log(`✨ Generating new API Key: ${newKey}`);

    await db.insert(user_custom_flags).values({
        user_id: user.user_id,
        user_flag: "api_key",
        value: newKey,
        enabled: true,
    });

    console.log("\n🚀 API Key Successfully Created!");
    console.log("--------------------------------------------------");
    console.log(`API KEY: ${newKey}`);
    console.log("--------------------------------------------------");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
