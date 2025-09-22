import { createPublicClient, http, Log, getAbiItem } from 'viem';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import erc20 from '../contracts/abis/erc20.json' assert { type: 'json' };
import erc721 from '../contracts/abis/erc721.json' assert { type: 'json' };
import erc1155 from '../contracts/abis/erc1155.json' assert { type: 'json' };
import { indexErc20Transfer } from '../indexers/erc20.js';
import { indexErc721Transfer } from '../indexers/erc721.js';
import { indexErc1155Single } from '../indexers/erc1155.js';
import { decodeEventLog } from 'viem';

const client = createPublicClient({ transport: http(env.VANAR_RPC) });

export function startLiveWatcher() {
  logger.info('Starting live watcher');
  return client.watchBlocks({
    includeTransactions: false,
    onBlock: async (block) => {
      try {
        const logs = await client.getLogs({
          fromBlock: block.number,
          toBlock: block.number,
          events: [
            getAbiItem({ abi: erc20, name: 'Transfer' }),
            getAbiItem({ abi: erc721, name: 'Transfer' }),
            getAbiItem({ abi: erc1155, name: 'TransferSingle' }),
            getAbiItem({ abi: erc1155, name: 'TransferBatch' })
          ]
        });
        const ts = new Date(Number(block.timestamp) * 1000);
        for (const log of logs) {
          await handleLiveLog(log, ts);
        }
      } catch (err) {
        logger.error({ err }, 'Live watcher error');
      }
    },
    onError: (err) => logger.error({ err }, 'watchBlocks error')
  });
}

async function handleLiveLog(log: Log, ts: Date) {
  let eventName: string | undefined;
  
  try {
    // Try to decode with each ABI to determine event type
    if (log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
      // Transfer event signature
      if (log.data === '0x') {
        eventName = 'Transfer'; // ERC721
      } else {
        eventName = 'Transfer'; // ERC20
      }
    } else if (log.topics[0] === '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62') {
      eventName = 'TransferSingle'; // ERC1155
    } else if (log.topics[0] === '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb') {
      eventName = 'TransferBatch'; // ERC1155
    }
  } catch {
    return;
  }
  
  if (!eventName) return;
  if (eventName === 'Transfer' && log.data !== '0x') {
    await indexErc20Transfer(log, ts);
  } else if (eventName === 'Transfer' && log.data === '0x') {
    await indexErc721Transfer(log, ts);
  } else if (eventName === 'TransferSingle') {
    await indexErc1155Single(log, ts);
  } else if (eventName === 'TransferBatch') {
    // skip batch v1
  }
} 