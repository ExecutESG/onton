import { z } from "zod";
import { PLACEHOLDER_IMAGE, PLACEHOLDER_VIDEO } from "@/constants";
import { TonSocietyRegisterActivityT } from "@/types/event.types";
import { fetchCountryById } from "@/db/modules/giataCity.db";
import { EventDataSchema } from "@/types";
import { timestampToIsoString } from "@/lib/DateAndTime";
interface TonSocietyDraftSchema {
  location: string;
  countryId: number | null;
  title: string;
  subtitle: string;
  description: string;
  society_hub: { id: string };
  start_date: number;
  end_date: number;
  ts_reward_url: string | null;
  video_url: string | null;
  eventLocationType: string;
}
// Original function with overloads
export function CreateTonSocietyDraft(
  input_event_data: z.infer<typeof EventDataSchema>,
  event_uuid: string
): Promise<TonSocietyRegisterActivityT>;
export function CreateTonSocietyDraft(
  input_event_data: TonSocietyDraftSchema,
  event_uuid: string
): Promise<TonSocietyRegisterActivityT>;

export async function CreateTonSocietyDraft(
  input_event_data: z.infer<typeof EventDataSchema> | TonSocietyDraftSchema,
  event_uuid: string
) {
  const additional_info = z.string().url().safeParse(input_event_data.location).success
    ? "Online"
    : input_event_data.location;
  const countryId = input_event_data.countryId;
  const country = countryId ? await fetchCountryById(countryId) : undefined;

  const eventDraft: TonSocietyRegisterActivityT = {
    title: input_event_data.title,
    subtitle: input_event_data.subtitle,
    description: input_event_data.description,
    hub_id: parseInt(input_event_data.society_hub.id),
    start_date: timestampToIsoString(input_event_data.start_date),
    end_date: timestampToIsoString(input_event_data.end_date!),
    additional_info,
    cta_button: {
      link: `https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME}/event?startapp=${event_uuid}`,
      label: "Enter Event",
    },
    ...(input_event_data.ts_reward_url
      ? {
          rewards: {
            mint_type: "manual",
            collection: {
              title: input_event_data.title,
              description: input_event_data.description,
              image: {
                url: process.env.ENV !== "local" ? input_event_data.ts_reward_url : PLACEHOLDER_IMAGE,
              },
              cover: {
                url: process.env.ENV !== "local" ? input_event_data.ts_reward_url : PLACEHOLDER_IMAGE,
              },
              item_title: input_event_data.title,
              item_description: "Reward for participation",
              item_image: {
                url: process.env.ENV !== "local" ? input_event_data.ts_reward_url : PLACEHOLDER_IMAGE,
              },
              ...(input_event_data.video_url
                ? {
                    item_video: {
                      url:
                        process.env.ENV !== "local"
                          ? new URL(input_event_data.video_url).origin + new URL(input_event_data.video_url).pathname
                          : PLACEHOLDER_VIDEO,
                    },
                  }
                : {}),
              item_metadata: {
                activity_type: "event",
                place: {
                  type: input_event_data.eventLocationType === "online" ? "Online" : "Offline",
                  ...(country && country?.abbreviatedCode
                    ? {
                        country_code_iso: country.abbreviatedCode,
                        venue_name: input_event_data.location,
                      }
                    : {
                        venue_name: input_event_data.location, // Use location regardless of country
                      }),
                },
              },
            },
          },
        }
      : {}),
  };
  return eventDraft;
}
