import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import puppeteer from 'puppeteer';

const SNAPSHOT_STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'domain-snapshots');
const MAX_SNAPSHOTS_PER_DOMAIN = 5;

function summarizeSnapshotFailure(error) {
  const message = (error?.message || '').toLowerCase();
  if (message.includes('could not find chrome')) {
    return 'Web snapshot engine is not available on this server. Ask an admin to install the Puppeteer Chrome runtime.';
  }
  if (message.includes('err_name_not_resolved') || message.includes('dns')) {
    return 'Domain did not resolve during snapshot attempt.';
  }
  if (message.includes('err_connection_refused') || message.includes('err_connection_reset')) {
    return 'Web server refused the connection during snapshot attempt.';
  }
  if (message.includes('timeout')) {
    return 'Snapshot timed out while waiting for the page to load.';
  }
  return 'Web snapshot failed due to navigation/runtime error.';
}

function sanitizeForPath(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.replace('::ffff:', '');
    return isPrivateIpv4(v4);
  }
  return false;
}

async function assertPublicDnsResolution(domainName) {
  const records = await dns.lookup(domainName, { all: true, verbatim: true });
  if (!records || records.length === 0) {
    throw new Error('Domain did not resolve to an IP address');
  }

  for (const record of records) {
    if (record.family === 4 && isPrivateIpv4(record.address)) {
      throw new Error('Snapshot blocked: domain resolves to private or loopback network');
    }
    if (record.family === 6 && isPrivateIpv6(record.address)) {
      throw new Error('Snapshot blocked: domain resolves to private or loopback network');
    }
  }
}

async function captureScreenshot(url, screenshotAbsolutePath) {
  let browser;
  const startedAt = performance.now();

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(15000);
    await page.setViewport({ width: 1440, height: 900 });

    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    await page.screenshot({
      path: screenshotAbsolutePath,
      fullPage: true,
    });

    return {
      finalUrl: page.url(),
      statusCode: response?.status() ?? null,
      title: await page.title(),
      loadTimeMs: Math.round(performance.now() - startedAt),
      error: null,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function runDomainWebSnapshot(domainName, domainId) {
  await assertPublicDnsResolution(domainName);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const domainDir = path.join(SNAPSHOT_STORAGE_ROOT, domainId);
  await fs.mkdir(domainDir, { recursive: true });

  const fileName = `${timestamp}-${sanitizeForPath(domainName)}.png`;
  const screenshotAbsolutePath = path.join(domainDir, fileName);
  const screenshotPath = `/storage/domain-snapshots/${domainId}/${fileName}`;
  const httpsUrl = `https://${domainName}`;
  const httpUrl = `http://${domainName}`;

  try {
    const capture = await captureScreenshot(httpsUrl, screenshotAbsolutePath);
    return {
      urlAttempted: httpsUrl,
      usedHttpFallback: false,
      screenshotPath,
      ...capture,
    };
  } catch (httpsError) {
    try {
      const capture = await captureScreenshot(httpUrl, screenshotAbsolutePath);
      return {
        urlAttempted: httpsUrl,
        usedHttpFallback: true,
        screenshotPath,
        ...capture,
      };
    } catch (httpError) {
      await fs.rm(screenshotAbsolutePath, { force: true });
      const internalError = `HTTPS failed: ${httpsError.message}; HTTP fallback failed: ${httpError.message}`;
      return {
        urlAttempted: httpsUrl,
        usedHttpFallback: true,
        finalUrl: null,
        statusCode: null,
        title: null,
        loadTimeMs: null,
        screenshotPath: null,
        error: summarizeSnapshotFailure(httpError) || summarizeSnapshotFailure(httpsError),
        internalError,
      };
    }
  }
}

function storagePathToAbsolute(screenshotPath) {
  if (!screenshotPath || typeof screenshotPath !== 'string') return null;
  if (!screenshotPath.startsWith('/storage/domain-snapshots/')) return null;
  const relativePath = screenshotPath.replace('/storage/', '');
  return path.resolve(process.cwd(), relativePath);
}

export async function enforceDomainWebSnapshotRetention(prisma, domainId) {
  const snapshots = await prisma.domainWebSnapshot.findMany({
    where: { domainId },
    orderBy: { checkedAt: 'desc' },
  });

  if (snapshots.length <= MAX_SNAPSHOTS_PER_DOMAIN) return;

  const toDelete = snapshots.slice(MAX_SNAPSHOTS_PER_DOMAIN);
  for (const snapshot of toDelete) {
    const absolutePath = storagePathToAbsolute(snapshot.screenshotPath);
    if (absolutePath) {
      await fs.rm(absolutePath, { force: true });
    }
  }

  await prisma.domainWebSnapshot.deleteMany({
    where: {
      id: {
        in: toDelete.map((snapshot) => snapshot.id),
      },
    },
  });
}
