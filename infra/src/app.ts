#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { AuthStack } from './stacks/auth-stack.js'
import { BffStack } from './stacks/bff-stack.js'
import { FrontendStack } from './stacks/frontend-stack.js'

const app = new cdk.App()

const projectName = app.node.tryGetContext('projectName') ??  process.env.PROJECT_NAME ?? 'web3-caveman'

// Required context values — pass via `cdk deploy -c agentRuntimeArn=arn:...`
// or set AGENT_RUNTIME_ARN in the environment.
const agentRuntimeArn =
  app.node.tryGetContext('agentRuntimeArn') ??
  process.env.AGENT_RUNTIME_ARN ??
  'PLACEHOLDER_AGENT_RUNTIME_ARN'

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
}

// ── Auth (Cognito User Pool + Identity Pool) ───────────────────────────
const authStack = new AuthStack(app, `${projectName}-auth`, {
  projectName,
  env,
})

// ── BFF (API Gateway + Lambda) ─────────────────────────────────────────────────
const bffStack = new BffStack(app, `${projectName}-bff`, {
  projectName,
  userPool: authStack.userPool,
  agentRuntimeArn,
  invokeAuthMode: 'sigv4',
  env,
})
bffStack.addDependency(authStack)

// ── Frontend (S3 + CloudFront) ─────────────────────────────────────────
// Must run AFTER auth and bff stacks so their outputs are available.
const frontendStack = new FrontendStack(app, `${projectName}-frontend`, {
  projectName,
  bffUrl: bffStack.apiUrl,
  cognitoUserPoolId: authStack.userPool.userPoolId,
  cognitoUserPoolClientId: authStack.userPoolClient.userPoolClientId,
  cognitoIdentityPoolId: authStack.identityPool.ref,
  cognitoRegion: env.region ?? 'us-east-1',
  agentRuntimeArn,
  env,
})
frontendStack.addDependency(bffStack)
