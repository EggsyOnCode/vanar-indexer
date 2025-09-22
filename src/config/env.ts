import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  VANAR_RPC: z.string().url(),
  POSTGRES_URL: z.string().url(),
  START_BLOCK: z.coerce.number().int().nonnegative(),
  END_BLOCK: z.coerce.number().int().nonnegative()
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse({
  VANAR_RPC: process.env.VANAR_RPC,
  POSTGRES_URL: process.env.POSTGRES_URL,
  START_BLOCK: process.env.START_BLOCK,
  END_BLOCK: process.env.END_BLOCK
}); 