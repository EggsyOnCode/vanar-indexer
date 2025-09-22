import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { scanBlocks } from './services/blockScanner.js';
import { startLiveWatcher } from './services/liveWatcher.js';
import { createHttpServer } from './services/httpServer.js';

const app = createHttpServer();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.get('/', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'MCP server listening');
});

// Kick off block scan and live watcher
scanBlocks().catch((e) => logger.error({ e }, 'scanBlocks failed'));
startLiveWatcher(); 