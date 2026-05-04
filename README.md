# KisaanChain

KisaanChain is a full-stack Ethereum traceability platform for crop supply chain management, built around the project report's layered architecture:

- User Layer
- Application Layer
- Backend Layer
- Blockchain Layer
- Supply Chain Layer

## Stack

- Frontend: Next.js + TypeScript
- Backend: Node.js + Express + Prisma + PostgreSQL
- Blockchain: Solidity + Hardhat + OpenZeppelin + Ethers.js
- Storage: local IPFS-style CID storage
- Auth: JWT + wallet linking
- QR: generation and browser-based verification flow

## Workspace

- `frontend` - Next.js application
- `backend` - Express API, Prisma schema, local storage and auth
- `contracts` - Solidity contracts, tests and deployment scripts

## Quick Start

1. Copy `.env.example` to `.env` and update values.
2. Start PostgreSQL with `docker compose up -d`.
3. Install dependencies with `npm install` from the repo root.
4. Configure `SEPOLIA_RPC_URL` and `PRIVATE_KEY` in `.env`.
5. Deploy contracts to Sepolia: `npm --prefix contracts run deploy:sepolia`
6. Run Prisma migrate and seed admin: `npm --prefix backend run prisma:migrate`
7. Start backend: `npm run dev:backend`
8. Start frontend: `npm run dev:frontend`

## Empty-by-Default

The application starts with no seeded business data. Users, farms, batches, certificates, transfers, escrow records and QR verification entries are created through real flows in the UI and API.
