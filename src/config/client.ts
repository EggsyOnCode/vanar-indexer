import { createPublicClient, http } from 'viem';

export const publicClient = createPublicClient({
  transport: http(process.env.VANAR_RPC)
});

export default publicClient; 