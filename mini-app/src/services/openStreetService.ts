import { logger } from "@/server/utils/logger";

export const fetchCoordsByName = async (countryName: string, cityName: string) => {
  try {
    const query = encodeURIComponent(`${cityName}, ${countryName}`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "OntonApp/1.0 (info@onton.live)",
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      logger.error(`Geocoding error: ${res.statusText}`);
      return { items: [] };
    }

    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      const lat = parseFloat(first.lat);
      const lng = parseFloat(first.lon);
      return {
        lat,
        lng,
        items: [
          {
            title: first.display_name,
            position: { lat, lng },
          },
        ],
      };
    }

    return { items: [] };
  } catch (error) {
    logger.error("Error fetching coordinates:", error);
    return { items: [] };
  }
};