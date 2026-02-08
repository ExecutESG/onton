import { logger } from "@/server/utils/logger";
export const fetchCoordsByName = async (countryName: string, cityName: string) => {
  const res = await fetch(`https://geocode.search.hereapi.com/v1/geocode?q=${cityName}+${countryName}&apiKey=a5MNhGDQ9xejTyx8W8bRn2kXBjIOcSDWBFycFJKQkZ0`)
  const data = await res.json()
  return data
}