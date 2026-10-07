import { Hono } from 'hono';
import { DurableObject } from 'cloudflare:workers';

type Bindings = {
  AI: Ai;
  MY_DURABLE_OBJECT: DurableObjectNamespace<ChatDurableObject>;
};

// Stateful Durable Object with built-in SQLite storage for long-term memory
export class ChatDurableObject extends DurableObject {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS long_term_memory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fact TEXT
        )
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/remember' && request.method === 'POST') {
      const { fact } = await request.json() as { fact: string };
      this.ctx.storage.sql.exec("INSERT INTO long_term_memory (fact) VALUES (?)", fact);
      return Response.json({ success: true });
    }

    if (url.pathname === '/recall' && request.method === 'GET') {
      const cursor = this.ctx.storage.sql.exec("SELECT fact FROM long_term_memory ORDER BY id DESC LIMIT 5");
      const memories = [...cursor].map(row => (row as any).fact);
      return Response.json(memories);
    }

    return new Response('Not found', { status: 404 });
  }
}

const app = new Hono<{ Bindings: Bindings }>();

// Frontend UI starts fresh on every refresh, but AI remembers facts across sessions
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare Smart Memory AI</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 h-screen flex flex-col justify-between">
    <header class="bg-slate-800 p-4 border-b border-slate-700 text-center font-bold text-lg">
        Cloudflare Llama 3.3 + Long-Term Memory 🧠✨
    </header>
    
    <main id="chat-box" class="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl w-full mx-auto">
        <div class="flex justify-start">
            <div class="bg-slate-800 p-3 rounded-lg max-w-[80%] text-sm">Hello! Refresh anytime for a fresh chat screen. But tell me something about yourself (like your name or hobbies), and I'll remember it forever using Durable Objects!</div>
        </div>
    </main>

    <footer class="bg-slate-800 p-4 border-t border-slate-700">
        <form id="chat-form" class="max-w-2xl mx-auto flex gap-2">
            <input type="text" id="user-input" placeholder="Type a message..." required
                class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-500">
            <button type="submit" class="bg-cyan-600 hover:bg-cyan-500 px-5 py-2 rounded-lg font-medium transition">Send</button>
        </form>
    </footer>

    <script>
        const chatBox = document.getElementById('chat-box');
        const form = document.getElementById('chat-form');
        const input = document.getElementById('user-input');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = input.value;
            input.value = '';
            
            chatBox.innerHTML += \`<div class="flex justify-end"><div class="bg-cyan-700 p-3 rounded-lg max-w-[80%] text-sm">\${text}</div></div>\`;
            chatBox.scrollTop = chatBox.scrollHeight;

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text })
                });
                const data = await res.json();
                
                chatBox.innerHTML += \`<div class="flex justify-start"><div class="bg-slate-800 p-3 rounded-lg max-w-[80%] text-sm">\${data.reply}</div></div>\`;
                chatBox.scrollTop = chatBox.scrollHeight;
            } catch (err) {
                console.error(err);
            }
        });
    </script>
</body>
</html>`);
});

function getDO(c: any) {
  const id = c.env.MY_DURABLE_OBJECT.idFromName("global-memory");
  return c.env.MY_DURABLE_OBJECT.get(id);
}

// Backend API routing messages with background long-term memory retrieval
app.post('/api/chat', async (c) => {
  const { message } = await c.req.json();
  const stub = getDO(c);

  // 1. Fetch past long-term memories from Durable Object SQLite
  const memoryRes = await stub.fetch(new URL("/recall", "http://do"));
  const pastMemories = await memoryRes.json() as string[];

  // 2. Ask Llama 3.3 to extract any important facts from the user's message to save for later
  // Or simply feed past memories into the system prompt context
  const systemPrompt = `You are a helpful AI assistant with persistent long-term memory. 
Here are facts you remember about the user from past sessions: ${pastMemories.join(', ') || 'None yet.'}
If the user shares a personal detail (like name, favorite food, project name), acknowledge it so it gets saved.`;

  const aiResponse = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]
  });

  const reply = (aiResponse as any).response || "No response generated.";

  // 3. Simple heuristic: If the user says something revealing, save it to Durable Object storage
  if (message.toLowerCase().includes("my name is") || message.toLowerCase().includes("i like") || message.toLowerCase().includes("i am building")) {
    await stub.fetch(new URL("/remember", "http://do"), {
      method: 'POST',
      body: JSON.stringify({ fact: message })
    });
  }

  return c.json({ reply });
});

export default app;