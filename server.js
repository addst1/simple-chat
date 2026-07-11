const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const webpush = require('web-push');

const PORT = process.env.PORT || 3000;

// 푸시 알림용 VAPID 키 (환경변수로 지정 가능, 없으면 아래 기본값 사용)
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BCAyLZ1TZKAhl8y9ifv29x05_7dY7jF-I6xO9H_cepCRom9W0FY912U3Trz4P0SNSTJwxqieSemBQKGcTEmUfhQ';
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'tSLQysnoFQXHk5cO9F11zs9rLaOsDqy9rS06DJdER9A';

webpush.setVapidDetails('mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/vapid-public-key', (req, res) => {
  res.send(VAPID_PUBLIC_KEY);
});

// 푸시 구독 정보 저장 (메시지 내용은 저장하지 않음, 알림 전송용 구독 정보만 메모리에 보관)
const pushSubscriptions = new Map(); // name -> subscription

app.post('/subscribe', (req, res) => {
  const { name, subscription } = req.body || {};
  if (!name || !subscription) return res.status(400).end();
  pushSubscriptions.set(name, subscription);
  res.status(201).end();
});

function notifyOffline(senderName) {
  const payload = JSON.stringify({
    title: '간단 채팅',
    body: `${senderName}님이 메시지를 보냈습니다.`,
  });
  const connectedNames = new Set([...clients.values()].map((c) => c.name));
  for (const [name, sub] of pushSubscriptions.entries()) {
    if (name === senderName) continue;
    if (connectedNames.has(name)) continue; // 이미 채팅방에 접속 중이면 알림 생략
    webpush.sendNotification(sub, payload).catch(() => {
      pushSubscriptions.delete(name); // 만료된 구독 정리
    });
  }
}

const server = app.listen(PORT, () => {
  console.log(`채팅 서버 실행 중: http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

// 접속 중인 클라이언트: Map<WebSocket, { name: string }>
const clients = new Map();

function broadcast(payload, exclude) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN && client !== exclude) {
      client.send(data);
    }
  }
}

function broadcastUserList() {
  const names = [...clients.values()].map((c) => c.name);
  broadcast({ type: 'users', users: names });
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'join') {
      const name = (msg.name || '익명').toString().slice(0, 20);
      clients.set(ws, { name });
      broadcast({ type: 'system', text: `${name}님이 입장했습니다.` });
      broadcastUserList();
      return;
    }

    if (msg.type === 'message') {
      const client = clients.get(ws);
      if (!client) return;
      const text = (msg.text || '').toString().slice(0, 1000);
      if (!text.trim()) return;
      broadcast({
        type: 'message',
        name: client.name,
        text,
        time: Date.now(),
      });
      notifyOffline(client.name);
      return;
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      clients.delete(ws);
      broadcast({ type: 'system', text: `${client.name}님이 퇴장했습니다.` });
      broadcastUserList();
    }
  });
});
