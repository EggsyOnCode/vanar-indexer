# VanarChain Indexer

A high-performance blockchain indexer for VanarChain that tracks ERC20, ERC721, and ERC1155 token transfers and contract deployments.

## Features

- **Token Transfer Tracking**: Indexes all ERC20, ERC721, and ERC1155 transfer events
- **Contract Deployment Detection**: Automatically detects and indexes token contract deployments
- **Real-time Monitoring**: Live watcher for new events as they happen
- **Historical Scanning**: Batch processing of historical blocks
- **REST API**: Query endpoints for transfers and deployments
- **Performance Optimized**: Batch database operations and parallel processing

## Requirements

- Node.js 18+
- PostgreSQL 14+

## Quick Setup

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd vanar-indexer
npm install
```

2. **Environment setup:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Database setup:**
```bash
npm run prisma:generate
npm run prisma:migrate
```

4. **Start development server:**
```bash
npm run dev
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Required
VANAR_RPC=https://your-vanar-rpc-endpoint
POSTGRES_URL=postgresql://username:password@localhost:5432/database_name
START_BLOCK=12345678
END_BLOCK=12345679

# Optional
PORT=3000
LOG_LEVEL=info
NODE_ENV=development
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:deploy` - Deploy migrations to production

## Codebase Structure

### Core Files

- **`src/server.ts`** - Main application entry point, starts HTTP server and indexers

### Configuration (`src/config/`)

- **`env.ts`** - Environment variable validation and configuration
- **`logger.ts`** - Pino logger setup with pretty printing for development
- **`client.ts`** - Viem blockchain client configuration

### Database (`src/db/`)

- **`client.ts`** - Prisma database client singleton

### Services (`src/services/`)

- **`httpServer.ts`** - Express REST API server with endpoints for querying data
- **`blockScanner.ts`** - Historical block scanning service with batch processing
- **`liveWatcher.ts`** - Real-time event monitoring via blockchain subscription

### Indexers (`src/indexers/`)

- **`erc20.ts`** - ERC20 transfer event indexing logic
- **`erc721.ts`** - ERC721 transfer event indexing logic  
- **`erc1155.ts`** - ERC1155 transfer event indexing logic
- **`deployment.ts`** - Contract deployment detection and indexing with token standard detection

### Contracts (`src/contracts/abis/`)

- **`erc20.json`** - ERC20 contract ABI for event decoding
- **`erc721.json`** - ERC721 contract ABI for event decoding
- **`erc1155.json`** - ERC1155 contract ABI for event decoding

## API Endpoints

### Transfer Queries

- `GET /erc20/:address` - Get ERC20 transfers for an address (from/to)
- `GET /erc721/:contract` - Get ERC721 transfers for a contract
- `GET /erc1155/:contract` - Get ERC1155 transfers for a contract

### Deployment Queries

- `GET /deployments/type/:type` - Get deployments by token standard (ERC20|ERC721|ERC1155)
- `GET /deployments/:address` - Get deployment info for a specific contract address

## How It Works

### 1. Historical Scanning
- Scans blocks from `START_BLOCK` to `END_BLOCK`
- Fetches blocks in parallel for performance
- Detects contract deployments by checking for creation transactions
- Indexes transfer events using contract ABIs
- Uses batch database operations for efficiency

### 2. Live Monitoring
- Subscribes to new blocks via polling
- Processes new events in real-time
- Maintains same indexing logic as historical scanner

### 3. Token Detection
- Uses ERC165 `supportsInterface` for ERC721/ERC1155 detection
- Uses `totalSupply()` call for ERC20 detection
- Only indexes contracts that are confirmed token contracts

### 4. Performance Optimizations
- Batch database inserts using `createMany()`
- Parallel block fetching
- Parallel token standard detection
- Efficient log filtering by event signatures

## Database Schema

### Tables

- **`ERC20Transfer`** - ERC20 transfer events
- **`ERC721Transfer`** - ERC721 transfer events  
- **`ERC1155Transfer`** - ERC1155 transfer events
- **`ContractDeployment`** - Token contract deployments with standard detection

### Indexes

All tables have indexes on commonly queried fields:
- Transaction hash
- Block number
- Address fields (from/to/contract)
- Token standard (for deployments)

## Development

### Prisma Studio
```bash
npx prisma studio
```
Opens database browser at http://localhost:5555

### Database Reset
```bash
npx prisma migrate reset
```
⚠️ **Warning**: This will delete all data

### Production Deployment
```bash
npm run build
npm run prisma:deploy
npm start
```

## Monitoring

The indexer provides detailed logging:
- Block processing progress
- Event counts per batch
- Error handling with context
- Performance metrics

Check logs for:
- `Token deployments processed: count: X`
- `Logs fetched: count: X`
- Any error messages with full context

## Troubleshooting

### Common Issues

1. **"Event not found on ABI"** - Ensure ABI files are properly imported
2. **"Table does not exist"** - Run `npm run prisma:migrate`
3. **Slow performance** - Check database indexes and batch sizes
4. **Missing deployments** - Verify token detection logic and RPC connectivity

### Performance Tuning

- Adjust `batchSize` in `scanBlocks()` for memory vs speed tradeoff
- Monitor database connection pool size
- Consider using connection pooling for high-volume indexing 