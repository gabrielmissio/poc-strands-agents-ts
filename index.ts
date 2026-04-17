import { z } from 'zod'
import * as strands from '@strands-agents/sdk'
import { JsonRpcProvider, formatEther } from 'ethers'
import express, { type Request, type Response } from 'express'

const PORT = process.env.PORT || 8080
const evmRpcProvider = new JsonRpcProvider(process.env.EVM_RPC_URL)

// Define a custom tool
const calculatorTool = strands.tool({
  name: 'calculator',
  description: 'Performs basic arithmetic operations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  callback: (input): number => {
    switch (input.operation) {
      case 'add':
        return input.a + input.b
      case 'subtract':
        return input.a - input.b
      case 'multiply':
        return input.a * input.b
      case 'divide':
        return input.a / input.b
    }
  },
})

const letterCounterTool = strands.tool({
  name: 'letterCounter',
  description: 'Counts the number of letters in a given string',
  inputSchema: z.object({
    text: z.string(),
  }),
  callback: (input): number => {
    return input.text.replace(/[^a-zA-Z]/g, '').length
  },
})

const evmBalanceTool = strands.tool({
  name: 'evmBalance',
  description: 'Fetches the Ether balance of a given Ethereum address',
  inputSchema: z.object({
    address: z.string(),
  }),
  callback: async (input): Promise<string> => {
    const balance = await evmRpcProvider.getBalance(input.address)
    return formatEther(balance) + ' ETH'
  },
})

// Configure the agent with Amazon Bedrock
const agent = new strands.Agent({
  systemPrompt: `speak like a caveman`,
  model: new strands.BedrockModel({
    region: process.env.AWS_REGION || 'us-east-1',
    modelId: process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-6',
  }),
  tools: [calculatorTool, letterCounterTool, evmBalanceTool],
})

const app = express()

// Health check endpoint (REQUIRED)
app.get('/ping', (_, res) =>
  res.json({
    status: 'Healthy',
    time_of_last_update: Math.floor(Date.now() / 1000),
  })
)

// Agent invocation endpoint (REQUIRED)
// AWS sends binary payload, so we use express.raw middleware
app.post('/invocations', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    // Decode binary payload from AWS SDK
    const prompt = new TextDecoder().decode(req.body)

    // Invoke the agent
    const response = await agent.invoke(prompt)

    // Return response
    return res.json({ response })
  } catch (err) {
    console.error('Error processing request:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AgentCore Runtime server listening on port ${PORT}`)
  console.log(`📍 Endpoints:`)
  console.log(`   POST http://0.0.0.0:${PORT}/invocations`)
  console.log(`   GET  http://0.0.0.0:${PORT}/ping`)
})