import { db } from "@/db/db";
import { specialGuests } from "@/db/schema";
import { and, ilike, SQLWrapper } from "drizzle-orm";

type SpecialGuest = {
  id: number;
  name: string;
  surname: string;
  company: string;
  position: string;
  telegram: string;
  userId?: number;
  type?: string;
};

// Function to get all special guests with optional search by name
const fetchSpecialGuests = async (search?: string): Promise<SpecialGuest[]> => {
  const whereOptions: SQLWrapper[] = [];
  if (search) {
    whereOptions.push(ilike(specialGuests.name, `%${search}%`));
  }

  const result = await db
    .select()
    .from(specialGuests)
    .where(and(...whereOptions))
    .execute();

  return result as SpecialGuest[];
};

// Exporting functions as part of specialGuestDB
const specialGuestDB = {
  fetchSpecialGuests,
};

export default specialGuestDB;
