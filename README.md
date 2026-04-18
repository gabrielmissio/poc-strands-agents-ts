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

## Deploying to Amazon Bedrock AgentCore Runtime

### Create IAM Role

#### Make the script executable

```bash
chmod +x create-iam-role.sh
```

#### Run the script

```bash
/create-iam-role.sh
```

#### Or specify a different region

```bash
AWS_REGION=us-east-1 ./create-iam-role.sh
```

### Deploy to AWS


#### Set Environment Variables

```bash
export ACCOUNTID=$(aws sts get-caller-identity --query Account --output text)

export AWS_REGION=us-east-1

// Set the IAM Role ARN
export ROLE_ARN=$(aws iam get-role \
  --role-name PocStrandsAgentsBedrockAgentCoreRuntimeRole \
  --query 'Role.Arn' \
  --output text)

// New or Existing ECR repository name
export ECR_REPO=poc-strands-agents-bedrock-agent-core-ts
```

#### Create ECR Repository

```bash
aws ecr create-repository \
  --repository-name ${ECR_REPO} \
  --region ${AWS_REGION}
```

#### Login to ECR

```bash
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin \
  ${ACCOUNTID}.dkr.ecr.${AWS_REGION}.amazonaws.com
```

#### Build, Tag, and Push

```bash
docker build -t ${ECR_REPO} .

docker tag ${ECR_REPO}:latest \
  ${ACCOUNTID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:latest

docker push ${ACCOUNTID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:latest
```

#### Create AgentCore Runtime

```bash
aws bedrock-agentcore-control create-agent-runtime \
  --agent-runtime-name my_agent_service \
  --agent-runtime-artifact containerConfiguration={containerUri=${ACCOUNTID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:latest} \
  --role-arn ${ROLE_ARN} \
  --network-configuration networkMode=PUBLIC \
  --protocol-configuration serverProtocol=HTTP \
  --region ${AWS_REGION}
```