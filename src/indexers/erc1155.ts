import { Log } from 'viem';
import prisma from '../db/client.js';

export async function indexErc1155Single(log: Log, blockTimestamp: Date) {
  const [operatorTopic, fromTopic, toTopic] = [
    log.topics?.[1],
    log.topics?.[2],
    log.topics?.[3]
  ];
  const data = log.data as `0x${string}`;
  // data contains id (32) + value (32)
  const idHex = `0x${data.slice(2, 66)}`;
  const valueHex = `0x${data.slice(66)}`;
  await prisma.eRC1155Transfer.create({
    data: {
      txHash: log.transactionHash!,
      block: Number(log.blockNumber!),
      operator: operatorTopic ? `0x${operatorTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
      from: fromTopic ? `0x${fromTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
      to: toTopic ? `0x${toTopic.slice(-40)}` : '0x0000000000000000000000000000000000000000',
      tokenId: BigInt(idHex).toString(),
      value: BigInt(valueHex).toString(),
      contract: log.address,
      timestamp: blockTimestamp
    }
  });
}

export async function indexErc1155Batch(log: Log, blockTimestamp: Date) {
  const [operatorTopic, fromTopic, toTopic] = [
    log.topics?.[1],
    log.topics?.[2],
    log.topics?.[3]
  ];
  const data = log.data as `0x${string}`;
  // dynamic arrays: offset encoding; for simplicity, skip complex decoding and do a best-effort minimal decode using viem later. Here we fallback to no-op.
  // This function is a placeholder; batch events will be handled by viem decode in scanner.
  return;
} 