import { CronJob } from "cron";
import { pollSenderCron } from "./pollSenderCron";
import { bot } from "../main";
import {broadcastSenderCron} from "./broadcastSenderCron"; // or wherever your bot is exported

export function startPollSenderCron() {
    // “*/2 * * * *” means “every 2 minutes”
    new CronJob(
        "*/10 * * * * *",
        async () => {
            // The function that will be run every 2 minutes
            // waitForCompletion: true => do not start a new run if the previous hasn’t finished
            await pollSenderCron(bot);
        },
        null, // onComplete
        true, // start now
        undefined, // timezone
        undefined, // context
        false, // runOnInit
        undefined, // utcOffset
        false, // unrefTimeout
        true // waitForCompletion
    );
    new CronJob(
        "*/10 * * * * *",
        async () => {
            // The function that will be run every 2 minutes
            // waitForCompletion: true => do not start a new run if the previous hasn’t finished
            await broadcastSenderCron(bot);
        },
        null, // onComplete
        true, // start now
        undefined, // timezone
        undefined, // context
        false, // runOnInit
        undefined, // utcOffset
        false, // unrefTimeout
        true // waitForCompletion
    );
}
