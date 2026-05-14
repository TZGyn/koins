CREATE TABLE `token_metadata` (
	`name` text,
	`symbol` text NOT NULL,
	`decimals` integer,
	`logo` text,
	`contractAddress` text NOT NULL,
	`chainId` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contract_unique` ON `token_metadata` (`chainId`,`contractAddress`);