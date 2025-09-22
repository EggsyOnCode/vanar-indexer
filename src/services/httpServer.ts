import express from 'express';
import prisma from '../db/client.js';
import { logger } from '../config/logger.js';

export function createHttpServer() {
  const app = express();
  app.use(express.json());

  app.get('/erc20/:address', async (req, res) => {
    const address = req.params.address.toLowerCase();
    try {
      const items = await prisma.eRC20Transfer.findMany({
        where: { OR: [{ from: address }, { to: address }] },
        orderBy: { block: 'desc' },
        take: 100
      });
      res.json(items);
    } catch (err) {
      logger.error({ err }, 'error fetching erc20');
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.get('/erc721/:contract', async (req, res) => {
    const contract = req.params.contract.toLowerCase();
    try {
      const items = await prisma.eRC721Transfer.findMany({
        where: { contract },
        orderBy: { block: 'desc' },
        take: 100
      });
      res.json(items);
    } catch (err) {
      logger.error({ err }, 'error fetching erc721');
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.get('/erc1155/:contract', async (req, res) => {
    const contract = req.params.contract.toLowerCase();
    try {
      const items = await prisma.eRC1155Transfer.findMany({
        where: { contract },
        orderBy: { block: 'desc' },
        take: 100
      });
      res.json(items);
    } catch (err) {
      logger.error({ err }, 'error fetching erc1155');
      res.status(500).json({ error: 'internal_error' });
    }
  });

  // Query deployments by token standard (ERC20 | ERC721 | ERC1155)
  app.get('/deployments/type/:type', async (req, res) => {
    const rawType = req.params.type.toUpperCase();
    const allowed = new Set(['ERC20', 'ERC721', 'ERC1155']);
    if (!allowed.has(rawType)) {
      return res.status(400).json({ error: 'invalid_type', allowed: Array.from(allowed) });
    }
    try {
      const items = await prisma.contractDeployment.findMany({
        where: { tokenStandard: rawType },
        orderBy: { block: 'desc' },
        take: 100
      });
      res.json(items);
    } catch (err) {
      logger.error({ err }, 'error fetching deployments by type');
      res.status(500).json({ error: 'internal_error' });
    }
  });

  // Query deployments by contract address
  app.get('/deployments/:address', async (req, res) => {
    const address = req.params.address.toLowerCase();
    try {
      const item = await prisma.contractDeployment.findUnique({
        where: { contract: address }
      });
      if (!item) return res.status(404).json({ error: 'not_found' });
      res.json(item);
    } catch (err) {
      logger.error({ err }, 'error fetching deployment by address');
      res.status(500).json({ error: 'internal_error' });
    }
  });

  return app;
} 