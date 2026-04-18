# poc-strands-agents-ts

## Test locally

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

## Test locally (with Docker)

### Build the image

```bash
docker build -t poc-strands-agents-ts .
```

### Run the container

> The agent connects to the HTTP MCP server running on your host machine.
> On Linux, use `--add-host` to expose the host as `host.docker.internal`.

```bash
docker run -p 8082:8080 \
  --add-host=host.docker.internal:host-gateway \
  -e EXCHANGE_RATE_MCP_URL=http://host.docker.internal:8081/mcp \
  poc-strands-agents-ts
```

### Test in another terminal

```bash
curl http://localhost:8082/ping
```
