// wsClient.js
let ws;

export function connectWS(userId, onMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) return ws;

  // replace with your backend ws URL
  ws = new WebSocket(`ws://localhost:8003?userId=${userId}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    onMessage(msg);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };

  ws.onerror = (err) => {
    console.error('WebSocket error', err);
  };

  return ws;
}

export function sendWS(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    console.error('WebSocket is not connected');
  }
}
