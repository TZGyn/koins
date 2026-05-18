# Koins

Multi-chain desktop wallet for **Ethereum**, **BSC**, **Polygon**, and **Monero**. Built with [Bun](https://bun.sh) + [Electrobun](https://electrobun.dev) + Svelte.

## Features

- **Multi-coin mode**: ETH, BSC, Polygon wallet with seed phrase vault stored in system keychain
- **Monero mode**: Self-contained Monero wallet — auto-downloads `monero-wallet-rpc` binary on first launch, no manual binary install
- **Touch ID unlock**: Biometric auth via Swift helper, no node-gyp or FFI dylib
- **Password fallback**: PBKDF2-salted password stored in keychain, used when biometric is unavailable
- **QR codes**: Address QR with chain logo overlay
- **Transaction history**: Cached in local SQLite via Drizzle ORM
- **Settings**: Reset app clears all DB tables and keychain entries

## Prerequisites

- [Bun](https://bun.sh) 1.2+
- macOS (Electrobun currently requires macOS)

## Getting Started

```bash
bun install
cd apps/desktop
bun run dev
```

## Architecture

```
apps/desktop/
├── src/
│   ├── bun/                    # Backend (Electrobun main process)
│   │   ├── index.ts            # RPC handlers
│   │   ├── lib/
│   │   │   ├── monero/         # Monero RPC management
│   │   │   │   ├── binary.ts   # Download/extract monero-wallet-rpc
│   │   │   │   └── wallet.ts   # Child process + RPC client
│   │   │   ├── alchemy/        # Alchemy API calls
│   │   │   ├── viem/           # viem chain calls
│   │   │   ├── tokens/         # Token metadata (DB-first cache)
│   │   │   ├── transactions/   # Tx history + details (DB-first cache)
│   │   │   ├── db/             # Drizzle ORM + SQLite schema
│   │   │   └── biometric.ts    # Biometric auth (Swift subprocess)
│   │   └── native/
│   │       └── biometric-helper.swift  # Touch ID prompt binary
│   ├── lib/
│   │   ├── states/
│   │   │   └── wallet.svelte.ts        # Wallet state (singleton)
│   │   ├── components/
│   │   │   └── EvmDashboard.svelte     # Shared EVM dashboard
│   │   └── electrobun.ts               # RPC type definitions
│   └── routes/
│       ├── index.svelte       # Login/welcome page
│       ├── multicoin/         # ETH / BSC / Polygon routes
│       ├── monero/            # Monero dashboard
│       ├── settings.svelte    # App settings
│       └── tx/                # Transaction details
└── package.json
```

## Key Decisions

- **Monero via RPC, not WASM**: `monero-ts`'s WASM wallet (`MoneroWalletFull`) doesn't work in Bun because the C++ HTTP client fails at runtime. Instead, `monero-wallet-rpc` runs as a child process.
- **SQLite cache**: All chain data (tx history, receipts, token metadata) cached in SQLite via Drizzle, not localStorage.
- **Biometric auth**: Uses a Swift binary spawned via `Bun.spawnSync()` (not `dlopen` — Bun crashes on ObjC runtime; not `node-mac-auth` — fragile node-gyp chain).
- **Separate account types**: Multi Coins and Monero are separate account types with their own seed formats and auth flows.

## Dependencies

- [Ethers](https://docs.ethers.org) — EVM wallet operations
- [Viem](https://viem.sh) — EVM chain RPC calls
- [monero-ts](https://github.com/woodser/monero-ts) — Monero RPC client
- [Drizzle ORM](https://orm.drizzle.team) — SQLite schema + queries
- [Svelte 5](https://svelte.dev) — UI framework
- [Electrobun](https://electrobun.dev) — Desktop app shell
- [sv-router](https://github.com/TZGyn/sv-router) — File-based routing
- [Lucide](https://lucide.dev) — Icons
- [QRCode](https://github.com/soldair/node-qrcode) — QR code generation

## Scripts

```bash
bun run dev       # Start development server
bun run db:push   # Push Drizzle schema to SQLite
```
