# Koins

Desktop wallet for **Monero** and **XRP**. Built with [Bun](https://bun.sh) + [Electrobun](https://electrobun.dev) + Svelte.

## Features

- **Monero mode**: Self-contained Monero wallet — auto-downloads `monero-wallet-rpc` binary on first launch, no manual binary install
- **XRP mode**: XRP Ledger wallet — generate or import XRP seeds, send payments with optional destination tags
- **Touch ID unlock**: Biometric auth via Swift helper, no node-gyp or FFI dylib
- **Password fallback**: PBKDF2-salted password stored in keychain, used when biometric is unavailable
- **QR codes**: Address QR with chain logo overlay
- **Transaction history**: Live XRP ledger transactions and Monero wallet transactions
- **Settings**: Reset app clears all keychain entries

## Prerequisites

- [Bun](https://bun.sh) 1.2+

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
│   │   │   ├── xrp/            # XRP Ledger client (xrpl)
│   │   │   └── biometric.ts    # Biometric auth (Swift subprocess)
│   │   ├── rpc/
│   │   │   ├── monero/         # Monero RPC handlers
│   │   │   └── xrp/            # XRP RPC handlers
│   │   └── native/
│   │       └── biometric-helper.swift  # Touch ID prompt binary
│   ├── lib/
│   │   ├── states/
│   │   │   ├── monero-wallet.svelte.ts # Monero wallet state (singleton)
│   │   │   └── xrp-wallet.svelte.ts    # XRP wallet state (singleton)
│   │   └── electrobun.ts               # RPC type definitions
│   └── routes/
│       ├── index.svelte       # Login/welcome page
│       ├── monero/            # Monero routes
│       ├── xrp/               # XRP routes
│       └── settings.svelte    # App settings
└── package.json
```

## Key Decisions

- **Monero via RPC, not WASM**: `monero-ts`'s WASM wallet (`MoneroWalletFull`) doesn't work in Bun because the C++ HTTP client fails at runtime. Instead, `monero-wallet-rpc` runs as a child process.
- **XRP via xrpl**: Uses the official `xrpl` library over the public `wss://s1.ripple.com` WebSocket server. XRP seeds are stored in the system keychain.
- **Keychain storage**: Wallet seeds and metadata are stored in the macOS keychain via `Bun.secrets`, not a local database.
- **Biometric auth**: Uses a Swift binary spawned via `Bun.spawnSync()` (not `dlopen` — Bun crashes on ObjC runtime; not `node-mac-auth` — fragile node-gyp chain).
- **Separate account types**: Monero and XRP are separate account types with their own seed formats and auth flows.

## Dependencies

- [xrpl](https://github.com/XRPLF/xrpl.js) — XRP Ledger client
- [monero-ts](https://github.com/woodser/monero-ts) — Monero RPC client
- [Svelte 5](https://svelte.dev) — UI framework
- [Electrobun](https://electrobun.dev) — Desktop app shell
- [sv-router](https://github.com/TZGyn/sv-router) — File-based routing
- [Lucide](https://lucide.dev) — Icons
- [QRCode](https://github.com/soldair/node-qrcode) — QR code generation

## Scripts

```bash
bun run dev       # Start development server
```
