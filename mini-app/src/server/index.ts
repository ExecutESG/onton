import "@/lib/gracefullyShutdown";
import { couponRouter } from "@/server/routers/couponRouter";
import { eventTicketRouter } from "@/server/routers/eventTicket";
import { hubsRouter } from "@/server/routers/hubs";
import { configRouter } from "@/server/routers/OntonSetting";
import { organizerRouter } from "@/server/routers/organizers";
import { POARouter } from "@/server/routers/POA";
import { registrantRouter } from "@/server/routers/registrant";
import { sbtRewardCollectionRouter } from "@/server/routers/sbtRewardCollectionRouter";
import { telegramInteractionsRouter } from "@/server/routers/telegramInteractions";
import { ticketRouter } from "@/server/routers/tickets";
import { userRolesRouter } from "@/server/routers/userRolesRouter";
import { UsersScoreRouter } from "@/server/routers/UsersScore";
import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { eventsRouter } from "./routers/events";
import { fieldsRouter } from "./routers/files";
import { locationRouter } from "./routers/location";
import { ordersRouter } from "./routers/orders";
import { tournamentsRouter } from "./routers/tournaments";
import { userEventFieldsRouter } from "./routers/userEventFields";
import { usersRouter } from "./routers/users";
import { visitorsRouter } from "./routers/visitors";
import { router } from "./trpc";
import { campaignRouter } from "@/server/routers/campaignRouter";
import { tasksRouter } from "@/server/routers/tasksRouter";
import { tonProofRouter } from "@/server/routers/tonProofRouter";
import { raffleRouter } from "@/server/routers/raffleRouter";
import { affiliateRouter } from "@/server/routers/affiliateRouter";
import { usersXRouter } from "@/server/routers/usersXRouter";
import { usersGithubRouter } from "@/server/routers/usersGithubRouter";
import { usersLinkedinRouter } from "@/server/routers/usersLinkedinRouter";
import { questRouter } from "@/server/routers/questRouter";
import { usersGoogleRouter } from "@/server/routers/usersGoogleRouter";
import { usersOutlookRouter } from "@/server/routers/usersOutlookRouter";

export const appRouter = router({
  users: usersRouter,
  visitors: visitorsRouter,
  events: eventsRouter,
  files: fieldsRouter,
  userEventFields: userEventFieldsRouter,
  location: locationRouter,
  config: configRouter,
  ticket: ticketRouter,
  eventTicket: eventTicketRouter,
  orders: ordersRouter,
  organizers: organizerRouter,
  sbtRewardCollection: sbtRewardCollectionRouter,
  EventPOA: POARouter,
  hubs: hubsRouter,
  telegramInteractions: telegramInteractionsRouter,
  registrant: registrantRouter,
  coupon: couponRouter,
  userRoles: userRolesRouter,
  usersScore: UsersScoreRouter,
  tournaments: tournamentsRouter,
  campaign: campaignRouter,
  task: tasksRouter,
  tonProof: tonProofRouter,
  raffle: raffleRouter,
  affiliate: affiliateRouter,
  usersX: usersXRouter,
  usersGithub: usersGithubRouter,
  usersLinkedin: usersLinkedinRouter,
  quest: questRouter,
  usersGoogle: usersGoogleRouter,
  usersOutlook: usersOutlookRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;
