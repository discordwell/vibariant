import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import ora from 'ora';
import { VibariantAPI } from './api.js';

const SERVER_DIR = join(homedir(), '.vibariant', 'server');

export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execa('docker', ['info'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function isApiReachable(apiUrl: string): Promise<boolean> {
  try {
    const api = new VibariantAPI(apiUrl);
    await api.health();
    return true;
  } catch {
    return false;
  }
}

export async function startBackend(apiUrl: string): Promise<void> {
  const spinner = ora('Starting Vibariant backend...').start();

  // Ensure server directory exists
  if (!existsSync(SERVER_DIR)) {
    mkdirSync(SERVER_DIR, { recursive: true });
  }

  // Write docker-compose.yml if missing (use inline template — file paths are unreliable after tsup bundling)
  const composePath = join(SERVER_DIR, 'docker-compose.yml');
  if (!existsSync(composePath)) {
    writeFileSync(composePath, DOCKER_COMPOSE_TEMPLATE);
  }

  // Generate .env if missing
  const envPath = join(SERVER_DIR, '.env');
  if (!existsSync(envPath)) {
    const secretKey = randomBytes(32).toString('base64url');
    const pgPassword = randomBytes(16).toString('base64url');
    writeFileSync(
      envPath,
      `POSTGRES_PASSWORD=${pgPassword}\nSECRET_KEY=${secretKey}\nAPI_PORT=8000\n`,
    );
  }

  // Start containers
  spinner.text = 'Pulling images and starting containers...';
  try {
    await execa('docker', ['compose', 'up', '-d'], { cwd: SERVER_DIR, timeout: 120_000 });
  } catch (err) {
    spinner.fail('Failed to start Docker containers.');
    throw err;
  }

  // Wait for health check
  spinner.text = 'Waiting for API to be ready...';
  const start = Date.now();
  const timeout = 60_000;
  while (Date.now() - start < timeout) {
    if (await isApiReachable(apiUrl)) {
      spinner.succeed('Backend is running.');
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  spinner.fail('Backend did not become healthy within 60s.');
  throw new Error('Backend startup timed out');
}

const DOCKER_COMPOSE_TEMPLATE = `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vibariant
      POSTGRES_USER: vibariant
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vibariant"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  api:
    build: ./api
    ports:
      - "\${API_PORT:-8000}:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://vibariant:\${POSTGRES_PASSWORD}@db:5432/vibariant
      SECRET_KEY: \${SECRET_KEY}
      CORS_ORIGINS: '["http://localhost:3000", "http://localhost:5173"]'
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgdata:
`;
