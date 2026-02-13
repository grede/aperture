import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { deviceManager } from '../core/device-manager.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Web server for recorder and preview UI (US-020, US-021)
 */
export class WebServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(express.json());

    // Serve static frontend files
    const frontendDir = path.join(__dirname, 'frontend');
    this.app.use(express.static(frontendDir));

    // Logging middleware
    this.app.use((req, _res, next) => {
      logger.debug({ method: req.method, path: req.path }, 'HTTP request');
      next();
    });
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // List devices
    this.app.get('/api/devices', async (_req, res) => {
      try {
        const devices = await deviceManager.listDevices();
        res.json({ devices });
      } catch (error) {
        logger.error({ error }, 'Failed to list devices');
        res.status(500).json({ error: 'Failed to list devices' });
      }
    });

    // Get booted devices
    this.app.get('/api/devices/booted', async (_req, res) => {
      try {
        const devices = await deviceManager.getBootedDevices();
        res.json({ devices });
      } catch (error) {
        logger.error({ error }, 'Failed to get booted devices');
        res.status(500).json({ error: 'Failed to get booted devices' });
      }
    });

    // Serve recorder UI
    this.app.get('/recorder', (_req, res) => {
      res.sendFile(path.join(__dirname, 'frontend', 'recorder.html'));
    });

    // Serve preview UI
    this.app.get('/preview', (_req, res) => {
      res.sendFile(path.join(__dirname, 'frontend', 'preview.html'));
    });

    // Fallback to index
    this.app.get('/', (_req, res) => {
      res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    });
  }

  /**
   * Setup WebSocket handlers
   */
  private setupWebSocket(): void {
    this.wss.on('connection', (ws, req) => {
      logger.info({ path: req.url }, 'WebSocket connection established');

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          logger.debug({ type: message.type }, 'WebSocket message received');

          switch (message.type) {
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              break;

            case 'start_stream':
              // TODO: Start Simulator screen streaming
              ws.send(JSON.stringify({ type: 'stream_started' }));
              break;

            case 'stop_stream':
              // TODO: Stop Simulator screen streaming
              ws.send(JSON.stringify({ type: 'stream_stopped' }));
              break;

            case 'tap':
              // TODO: Forward tap to Simulator
              logger.info({ x: message.x, y: message.y }, 'Tap event');
              break;

            case 'type':
              // TODO: Forward typing to Simulator
              logger.info({ text: message.text }, 'Type event');
              break;

            default:
              logger.warn({ type: message.type }, 'Unknown message type');
          }
        } catch (error) {
          logger.error({ error }, 'Failed to handle WebSocket message');
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error({ error }, 'WebSocket error');
      });
    });
  }

  /**
   * Start the web server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.info({ port: this.port }, 'Web server started');
        console.log(`Web server running at http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          logger.info('Web server stopped');
          resolve();
        });
      });
    });
  }
}

export const webServer = new WebServer();
