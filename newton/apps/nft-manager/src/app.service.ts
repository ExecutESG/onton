import { Injectable } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { DefaultArgs } from "@prisma/client/runtime/library";
import { Address } from "@ton/ton";
import axios, { AxiosError } from "axios";
import { PrismaService } from "nestjs-prisma";
import { getErrorMessage } from "./helper/error";
import { NftCollection } from "./nft/contracts/NftCollection";
import {
  ErrorWithData,
  GetOrderResponse,
  participantData,
  Transaction,
  UpdateOrderState,
} from "./nft/dto";
import { NFTService } from "./nft/nft.service";
import { OnTon } from "./OnTon";
import { FAIL_NFT_ITEM_TRY_COUNT } from "./utils/config";
import { miniAppClient } from "./helper/miniClient.api";

let CRONJOB_IS_RUNNING = false;

@Injectable()
export class AppService {
  // constructor(
  //   private readonly prisma: PrismaService,
  //   private readonly nftService: NFTService,
  // ) {
  //   console.log(Number(process.env.NFT_INTERVAL_TIME));
  // }
  // async retry<T>(
  //   fn: () => Promise<T>,
  //   options: { retries: number; delay: number },
  // ): Promise<T> {
  //   let lastError: Error | undefined;
  //   for (let i = 0; i < options.retries; i++) {
  //     try {
  //       return await fn();
  //     } catch (e) {
  //       console.info(e);
  //       if (e instanceof Error) {
  //         lastError = e;
  //       }
  //       await new Promise((resolve) => setTimeout(resolve, options.delay));
  //       // break;
  //     }
  //   }
  //   throw lastError;
  // }
  // @Interval(5_000)
  // async nftMintingProcess() {
  //   return;
  //   if (CRONJOB_IS_RUNNING) {
  //     console.log("MAIN_NFT_CRON_JOB is running");
  //     return;
  //   }
  //   CRONJOB_IS_RUNNING = true;
  //   console.info("Starting nftMintingProcess");
  //   const timeoutMs = 15 * 60 * 1000; // 5 minutes
  //   try {
  //     await Promise.race([
  //       Promise.all([
  //         this.checkWalletTransactionsJob(),
  //         this.sendMintRequest(),
  //       ]),
  //       timeout(timeoutMs),
  //     ]);
  //     console.log("Finished nftMintingProcess");
  //   } catch (e) {
  //     console.error("MAIN_NFT_CRON_JOB", e);
  //   } finally {
  //     CRONJOB_IS_RUNNING = false;
  //   }
  // }
  // /**
  //  * 1- Get incoming transactions to the wallets
  //  * 2- Proccess Transactions
  //  */
  // async checkWalletTransactionsJob() {
  //   console.log("Starting checkWalletTransactionsJob");
  //   const wallets = await this.prisma.watchWallet.findMany({
  //     orderBy: {
  //       updated_at: "desc",
  //     },
  //   });
  //   console.log(`Found ${wallets.length} wallets to check`);
  //   for (const wallet of wallets) {
  //     try {
  //       console.log(`Checking transactions for wallet: ${wallet.address}`);
  //       const { transactions } = await OnTon.getAccountTransactions({
  //         address: wallet.address,
  //         start_lt:
  //           parseInt(wallet.last_checked_lt) === 0
  //             ? undefined
  //             : wallet.last_checked_lt,
  //       });
  //       console.log(
  //         `Found ${transactions.length} transactions for wallet: ${wallet.address}`,
  //       );
  //       // remove the last checked lt
  //       const newTransactions = transactions.filter(
  //         (t) => t.lt !== wallet.last_checked_lt,
  //       );
  //       for (const transaction of newTransactions) {
  //         const inMsg = transaction.in_msg;
  //         if (inMsg?.message_content?.decoded?.type === "text_comment") {
  //           const comment = inMsg.message_content.decoded.comment;
  //           if (comment.startsWith("order=")) {
  //             const orderId = comment.split("=")[1];
  //             try {
  //               const order = await this.getOrder(orderId, transaction.hash);
  //               const trxValue = BigInt(inMsg.value);
  //               if (BigInt(order.total_price) === trxValue) {
  //                 if (
  //                   (["failed", "created"] as UpdateOrderState[]).includes(
  //                     order.state,
  //                   )
  //                 ) {
  //                   await this.saveSuccessfulTransaction(
  //                     transaction,
  //                     order,
  //                     comment,
  //                   );
  //                 } else {
  //                   await this.saveFailedTransaction(
  //                     transaction,
  //                     order,
  //                     comment,
  //                     `order has been processed before with state ${order.state}`,
  //                   );
  //                 }
  //               } else {
  //                 await this.saveFailedTransaction(
  //                   transaction,
  //                   order,
  //                   comment,
  //                   `insufficient value ${trxValue}`,
  //                 );
  //               }
  //             } catch (error) {
  //               console.log("ERROR_150", error);
  //               if (error instanceof AxiosError) {
  //                 console.error("ERROR_153", error.response?.data?.message);
  //               } else if (error instanceof Error) {
  //                 console.error("ERROR_153", error.message);
  //               }
  //               await this.saveFailedTransaction(
  //                 transaction,
  //                 null,
  //                 comment,
  //                 `order not found ${comment}`,
  //               );
  //             }
  //           }
  //         }
  //       }
  //       await this.prisma.watchWallet.update({
  //         where: {
  //           id: wallet.id,
  //         },
  //         data: {
  //           last_checked_lt: transactions[transactions.length - 1].lt,
  //         },
  //       });
  //       console.log(`Updated last_checked_lt for wallet: ${wallet.address}`);
  //     } catch (e) {
  //       console.error(`Error processing wallet ${wallet.address}:`, e);
  //       console.error(`Watch wallet ${wallet.address} is out of sync`);
  //     }
  //     console.log("Finished checkWalletTransactionsJob");
  //   }
  //   this.updateOrdersAndCreateNftMintRequests();
  // }
  // /**
  //  * Get transactions and create mint requests
  //  * - get all unprocessed transactions (valid transactions but not processed yet)
  //  * - for each transaction
  //  *   - get order
  //  *   - create mint request
  //  */
  // async updateOrdersAndCreateNftMintRequests() {
  //   console.log("Starting updateOrdersAndCreateNftMintRequests");
  //   const unProcessedTransactions = await this.prisma.transactions.findMany({
  //     where: {
  //       is_processed: false,
  //     },
  //   });
  //   console.log(
  //     `Found ${unProcessedTransactions.length} unprocessed transactions`,
  //   );
  //   for (const unProcessedTransaction of unProcessedTransactions) {
  //     try {
  //       console.log(`Processing transaction: ${unProcessedTransaction.id}`);
  //       await this.prisma.$transaction(async (modules) => {
  //         await modules.transactions.update({
  //           where: {
  //             id: unProcessedTransaction.id,
  //           },
  //           data: {
  //             is_processed: true,
  //             type: "paid",
  //           },
  //         });
  //         const orderId = unProcessedTransaction.tx_comment.split("=")[1];
  //         const order = await this.getOrder(
  //           orderId,
  //           unProcessedTransaction.hash,
  //         );
  //         const nftCollection = await modules.nFTCollection.findUnique({
  //           where: {
  //             address: order.nft_collection_address,
  //           },
  //         });
  //         // create nft in queue
  //         await modules.nFTItem.create({
  //           data: {
  //             collection_id: nftCollection.id,
  //             owner_address: unProcessedTransaction.src,
  //             state: "created",
  //             order_id: orderId,
  //             transactionsId: unProcessedTransaction.id,
  //             metadata_url: "empty",
  //           },
  //         });
  //         await this.updateOrder(orderId, {
  //           state: "mint_request",
  //           transaction_id: unProcessedTransaction.id,
  //         });
  //       });
  //       console.log(
  //         `Successfully processed transaction: ${unProcessedTransaction.id}`,
  //       );
  //     } catch (e) {
  //       console.error(
  //         `Error processing transaction ${unProcessedTransaction.id}:`,
  //         e,
  //       );
  //       try {
  //         const message = getErrorMessage(e);
  //         await this.prisma.transactions.update({
  //           data: {
  //             failed_reason: message,
  //             error_type: "internal_error",
  //             type: "failed",
  //           },
  //           where: {
  //             id: unProcessedTransaction.id,
  //           },
  //         });
  //         console.log(
  //           `Updated transaction ${unProcessedTransaction.id} as failed`,
  //         );
  //       } catch (error) {
  //         console.error("INTERNAL_ERROR: ", e);
  //       }
  //     }
  //   }
  //   console.log("Finished updateOrdersAndCreateNftMintRequests");
  // }
  // async sendMintRequest() {
  //   console.log("Starting sendMintRequest");
  //   try {
  //     const collectionAddressToNftItems =
  //       await this.prisma.nFTCollection.findMany({
  //         where: {
  //           items: {
  //             some: {
  //               state: {
  //                 in: ["mint_request", "created"],
  //               },
  //             },
  //           },
  //         },
  //         include: {
  //           items: {
  //             where: {
  //               state: { in: ["mint_request", "created"] },
  //             },
  //           },
  //         },
  //       });
  //     console.log(
  //       `Found ${collectionAddressToNftItems.length} collections with NFT items to process`,
  //     );
  //     // for each collection
  //     for (const {
  //       address: collectionAddress,
  //       items: collectionNftItems,
  //     } of collectionAddressToNftItems) {
  //       console.log(`Processing collection: ${collectionAddress}`);
  //       const isMintRequestExists = collectionNftItems.some(
  //         (nftItem) => nftItem.state == "mint_request",
  //       );
  //       if (!isMintRequestExists) {
  //         // TODO: better error handling for async
  //         const lastNftIndex = await NftCollection.getLastNftIndex(
  //           Address.parse(collectionAddress),
  //           OnTon.tonClient(),
  //         );
  //         const nftCollection = await this.prisma.nFTCollection.findUnique({
  //           where: {
  //             address: collectionAddress,
  //           },
  //           select: {
  //             item_meta_data: true,
  //           },
  //         });
  //         console.log("CONTRACT ADDRESS: ", collectionAddress, {
  //           lastNftIndex,
  //         });
  //         if (collectionAddress === null) continue;
  //         const metadata = {
  //           //@ts-ignore
  //           name: nftCollection.item_meta_data.name,
  //           //@ts-ignore
  //           description: nftCollection.item_meta_data.description,
  //           //@ts-ignore
  //           image_url: nftCollection.item_meta_data.image,
  //         };
  //         const participantsData: participantData[] = collectionNftItems.map(
  //           (nftItem, idx) => ({
  //             address: Address.parse(nftItem.owner_address),
  //             index: BigInt(lastNftIndex + 1 + idx),
  //             nft_id: nftItem.id,
  //             attributes: {
  //               order_id: nftItem.order_id,
  //             },
  //           }),
  //         );
  //         // update to mint_request
  //         // mint_request means the mint request has been sent but the nft is not yet verified
  //         const updateData = participantsData.map((item) => {
  //           return {
  //             where: {
  //               id: item.nft_id,
  //             },
  //             data: {
  //               index: Number(item.index),
  //               state: "mint_request",
  //             },
  //           } as Prisma.NFTItemUpdateArgs<DefaultArgs>;
  //         });
  //         for (const query of updateData) {
  //           await this.prisma.nFTItem.update(query);
  //         }
  //         console.log(
  //           `Sending mint request for collection: ${collectionAddress}`,
  //         );
  //         await this.nftService.mintItems(
  //           participantsData,
  //           Address.parse(collectionAddress),
  //           metadata,
  //         );
  //         console.log(`Mint request sent for collection: ${collectionAddress}`);
  //       } else {
  //         console.log(
  //           `Collection: ${collectionAddress} already has unprocessed mint request`,
  //         );
  //       }
  //     }
  //   } catch (e) {
  //     console.error("SEND_MINT_REQUEST_ERROR", e);
  //   }
  //   console.log("Finished sendMintRequest");
  //   this.checkMintRequestStatus();
  // }
  // async checkMintRequestStatus() {
  //   console.log("Starting checkMintRequestStatus");
  //   const collectionAddressToNftItems =
  //     await this.prisma.nFTCollection.findMany({
  //       where: {
  //         items: {
  //           some: {
  //             state: "mint_request",
  //           },
  //         },
  //       },
  //       include: {
  //         items: {
  //           where: {
  //             state: "mint_request",
  //           },
  //         },
  //       },
  //     });
  //   console.log(
  //     `Found ${collectionAddressToNftItems.length} collections with mint requests to check`,
  //   );
  //   for (const collection of collectionAddressToNftItems) {
  //     const { items: nftItems, address: collectionAddress } = collection;
  //     console.log(`Checking mint status for collection: ${collectionAddress}`);
  //     const updateDate = nftItems.map(async (item) => {
  //       try {
  //         console.log(
  //           `Checking NFT item: ${item.id} in collection: ${collectionAddress}`,
  //         );
  //         const nftResponse = await OnTon.getNftItem(
  //           collectionAddress,
  //           item.index,
  //         );
  //         if (nftResponse.nft_items.length) {
  //           const nftOnchainData = nftResponse.nft_items[0];
  //           console.log(
  //             `Found NFT item: ${item.id} in collection: ${collectionAddress}`,
  //           );
  //           console.log(`nft_onchain_data_${item.id}`, nftOnchainData);
  //           // get nft metadata
  //           const metadataRaw = await axios.get(nftOnchainData.content.uri);
  //           const orderId = metadataRaw.data?.attributes?.order_id;
  //           // if it was wrong order id we fail it
  //           if (orderId !== item.order_id) {
  //             console.error(
  //               `Wrong order id for NFT item: ${item.id} in collection: ${collectionAddress}`,
  //             );
  //             return {
  //               where: {
  //                 id: item.id,
  //               },
  //               data: {
  //                 state: "failed",
  //                 fail_reason: `wrong_order_id: ${item.index} collection: ${collectionAddress} axios request data: ${JSON.stringify(
  //                   metadataRaw.data,
  //                 )}
  //               nft_response: ${JSON.stringify(nftResponse)}`,
  //               },
  //             } as Prisma.NFTItemUpdateArgs<DefaultArgs>;
  //           }
  //           console.log(
  //             `NFT item: ${item.id} in collection: ${collectionAddress} was minted`,
  //           );
  //           return {
  //             where: {
  //               id: item.id,
  //             },
  //             data: {
  //               address: nftOnchainData.address,
  //               metadata_url: nftOnchainData.content.uri,
  //               state: "minted",
  //               order_id: item.order_id,
  //             },
  //           } as Prisma.NFTItemUpdateArgs<DefaultArgs>;
  //         } else {
  //           console.error(
  //             `NFT item: ${item.id} in collection: ${collectionAddress} not found`,
  //           );
  //           const shouldFail = item.try_count >= FAIL_NFT_ITEM_TRY_COUNT;
  //           if (shouldFail) {
  //             return {
  //               where: {
  //                 id: item.id,
  //               },
  //               data: {
  //                 state: "failed",
  //                 fail_reason: `nft_not_found: ${item.index} collection: ${collectionAddress}
  //               nft_response: ${JSON.stringify(nftResponse)}`,
  //               },
  //             } as Prisma.NFTItemUpdateArgs<DefaultArgs>;
  //           } else {
  //             console.log(
  //               `NFT item: ${item.id} in collection: ${collectionAddress} not found, trying again`,
  //             );
  //             return {
  //               where: {
  //                 id: item.id,
  //               },
  //               data: {
  //                 state: "mint_request",
  //                 try_count: {
  //                   increment: 1,
  //                 },
  //               },
  //             } as Prisma.NFTItemUpdateArgs<DefaultArgs>;
  //           }
  //         }
  //       } catch (error) {
  //         const message = getErrorMessage(error);
  //         console.log(`CHECK_MINT_REQUEST_STATUS_ERROR_${item.id}`, message);
  //         return {
  //           where: {
  //             id: item.id,
  //           },
  //           data: {
  //             state: "failed",
  //             fail_reason: `check_mint_request_status_error: ${item.index} collection: ${collectionAddress} message: ${message}`,
  //           },
  //         } as Prisma.NFTItemUpdateArgs<DefaultArgs>;
  //       }
  //     });
  //     for (const data of updateDate) {
  //       console.log(`Updating NFT data: ${JSON.stringify(await data)}`);
  //       try {
  //         await this.prisma.$transaction(async (modules) => {
  //           const awaitedData = await data;
  //           const nftData = await modules.nFTItem.update(awaitedData);
  //           if (nftData.state === "minted") {
  //             console.log(`NFT minted successfully: ${nftData.id}`);
  //             await this.updateOrder(nftData.order_id, {
  //               state: "minted",
  //               nft_address: nftData.address,
  //             });
  //             console.log(`Updated order ${nftData.order_id} to minted state`);
  //           }
  //         });
  //       } catch (error) {
  //         if (error instanceof AxiosError) {
  //           console.log(
  //             "update_order_error_",
  //             error?.message,
  //             error.response.status,
  //             error.response.data,
  //           );
  //         }
  //       }
  //     }
  //   }
  //   console.log("Finished checkMintRequestStatus");
  // }
  // @Interval(60_000)
  // async miniAppJobs() {
  //   return;
  //   // this api will trigger a check on all order to update their satates
  //   miniAppClient
  //     .patch(`/order`)
  //     .then(() => {})
  //     .catch(() => {
  //       console.error("updating dodders failed");
  //     });
  // }
  // async saveSuccessfulTransaction(
  //   transaction: Transaction,
  //   order: GetOrderResponse,
  //   comment: string,
  // ) {
  //   const existedTransaction = await this.prisma.transactions.findFirst({
  //     where: {
  //       hash: transaction.hash,
  //     },
  //   });
  //   if (!existedTransaction) {
  //     await this.prisma.transactions.create({
  //       data: {
  //         hash: transaction.hash,
  //         logical_time: BigInt(transaction.lt),
  //         src: transaction.in_msg.source,
  //         ticket_value: parseInt(order.total_price),
  //         value: parseInt(transaction.in_msg.value),
  //         type: "paid",
  //         tx_comment: comment,
  //         is_processed: false,
  //       },
  //     });
  //   }
  // }
  // async saveFailedTransaction(
  //   transaction: Transaction,
  //   order: GetOrderResponse | null,
  //   comment: string | null,
  //   failedReason: string,
  // ) {
  //   let existedTransaction = await this.prisma.transactions.findFirst({
  //     where: {
  //       hash: transaction.hash,
  //     },
  //   });
  //   if (!existedTransaction) {
  //     await this.prisma.transactions.create({
  //       data: {
  //         hash: transaction.hash,
  //         logical_time: BigInt(transaction.lt),
  //         src: transaction.in_msg.source,
  //         ticket_value: order ? parseInt(order.total_price) : 0,
  //         value: parseInt(transaction.in_msg.value),
  //         type: "failed",
  //         tx_comment: comment ? comment : "",
  //         failed_reason: failedReason,
  //         is_processed: true,
  //       },
  //     });
  //   }
  // }
  // private async getOrder(orderId: string, txId: string) {
  //   try {
  //     const order = await miniAppClient.get<GetOrderResponse>(
  //       `/order/${orderId}`,
  //     );
  //     return order.data;
  //   } catch (error) {
  //     if (error instanceof AxiosError && error.status === 404) {
  //       throw new ErrorWithData(
  //         `Order does not exist with uuid ${orderId} with txId: ${txId}`,
  //         "order_does_not_exist",
  //       );
  //     }
  //     throw error;
  //   }
  // }
  // private async updateOrder(
  //   orderId: string,
  //   data: {
  //     state: UpdateOrderState;
  //     transaction_id?: string;
  //     nft_address?: string;
  //   },
  // ) {
  //   await miniAppClient.patch(`/order/${orderId}`, data);
  // }
}
const timeout = (ms: number) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
  );
