// locationRouter.ts
import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { fetchCountries, fetchCities, fetchCityById } from "@/db/modules/giataCity.db";
import { fetchCoordsByName } from "@/services/openStreetService";

export const locationRouter = router({
  getCountries: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
      })
    )
    .query(async (opts) => {
      return await fetchCountries(opts.input.search);
    }),

  getCities: publicProcedure
    .input(z.object({ countryId: z.number(), search: z.string().optional() }))
    .query(async (opts) => {
      return await fetchCities(opts.input.countryId, opts.input.search);
    }),

  getCityById: publicProcedure.input(z.object({ cityId: z.number() })).query(async (opts) => {
    return await fetchCityById(opts.input.cityId);
  }),

  getCoordsByName: publicProcedure
    .input(
      z.object({
        countryName: z.string(),
        cityName: z.string(),
      })
    )
    .query(async (opts) => {
      return await fetchCoordsByName(opts.input.countryName, opts.input.cityName);
    }),
});
