# ChatGPT Live Talk

A Next.js project for real-time chat interactions using OpenAI's GPT models.

## Prerequisites

- Node.js installed on your system
- OpenAI API key
- npm, yarn, pnpm, or bun package manager

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

## Configuration

Two ways to configure the application:

### 1. Direct OpenAI API Connection

Create a `.env` file from `.env.example` with:

```env
NEXT_PUBLIC_OPENAI_API_KEY="your-api-key"
NEXT_PUBLIC_WITHOUT_RELAY=true
```

### 2. Using Relay Server (Recommended)

Create a `.env` file from `.env.example` with:

```env
NEXT_PUBLIC_LOCAL_RELAY_SERVER_URL="your-relay-server-url"
OPENAI_API_KEY="your-api-key"
```

> Note: The relay server code is available in the `/relay-server` directory

## Development

Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Access the application at [http://localhost:3000](http://localhost:3000)
