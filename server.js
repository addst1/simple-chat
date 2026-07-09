const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

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
