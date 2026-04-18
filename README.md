# poc-strands-agents-ts


### Install dependencies and setup env vars

```bash
npm install
cp .env.example .env
```

### Start HTTP MCP Server

```bash
npm run mcp:http
```

### Start `Caveman Web3 Agent` locally

```bash
npm run dev
```

### Send a request to `caveman`


```bash
curl --location 'http://localhost:8080/invocations' \
    --header 'Content-Type: application/octet-stream' \
    --data 'how many time the letter `s` apperns in the sentence: satoshi nakamoto'\''s secret'
```

or


```bash
curl --location 'http://localhost:8080/invocations' \
    --header 'Content-Type: application/octet-stream' \
    --data 'generate a address that starts with `0xde` than count how many times the letter `d` appears in the address.'
```
