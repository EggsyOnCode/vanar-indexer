import { Abi, createPublicClient, getAbiItem, Hex, http, Log, getContractAddress } from 'viem';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import prisma from '../db/client.js';
import erc20 from '../contracts/abis/erc20.json' assert { type: 'json' };
import erc721 from '../contracts/abis/erc721.json' assert { type: 'json' };
import erc1155 from '../contracts/abis/erc1155.json' assert { type: 'json' };
import { indexErc20Transfer } from '../indexers/erc20.js';
import { indexErc721Transfer } from '../indexers/erc721.js';
import { indexErc1155Single } from '../indexers/erc1155.js';
import { indexContractDeployment, batchIndexDeployments } from '../indexers/deployment.js';

const client = createPublicClient({
  transport: http(env.VANAR_RPC)
});

const TRANSFER_SIGS = {
  erc20: { abi: erc20 as Abi, eventName: 'Transfer' },
  erc721: { abi: erc721 as Abi, eventName: 'Transfer' },
  erc1155Single: { abi: erc1155 as Abi, eventName: 'TransferSingle' },
  erc1155Batch: { abi: erc1155 as Abi, eventName: 'TransferBatch' }
} as const;

export async function scanBlocks(batchSize = 2000) {
  const start = env.START_BLOCK;
  const end = env.END_BLOCK;
  logger.info({ start, end }, 'Starting block scan');
  
  for (let fromBlock = BigInt(start); fromBlock <= BigInt(end); fromBlock += BigInt(batchSize)) {
    const toBlock = (fromBlock + BigInt(batchSize) - 1n) > BigInt(end) ? BigInt(end) : (fromBlock + BigInt(batchSize) - 1n);
    logger.info({ fromBlock: Number(fromBlock), toBlock: Number(toBlock) }, 'Fetching logs batch');
    
    try {
      // Process blocks for contract deployments (batch)
      const deployments: Array<{
        txHash: string;
        blockNumber: bigint;
        contractAddress: string;
        deployer: string;
        bytecode: string | undefined;
        blockTimestamp: Date;
      }> = [];
      
      // Fetch all blocks in parallel
      const blockPromises = [];
      for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        blockPromises.push(client.getBlock({ blockNumber: blockNum, includeTransactions: true }));
      }
      
      const fetchedBlocks = await Promise.all(blockPromises);
      
      // Process deployments
      for (let i = 0; i < fetchedBlocks.length; i++) {
        const block = fetchedBlocks[i];
        if (!block) continue;
        
        const blockNum = fromBlock + BigInt(i);
        const ts = new Date(Number(block.timestamp) * 1000);
        
        for (const tx of block.transactions) {
          if (tx.to === null && tx.input && tx.input !== '0x') {
            const contractAddress = getContractAddress({
              from: tx.from,
              nonce: BigInt(tx.nonce)
            });
            
            deployments.push({
              txHash: tx.hash,
              blockNumber: blockNum,
              contractAddress,
              deployer: tx.from,
              bytecode: tx.input,
              blockTimestamp: ts
            });
          }
        }
      }
      
      // Batch process deployments
      if (deployments.length > 0) {
        await batchIndexDeployments(deployments);
        logger.info({ count: deployments.length }, 'Token deployments processed');
      }
      
      // Process transfer logs in parallel
      const logs = await client.getLogs({
        fromBlock,
        toBlock,
        events: [
          getAbiItem({ abi: erc20, name: 'Transfer' }),
          getAbiItem({ abi: erc721, name: 'Transfer' }),
          getAbiItem({ abi: erc1155, name: 'TransferSingle' }),
          getAbiItem({ abi: erc1155, name: 'TransferBatch' })
        ]
      });
      
      logger.info({ count: logs.length }, 'Logs fetched');
      
      // Batch process transfers
      await batchProcessTransfers(logs, fetchedBlocks);
      
    } catch (err) {
      logger.error({ err }, 'Error fetching logs');
    }
  }
  logger.info('Block scan complete');
}

async function batchProcessTransfers(logs: Log[], blocks: any[]) {
  const erc20Transfers = [];
  const erc721Transfers = [];
  const erc1155Transfers = [];
  
  for (const log of logs) {
    const block = blocks.find(b => b.number === log.blockNumber);
    const ts = new Date(Number(block.timestamp) * 1000);
    
    if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
      if (log.data !== '0x') {
        // ERC20
        const [from, to, value] = [log.topics?.[1], log.topics?.[2], log.data];
        erc20Transfers.push({
          txHash: log.transactionHash!,
          block: Number(log.blockNumber!),
          from: from ? `0x${from.slice(-40)}` : '0x0000000000000000000000000000000000000000',
          to: to ? `0x${to.slice(-40)}` : '0x0000000000000000000000000000000000000000',
          value: BigInt(value as string).toString(),
          timestamp: ts
        });
      } else {
        // ERC721
        const [fromTopic, toTopic, tokenIdTopic] = [log.topics?.[1], log.topics?.[2], log.topics?.[3]];
        erc721Transfers.push({
          txHash: log.transactionHash!,
          block: Number(log.blockNumber!),
          from: fromTopic ? `0x${fromTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
          to: toTopic ? `0x${toTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
          tokenId: BigInt(tokenIdTopic ?? '0x0').toString(),
          contract: log.address,
          timestamp: ts
        });
      }
    } else if (log.topics[0] === '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62') {
      // ERC1155
      const [operatorTopic, fromTopic, toTopic] = [log.topics?.[1], log.topics?.[2], log.topics?.[3]];
      const data = log.data as `0x${string}`;
      const idHex = `0x${data.slice(2, 66)}`;
      const valueHex = `0x${data.slice(66)}`;
      erc1155Transfers.push({
        txHash: log.transactionHash!,
        block: Number(log.blockNumber!),
        operator: operatorTopic ? `0x${operatorTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
        from: fromTopic ? `0x${fromTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
        to: toTopic ? `0x${toTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
        tokenId: BigInt(idHex).toString(),
        value: BigInt(valueHex).toString(),
        contract: log.address,
        timestamp: ts
      });
    }
  }
  
  // Batch insert all transfers
  const promises = [];
  if (erc20Transfers.length > 0) {
    promises.push(prisma.eRC20Transfer.createMany({ data: erc20Transfers }));
  }
  if (erc721Transfers.length > 0) {
    promises.push(prisma.eRC721Transfer.createMany({ data: erc721Transfers }));
  }
  if (erc1155Transfers.length > 0) {
    promises.push(prisma.eRC1155Transfer.createMany({ data: erc1155Transfers }));
  }
  
  await Promise.all(promises);
}

async function handleLog(log: Log, ts: Date) {
  try {
    // Determine event type by topic signature
    let eventName: string | undefined;
    if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
      eventName = 'Transfer';
    } else if (log.topics[0] === '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62') {
      eventName = 'TransferSingle';
    } else if (log.topics[0] === '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb') {
      eventName = 'TransferBatch';
    }
    
    if (!eventName) return;
    if (eventName === 'Transfer' && log.data !== '0x') {
      await indexErc20Transfer(log, ts);
      return;
    }
    if (eventName === 'Transfer' && log.data === '0x') {
      await indexErc721Transfer(log, ts);
      return;
    }
    if (eventName === 'TransferSingle') {
      await indexErc1155Single(log, ts);
      return;
    }
    if (eventName === 'TransferBatch') {
      // TODO: decode and insert each pair; skipping for v1
      return;
    }
  } catch (err) {
    logger.error({ err, log }, 'Error handling log');
  }
} 