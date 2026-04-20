import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore'
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js'

// ── Config ──────────────────────────────────────────────────────────────
const region = process.env.AWS_REGION || 'us-east-1'
const authMode = (process.env.INVOKE_AUTH_MODE || 'jwt').toLowerCase() // 'jwt' | 'sigv4'

const client = new BedrockAgentCoreClient({ region })

export interface InvokeAgentInput {
  message: string
  sessionId: string
  agentRuntimeArn: string
}

// ── SRP auth ────────────────────────────────────────────────────────────

function getCognitoAccessToken(): Promise<string> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID
  const clientId = process.env.COGNITO_CLIENT_ID
  const username = process.env.COGNITO_USERNAME
  const password = process.env.COGNITO_PASSWORD

  if (!userPoolId || !clientId || !username || !password) {
    throw new Error(
      'COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_USERNAME, and COGNITO_PASSWORD must be set for JWT auth.',
    )
  }

  return new Promise((resolve, reject) => {
    const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId })
    const user = new CognitoUser({ Username: username, Pool: pool })
    const authDetails = new AuthenticationDetails({ Username: username, Password: password })

    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session.getAccessToken().getJwtToken()),
      onFailure: (err) => reject(err),
    })
  })
}

// ── Invoke via JWT (Cognito SRP → Bearer token → REST SSE) ─────────────

async function invokeWithJwt(input: InvokeAgentInput): Promise<ReadableStream<Uint8Array>> {
  const accessToken = await getCognitoAccessToken()

  const escapedArn = encodeURIComponent(input.agentRuntimeArn)
  const url = `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/${escapedArn}/invocations?qualifier=DEFAULT`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': input.sessionId,
    },
    body: input.message,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AgentCore HTTP ${response.status}: ${errorText}`)
  }

  if (!response.body) {
    throw new Error('No response body from AgentCore (JWT).')
  }

  return response.body
}

// ── Invoke via SigV4 (AWS SDK with IAM credentials) ─────────────────────

async function invokeWithSigV4(input: InvokeAgentInput): Promise<ReadableStream<Uint8Array>> {
  const command = new InvokeAgentRuntimeCommand({
    runtimeSessionId: input.sessionId,
    agentRuntimeArn: input.agentRuntimeArn,
    qualifier: 'DEFAULT',
    payload: new TextEncoder().encode(input.message),
  })

  const result = await client.send(command)

  if (!result.response) {
    throw new Error('No response body from AgentCore (SigV4).')
  }

  return result.response as unknown as ReadableStream<Uint8Array>
}

// ── Public API ──────────────────────────────────────────────────────────

export async function invokeAgentStream(input: InvokeAgentInput): Promise<ReadableStream<Uint8Array>> {
  if (authMode === 'sigv4') {
    return invokeWithSigV4(input)
  }
  return invokeWithJwt(input)
}
