import { createPublicClient, http, isAddress } from 'viem';
import prisma from '../db/client.js';
import { env } from '../config/env.js';

const client = createPublicClient({ transport: http(env.VANAR_RPC) });

// ERC20/ERC721/ERC1155 function selectors for detection
const TOKEN_SELECTORS = {
  ERC20: [
    '0x70a08231', // balanceOf(address)
    '0xa9059cbb', // transfer(address,uint256)
    '0x18160ddd', // totalSupply()
    '0x8c5be1e5', // approve(address,uint256)
  ],
  ERC721: [
    '0x70a08231', // balanceOf(address)
    '0x6352211e', // ownerOf(uint256)
    '0x42842e0e', // safeTransferFrom(address,address,uint256)
    '0x081812fc', // getApproved(uint256)
  ],
  ERC1155: [
    '0x00fdd58e', // balanceOf(address,uint256)
    '0xf242432a', // safeTransferFrom(address,address,uint256,uint256,bytes)
    '0x2eb2c2d6', // safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)
    '0x4e1273f4', // setApprovalForAll(address,bool)
  ]
};

async function detectTokenStandard(address: string): Promise<'ERC20' | 'ERC721' | 'ERC1155' | null> {
  if (!isAddress(address)) return null;

  // ERC165 supportsInterface
  const ERC165_ABI = [{ "inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}], "name":"supportsInterface", "outputs":[{"internalType":"bool","name":"","type":"bool"}], "stateMutability":"view", "type":"function" }];
  const ERC721_ID = '0x80ac58cd';
  const ERC1155_ID = '0xd9b67a26';

  try {
    const is721 = await client.readContract({ address: address as `0x${string}`, abi: ERC165_ABI, functionName: 'supportsInterface', args: [ERC721_ID] });
    if (is721) return 'ERC721';
  } catch {}

  try {
    const is1155 = await client.readContract({ address: address as `0x${string}`, abi: ERC165_ABI, functionName: 'supportsInterface', args: [ERC1155_ID] });
    if (is1155) return 'ERC1155';
  } catch {}

  const ERC20_ABI = [{ "name":"totalSupply", "outputs":[{"type":"uint256"}], "stateMutability":"view", "type":"function", "inputs":[] }];
  try {
    await client.readContract({ address: address as `0x${string}`, abi: ERC20_ABI, functionName: 'totalSupply' });
    return 'ERC20';
  } catch {}

  return null;
}

export async function indexContractDeployment(
  txHash: string,
  blockNumber: bigint,
  contractAddress: string,
  deployer: string,
  bytecode: string | undefined,
  blockTimestamp: Date
) {
  // Detect token standard
  const tokenStandard = await detectTokenStandard(contractAddress);
  
  // Only index if it's a token contract
  if (!tokenStandard) return;

  await prisma.contractDeployment.create({
    data: {
      txHash,
      block: Number(blockNumber),
      contract: contractAddress,
      deployer,
      bytecode,
      tokenStandard,
      timestamp: blockTimestamp
    }
  });
}

// Batch processing for better performance
export async function batchIndexDeployments(deployments: Array<{
  txHash: string;
  blockNumber: bigint;
  contractAddress: string;
  deployer: string;
  bytecode: string | undefined;
  blockTimestamp: Date;
}>) {
  const validDeployments = [];
  
  // Process in parallel to detect token standards
  const detectionPromises = deployments.map(async (deployment) => {
    const tokenStandard = await detectTokenStandard(deployment.contractAddress);
    if (tokenStandard) {
      return {
        ...deployment,
        tokenStandard
      };
    }
    return null;
  });
  
  const results = await Promise.all(detectionPromises);
  const validResults = results.filter((d): d is NonNullable<typeof d> => d !== null);
  
  if (validResults.length === 0) {
    return;
  }
  await prisma.contractDeployment.createMany({
    data: validResults.map(d => ({
      txHash: d.txHash,
      block: Number(d.blockNumber),
      contract: d.contractAddress,
      deployer: d.deployer,
      bytecode: d.bytecode,
      tokenStandard: d.tokenStandard,
      timestamp: d.blockTimestamp
    })),
    skipDuplicates: true
  });
} 