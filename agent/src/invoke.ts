import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { randomUUID } from 'node:crypto'

// ── Config ──────────────────────────────────────────────────────────────
const agentRuntimeArn = process.env.AGENT_RUNTIME_ARN
const region = process.env.AWS_REGION || 'us-east-1'
const cognitoClientId = process.env.COGNITO_CLIENT_ID
const cognitoUsername = process.env.COGNITO_USERNAME
const cognitoPassword = process.env.COGNITO_PASSWORD

if (!agentRuntimeArn) {
  console.error('Error: AGENT_RUNTIME_ARN environment variable is not set.')
  process.exit(1)
}
if (!cognitoClientId || !cognitoUsername || !cognitoPassword) {
  console.error('Error: COGNITO_CLIENT_ID, COGNITO_USERNAME, and COGNITO_PASSWORD must be set.')
  process.exit(1)
}

const inputText = 'Tell me what tools/skills you have and can use to help me.'

// OBS: temporarily enable USER_PASSWORD_AUTH flow for testing, but in production you should use a more secure auth flow (e.g. Authorization Code Grant with PKCE)
// ── Get Cognito access token ────────────────────────────────────────────
const cognito = new CognitoIdentityProviderClient({ region })
const authResult = await cognito.send(
  new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: cognitoClientId,
    AuthParameters: {
      USERNAME: cognitoUsername,
      PASSWORD: cognitoPassword,
    },
  }),
)
const accessToken = authResult.AuthenticationResult?.AccessToken
if (!accessToken) {
  console.error('Error: Failed to get access token from Cognito.')
  process.exit(1)
}
console.log('✅ Got Cognito access token')

// ── Invoke agent via REST (JWT auth) ────────────────────────────────────
const escapedArn = encodeURIComponent(agentRuntimeArn)
const url = `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/${escapedArn}/invocations?qualifier=DEFAULT`

const response = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': randomUUID(),
  },
  body: inputText,
})

if (!response.ok) {
  const errorText = await response.text()
  console.error(`HTTP ${response.status}: ${errorText}`)
  process.exit(1)
}

// ── Read SSE stream ─────────────────────────────────────────────────────
const reader = response.body!.getReader()
const decoder = new TextDecoder()
let fullText = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value, { stream: true })
  for (const line of chunk.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const data = line.substring(6)
    if (data === '[DONE]') continue

    try {
      const event = JSON.parse(data)
      // Print each event type for debugging
      console.log(`[${event.type ?? 'unknown'}]`, JSON.stringify(event).substring(0, 200))

      // Extract text tokens
      if (event.type === 'modelStreamUpdateEvent') {
        const inner = event.event
        if (inner?.type === 'modelContentBlockDeltaEvent' && inner.delta?.type === 'textDelta') {
          process.stdout.write(inner.delta.text)
          fullText += inner.delta.text
        }
      }
    } catch {
      // not JSON, skip
    }
  }
}

console.log('\n\n--- Full response ---')
console.log(fullText)
