import { Address } from "@ton/core";
import { z } from "zod";
import { EventCategoryRow, ticketTypes } from "./db/schema";

export type OntonEvent = {
  eventUuid: string;
  title?: string;
  startDate: number;
  endDate: number;
  location?: string;
  imageUrl?: string;
  subtitle?: string;
  organizerFirstName?: string;
  organizerLastName?: string;
  organizerUsername?: string;
  organizerUserId?: number;
  ticketToCheckIn?: boolean;
  timezone?: string;

  reservedCount?: number;
  visitorCount?: number;
  ticketPrice?: number;
  city?: string;
  country?: string;
  participationType?: string;
  category?: EventCategoryRow;
};

export type InputField = {
  type: string;
  title: string;
  description: string;
  placeholder: string;
  emoji: string;
};

export type ButtonField = {
  type: string;
  title: string;
  description: string;
  url: string;
  emoji: string;
};

export type FieldElement = InputField | ButtonField;

export interface HubsResponse {
  status: string;
  data: HubType[];
}

export interface HubType {
  id: number;
  attributes: Attributes;
}

export type SocietyHub = {
  id: string;
  name: string;
};

export interface Attributes {
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export type TRequiredEventFields = {
  type: number;
  title: string;
  subtitle: string;
  description: string;
  location: string;
  image_url: string;
  secret_phrase: string;
  society_hub: {
    id: string;
    name: string;
  };
  start_date: number | null;
  end_date: number | null;
  timezone: string;
};

type BaseDynamicField = {
  title: string;
  description: string;
  type: string;
  emoji: string;
};
const isEmoji = (text: string) => {
  const emojiRegex = /\p{Emoji}/u;
  return emojiRegex.test(text);
};

export const InputDynamicFieldSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.string(),
  emoji: z.string().min(1).refine(isEmoji, {
    message: "Must be a valid emoji",
  }),
  placeholder: z.string(),
});

export type InputDynamicField = BaseDynamicField & {
  type: "input";
  placeholder: string;
};

export const ButtonDynamicFieldSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.string(),
  emoji: z.string().min(1).refine(isEmoji, {
    message: "Must be a valid emoji",
  }),
  url: z.string().url(),
});

export type ButtonDynamicField = BaseDynamicField & {
  type: "button";
  url: string;
};

type DynamicField = InputDynamicField | ButtonDynamicField;

export type CreateEventData = TRequiredEventFields & {
  dynamic_fields: DynamicField[];
};

export type ZodErrors = {
  [key: string]: string;
};

export const DynamicFieldsSchema = z.array(
  z.object({
    id: z.number().optional(),
    title: z.string(),
    description: z.string(),
    type: z.string(),
    emoji: z.string(),
    placeholder: z.string().optional(),
    url: z.string().optional(),
  })
);

/* -------------------------------------------------------------------------- */
/*                          💲💲Paid Event Schema💲💲                         */
/* -------------------------------------------------------------------------- */
export const PaidEventSchema = z
  .object({
    has_payment: z.boolean({ required_error: "payment status is required" }).optional().default(false),
    payment_recipient_address: z.string({ required_error: "recipient address is required" }).optional().default(""),
    token_id: z.number({ required_error: "token is required" }).int().positive().optional(),
    payment_amount: z.number({ required_error: "payment amount is required" }).optional(),
    has_nft: z.boolean({ required_error: "NFT status is required" }).optional().default(false),
    nft_title: z.string({ required_error: "NFT title is required" }).optional().default(""),
    nft_description: z.string({ required_error: "NFT description is required" }).optional().default(""),
    nft_image_url: z.string({ required_error: "NFT image URL is required" }).optional(),
    nft_video_url: z.string({ required_error: "NFT video URL is required" }).optional(),
    ticket_type: z.enum(ticketTypes, { required_error: "Ticket type is required" }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.has_payment) {
      // Validate that `payment_recipient_address` is not empty
      if (!data.payment_recipient_address)
        ctx.addIssue({ code: "custom", path: ["payment_recipient_address"], message: "Recipient address is Required" });
      else {
        try {
          /*
           * This will throw if invalid address is passed
           */
          Address.parse(data.payment_recipient_address);
        } catch (error) {
          ctx.addIssue({
            code: "custom",
            path: ["payment_recipient_address"],
            message: "Recipient address is Invalid!",
          });
        }
      }

      // Validate that a payment token is present
      if (!data.token_id)
        ctx.addIssue({
          code: "custom",
          path: ["token_id"],
          message: "Payment token is required.",
        });

      // Validate that `payment_amount` is present and greater than 0
      if (data.payment_amount === undefined || data.payment_amount <= 0)
        ctx.addIssue({ code: "custom", path: ["payment_amount"], message: "Payment amount must be greater than 0" });

      // Validate that `nft` is present
      if (data.has_nft) {
        if (!data.ticket_type) ctx.addIssue({ code: "custom", path: ["ticket_type"], message: "Ticket type is required" });

        if (!data.nft_image_url)
          ctx.addIssue({ code: "custom", path: ["nft_image_url"], message: "Nft image url is required" });

        if (data.ticket_type === "TSCSBT" && !data.nft_video_url)
          ctx.addIssue({ code: "custom", path: ["nft_video_url"], message: "Nft video url is required" });

        if (!data.nft_title) ctx.addIssue({ code: "custom", path: ["nft_title"], message: "Nft title is required" });

        if (!data.nft_description)
          ctx.addIssue({ code: "custom", path: ["nft_description"], message: "Nft description is required" });
      }
    }
  });

//Create Event
export const EventDataSchema = z
  .object({
    /* -------------------------- Event Basic Info ------------------------- */
    event_id: z.number({ required_error: "event ID is required" }).optional(),
    event_uuid: z.string({ required_error: "event UUID is required" }).optional(),
    type: z.number({ required_error: "type is required" }),
    title: z.string({ required_error: "title is required" }),
    subtitle: z.string({ required_error: "subtitle is required" }),
    description: z.string({ required_error: "description is required" }),

    /* -------------------------- Location Info ------------------------- */
    location: z.string({ required_error: "location is required" }),
    eventLocationType: z
      .enum(["online", "in_person"], {
        required_error: "event location type is required",
      })
      .optional(),
    countryId: z.number({ required_error: "country ID is required" }).optional(),
    cityId: z.number({ required_error: "city ID is required" }).optional(),

    /* -------------------------- Media URLs ------------------------- */
    image_url: z
      .string({ required_error: "event image is required" })
      .url({ message: "Please upload a valid event image URL" }),
    video_url: z
      .string({ required_error: "video URL is required" })
      .url({ message: "Please select a valid reward video URL" })
      .optional(),
    ts_reward_url: z
      .string({ required_error: "reward URL is required" })
      .url({ message: "Please select a valid reward image URL" }),

    /* -------------------------- Organization Info ------------------------- */
    society_hub: z.object({
      id: z.string({ required_error: "society_hub.id is required" }),
      name: z.string({ required_error: "society_hub.name is required" }),
    }),
    owner: z.number({ required_error: "owner is required" }),
    activity_id: z.number({ required_error: "activity ID is required" }).optional(),

    /* -------------------------- Event Settings ------------------------- */
    secret_phrase: z.string().optional(), // Made optional initially
    start_date: z.number({ required_error: "start_date is required" }),
    end_date: z.number({ required_error: "end date is required" }).nullable(),
    timezone: z.string({ required_error: "timezone is required" }),
    dynamic_fields: DynamicFieldsSchema, // Assuming DynamicFieldsSchema is defined elsewhere

    /* -------------------------- Free Event Registration Creation ------------------------- */
    has_registration: z.boolean({ required_error: "registration status is required" }),
    has_approval: z.boolean({ required_error: "approval status is required" }),
    capacity: z.number({ required_error: "capacity is required" }).min(1).nullable(),
    has_waiting_list: z.boolean({ required_error: "waiting list status is required" }),

    /* ------------------------------- Paid Event Creation ------------------------------- */
    paid_event: PaidEventSchema.optional(),
    /* -------------------------- Event Category ------------------------- */
    category_id: z
      .number({ required_error: "category_id is required" }) // mandatory
      .int()
      .positive(),
  })
  .superRefine((data, ctx) => {
    // Validate secret_phrase is required for non-paid events
    if (!data.paid_event?.has_payment && !data.has_registration && !data.secret_phrase) {
      ctx.addIssue({
        code: "custom",
        path: ["secret_phrase"],
        message: "Secret phrase is required for free events.",
      });
    }
  });

export const UpdateEventDataSchema = z.object({
  /* -------------------------- Event Basic Info ------------------------- */
  event_id: z.number().optional(),
  event_uuid: z.string().optional(),
  type: z.number({ required_error: "type is required" }),
  title: z.string({ required_error: "title is required" }),
  subtitle: z.string({ required_error: "subtitle is required" }),
  description: z.string({ required_error: "description is required" }),

  /* -------------------------- Location Info ------------------------- */
  location: z.string({ required_error: "location is required" }),
  eventLocationType: z
    .enum(["online", "in_person"], {
      required_error: "event location type is required",
    })
    .optional(),
  countryId: z
    .number({
      required_error: "country ID is required",
    })
    .optional(),
  cityId: z
    .number({
      required_error: "city ID is required",
    })
    .optional(),

  /* -------------------------- Media URLs ------------------------- */
  image_url: z.string({ required_error: "event image is required" }).url({ message: "Please upload a valid image URL" }),
  video_url: z.string().url({ message: "Please upload a valid video URL" }).optional(),
  ts_reward_url: z
    .string()
    .url({
      message: "Please upload a valid reward image URL",
    })
    .optional(),

  /* -------------------------- Organization Info ------------------------- */
  society_hub: z.object({
    id: z.string({ required_error: "society_hub.id is required" }),
    name: z.string({ required_error: "society_hub.name is required" }),
  }),
  owner: z.number({ required_error: "owner is required" }),
  activity_id: z.number().optional(),

  /* -------------------------- Event Settings ------------------------- */
  secret_phrase: z.string({ required_error: "password is required" }).optional(),
  start_date: z.number({ required_error: "start_date is required" }),
  end_date: z.number({ required_error: "end_date is required" }),
  timezone: z.string({ required_error: "timezone is required" }),
  dynamic_fields: DynamicFieldsSchema,

  /* -------------------------- Free Event Registration Update ------------------------- */
  has_approval: z.boolean({
    required_error: "approval status is required",
  }),
  capacity: z
    .number({
      required_error: "capacity is required",
    })
    .min(1)
    .nullable(),
  has_waiting_list: z.boolean({
    required_error: "waiting list status is required",
  }),
  /* -------------------------- Free Event Registration Update ------------------------- */

  /* ------------------------------- Paid Event Update ------------------------------- */
  paid_event: PaidEventSchema.optional(),
  /* -------------------------- Event Category ------------------------- */
  category_id: z.number({ required_error: "category_id is required" }).int().positive(),
});

export const EventRegisterSchema = z.object({
  /* -------------------------- Basic Info ------------------------- */
  event_uuid: z.string({ required_error: "event UUID is required" }).uuid(),
  full_name: z
    .string({ required_error: "Full name is required" })
    .min(2, { message: "Full name must be at least 2 characters long" })
    .max(40, { message: "Full name must be at most 40 characters long" }),
  company: z
    .string({ required_error: "Company name is required" })
    .min(2, { message: "Company name must be at least 2 characters long" })
    .max(40, { message: "Company name must be at most 40 characters long" }),
  position: z
    .string({ required_error: "Position is required" })
    .min(2, { message: "Position must be at least 2 characters long" })
    .max(40, { message: "Position must be at most 40 characters long" }),

  /* -------------------------- Optional Fields ------------------------- */
  linkedin: z
    .string()
    .max(100)
    .optional()
    .refine((value) => !value || /^(https?:\/\/)?([\w]+\.)?linkedin\.com\/.+/.test(value), {
      message: "Please enter a valid LinkedIn URL",
    }),
  github: z.string({ required_error: "GitHub URL is required" }).max(30).optional(),
  notes: z.string({ required_error: "notes are required" }).max(512).optional(),
});

export const CustomEventRegisterSchema = z.object({
  event_uuid: z.string(),
  full_name: z.string().min(1, "Full Name is required."),
  company: z.string().min(1, "Organization is required."),
  role: z.string().min(1, "Your role is required."),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  email: z.string().min(1, "Email is required.").email("Invalid email format."),
  career: z.string().min(1, "Please select an option."),
  developer_type: z.string().default(""),
  main_goal: z.string().min(1, "Main request/goal is required."),
});

export const CombinedEventRegisterSchema = z.union([EventRegisterSchema, CustomEventRegisterSchema]);

export const AgendaItemSchema = z.object({
  time: z.string({ required_error: "time is required" }), // assuming time is a string, e.g., "10:00 AM"
  title: z.string({ required_error: "title is required" }).min(1, "Title is required"),
  description: z.string({ required_error: "description is required" }).optional(),
});

export const AgendaHeaderSchema = z.object({
  header: z.string({ required_error: "header is required" }).min(1, "Header is required"),
  items: z.array(AgendaItemSchema), // each header can have multiple items
});

export type EventData = z.infer<typeof EventDataSchema>;

export const RequiredEventFieldsSchema = z
  .object({
    /* -------------------------- Basic Event Info ------------------------- */
    title: z.string({ required_error: "title is required" }).min(1, { message: "Required" }),
    subtitle: z.string({ required_error: "subtitle is required" }).min(1, { message: "Required" }),
    description: z.string({ required_error: "description is required" }).min(1, { message: "Required" }),
    location: z.string({ required_error: "location is required" }).min(1, { message: "Required" }),

    /* -------------------------- Media ------------------------- */
    image_url: z
      .string({ required_error: "image URL is required" })
      .url()
      .refine((url) => url.includes("telegra.ph"), {
        message: "URL must be from the 'telegra.ph' domain",
      }),

    /* -------------------------- Event Settings ------------------------- */
    secret_phrase: z
      .string({ required_error: "secret phrase is required" })
      .transform((phrase) => phrase.trim().toLowerCase())
      .refine((phrase) => phrase.length >= 4 && phrase.length <= 20, "Length must be between 4 and 20"),
    start_date: z
      .number({ required_error: "start date is required" })
      .min(new Date("2023-01-01").getTime() / 1000)
      .max(new Date("2033-12-31").getTime() / 1000),
    end_date: z
      .number({ required_error: "end date is required" })
      .min(new Date("2023-01-01").getTime() / 1000)
      .max(new Date("2033-12-31").getTime() / 1000)
      .nullable()
      .optional(),
    timezone: z.string({ required_error: "timezone is required" }),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.start_date <= data.end_date;
      }
      return true;
    },
    {
      message: "Start date must be before end date",
      path: ["start_date", "end_date"],
    }
  );

export type TRequiredEventFieldsSchema = z.infer<typeof RequiredEventFieldsSchema>;

export const UserSchema = z.object({
  /* -------------------------- Basic User Info ------------------------- */
  id: z.number({ required_error: "user ID is required" }),
  username: z.string({ required_error: "username is required" }),
  first_name: z.string({ required_error: "first name is required" }),
  last_name: z.string({ required_error: "last name is required" }),
  language_code: z.string({ required_error: "language code is required" }),
  role: z.string({ required_error: "role is required" }),
  wallet_address: z.string({ required_error: "wallet address is required" }).optional(),
});

export type TelegramInitDataJson = {
  query_id: string;
  user: TelegramUser;
  auth_date: string;
  hash: string;
  [key: string]: string | TelegramUser | undefined;
};

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  language_code: string;
  is_premium: boolean;
  allows_write_to_pm: boolean;
};

export type ValueOf<T> = T[keyof T];

export type EventDataSchemaAllOptional = Partial<z.infer<typeof EventDataSchema>>;
export type PaidEventType = z.infer<typeof PaidEventSchema>;

export interface Channel {
  user_id: number;
  photo_url: string | null;
  participated_event_count?: number | null;
  org_channel_name: string | null;
  org_support_telegram_user_name: string | null;
  org_x_link: string | null;
  org_bio: string | null;
  org_image: string | null;
  hosted_event_count?: number | null;
}

type OptionalKeys<T> = {
  [K in keyof T]?: T[K];
};

export type MergeWithOptional<A, B> = OptionalKeys<Omit<A, keyof B>> &
  OptionalKeys<Omit<B, keyof A>> &
  Pick<A, keyof A & keyof B>;

export type TonProofSavedSession = { token: string; proof: string };
