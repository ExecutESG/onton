import { Composer } from "grammy"
import { collectionComposer } from "../composers/collectionComposer"
import { toIdComposer } from "../composers/toIdComposer"
import { affiliateComposer } from "./affiliateComposer"
import { broadcastComposer } from "./broadcast"
import { cancelComposer } from "./cancelComposer"
import { channelPostButtonComposer } from "./channelPostButtonComposer"
import { groupComposer } from "./groupComposer"
import helpComposer from "./helpComposer"
import { play2winFeatured } from "./play2winfetured"
import { sbtdistComposer } from "./sbtdistComposer"
import { tournamentComposer } from "./tournamentComposer"
import {pollComposer} from "./pollComposer";

// join other composers here
export const mainComposer = new Composer();

mainComposer.use(broadcastComposer);
mainComposer.use(pollComposer);
mainComposer.use(sbtdistComposer);
mainComposer.use(affiliateComposer);
mainComposer.use(groupComposer);
mainComposer.use(tournamentComposer);
mainComposer.use(play2winFeatured);
mainComposer.use(collectionComposer);
mainComposer.use(toIdComposer);
mainComposer.use(channelPostButtonComposer);
mainComposer.use(cancelComposer);
mainComposer.use(helpComposer);
