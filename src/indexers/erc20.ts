import { Log } from 'viem';
import prisma from '../db/client.js';

export async function indexErc20Transfer(log: Log, blockTimestamp: Date) {
  const [from, to, value] = [
    log.topics?.[1],
    log.topics?.[2],
    log.data
  ];
  await prisma.eRC20Transfer.create({
    data: {
      txHash: log.transactionHash!,
      block: Number(log.blockNumber!),
      from: from ? `0x${from.slice(-40)}` : '0x0000000000000000000000000000000000000000',
      to: to ? `0x${to.slice(-40)}` : '0x0000000000000000000000000000000000000000',
      value: BigInt(value as string).toString(),
      timestamp: blockTimestamp
    }
  });
} 