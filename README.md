
# Cloudflare Stateful AI Agent 🧠⚡️

A full-stack, serverless AI-powered chat application built for the Cloudflare platform. It utilizes **Llama 3.3** via Workers AI for intelligence and **Cloudflare Durable Objects with built-in SQLite** for persistent, long-term session memory.

## 🚀 Architecture & Tech Stack

* **LLM:** Meta Llama 3.3 (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) running natively on **Cloudflare Workers AI** with zero cold starts and no external API keys required.
* **Workflow & State Coordination:** **Cloudflare Durable Objects** with embedded SQLite storage (`this.state.storage.sql`) to safely persist and manage chat history across sessions.
* **Backend Framework:** **Hono** running on Cloudflare Workers edge runtime.
* **User Input & Frontend:** Responsive Tailwind CSS chat interface served directly from the edge.

---

## 🛠️ How It Works

1. **Stateful Memory:** Every user prompt and assistant reply is logged into a durable SQLite database inside a Cloudflare Durable Object.
2. **Contextual Awareness:** When a user sends a message, the application retrieves the historical conversation context from the Durable Object and feeds it into Llama 3.3.
3. **Session Management:** The frontend UI provides a clean slate on browser refresh, while the background long-term memory remains fully persistent.

---

## ⚙️ Local Development Setup

To run this project locally:

1. Clone the repository:
   ```bash
   git clone [https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git)
   cd YOUR_REPO_NAME

2. Install Dependencies:
      ```bash
           npm install
4. Run the developement Server:
       ```bash
            npx wrangler dev
## Live Deployment Server : https://ai-app-submission.sharathakkaldevi.workers.dev
