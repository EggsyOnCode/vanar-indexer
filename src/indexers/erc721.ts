import { Log } from 'viem';
import prisma from '../db/client.js';

export async function indexErc721Transfer(log: Log, blockTimestamp: Date) {
  const [fromTopic, toTopic, tokenIdTopic] = [
    log.topics?.[1],
    log.topics?.[2],
    log.topics?.[3]
  ];
  const contract = log.address;
  await prisma.eRC721Transfer.create({
    data: {
      txHash: log.transactionHash!,
      block: Number(log.blockNumber!),
      from: fromTopic ? `0x${fromTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
      to: toTopic ? `0x${toTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
      tokenId: BigInt(tokenIdTopic ?? '0x0').toString(),
      contract,
      timestamp: blockTimestamp
    }
  });
} 