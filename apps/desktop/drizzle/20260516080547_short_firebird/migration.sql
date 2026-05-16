CREATE TABLE `transaction_receipts` (
	`transactionHash` text NOT NULL,
	`chainId` text NOT NULL,
	`blockHash` text NOT NULL,
	`blockNumber` text NOT NULL,
	`from` text NOT NULL,
	`to` text,
	`cumulativeGasUsed` text NOT NULL,
	`gasUsed` text NOT NULL,
	`status` text NOT NULL,
	`effectiveGasPrice` text,
	`contractAddress` text,
	`type` text NOT NULL,
	`transactionIndex` integer NOT NULL,
	`logsBloom` text
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`hash` text NOT NULL,
	`chainId` text NOT NULL,
	`from` text NOT NULL,
	`to` text,
	`value` text NOT NULL,
	`blockNumber` text,
	`blockHash` text,
	`gas` text NOT NULL,
	`gasPrice` text,
	`maxFeePerGas` text,
	`maxPriorityFeePerGas` text,
	`input` text NOT NULL,
	`nonce` integer NOT NULL,
	`transactionIndex` integer,
	`type` text,
	`v` text,
	`r` text,
	`s` text,
	`yParity` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_unique` ON `transaction_receipts` (`chainId`,`transactionHash`);--> statement-breakpoint
CREATE UNIQUE INDEX `tx_unique` ON `transactions` (`chainId`,`hash`);