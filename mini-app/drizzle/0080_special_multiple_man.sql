ALTER TYPE "nft_status_enum" ADD VALUE 'MINTING';--> statement-breakpoint
ALTER TABLE "nft_api_minter_wallets" ADD COLUMN "mnemonic" varchar(255) NOT NULL;