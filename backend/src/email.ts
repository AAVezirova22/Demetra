import net from 'net';
import tls from 'tls';

type MailSocket = net.Socket | tls.TLSSocket;

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? 465 : 587));
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'notifications@demetra.local';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_STARTTLS = process.env.SMTP_STARTTLS !== 'false';

function isMailConfigured() {
  return Boolean(SMTP_HOST && SMTP_FROM);
}

function escapeAddress(address: string) {
  return address.replace(/[<>\r\n]/g, '');
}

function escapeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function escapeData(value: string) {
  return value.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function readResponse(socket: MailSocket) {
  return new Promise<string>((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) {
        cleanup();
        resolve(buffer);
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
    };

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function command(socket: MailSocket, line: string, expected: number[]) {
  socket.write(`${line}\r\n`);
  const response = await readResponse(socket);
  const code = Number(response.slice(0, 3));
  if (!expected.includes(code)) {
    throw new Error(`SMTP command failed: ${line} -> ${response.trim()}`);
  }
  return response;
}

function connectSocket() {
  return new Promise<MailSocket>((resolve, reject) => {
    const socket = SMTP_SECURE
      ? tls.connect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST }, () => resolve(socket))
      : net.connect({ host: SMTP_HOST, port: SMTP_PORT }, () => resolve(socket));

    socket.once('error', reject);
  });
}

async function upgradeToTls(socket: MailSocket) {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: SMTP_HOST }, () => resolve(secureSocket));
    secureSocket.once('error', reject);
  });
}

export async function sendNotificationEmail(to: string, title: string, message: string) {
  if (!isMailConfigured()) return;

  const safeTo = escapeAddress(to);
  const safeFrom = escapeAddress(SMTP_FROM);
  let socket = await connectSocket();

  try {
    await readResponse(socket);
    await command(socket, 'EHLO demetra.local', [250]);

    if (!SMTP_SECURE && SMTP_STARTTLS) {
      await command(socket, 'STARTTLS', [220]);
      socket = await upgradeToTls(socket);
      await command(socket, 'EHLO demetra.local', [250]);
    }

    if (SMTP_USER && SMTP_PASS) {
      await command(socket, 'AUTH LOGIN', [334]);
      await command(socket, Buffer.from(SMTP_USER).toString('base64'), [334]);
      await command(socket, Buffer.from(SMTP_PASS).toString('base64'), [235]);
    }

    await command(socket, `MAIL FROM:<${safeFrom}>`, [250]);
    await command(socket, `RCPT TO:<${safeTo}>`, [250, 251]);
    await command(socket, 'DATA', [354]);

    const body = [
      `From: Demetra <${safeFrom}>`,
      `To: <${safeTo}>`,
      `Subject: ${escapeHeader(title)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      escapeData(message),
      '',
      'This email mirrors a notification in your Demetra account.',
      '.',
    ].join('\r\n');

    socket.write(`${body}\r\n`);
    await readResponse(socket);
    await command(socket, 'QUIT', [221]);
  } finally {
    socket.destroy();
  }
}

export async function sendNotificationEmailSafely(to: string | null | undefined, title: string, message: string) {
  if (!to) return;
  try {
    await sendNotificationEmail(to, title, message);
  } catch (error) {
    console.error('Failed to send notification email:', error);
  }
}
