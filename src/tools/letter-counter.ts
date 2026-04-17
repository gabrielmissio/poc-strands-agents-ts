import { z } from 'zod'
import * as strands from '@strands-agents/sdk'

export const letterCounterTool = strands.tool({
  name: 'letterCounter',
  description: 'Counts the number of letters in a given string',
  inputSchema: z.object({
    text: z.string(),
  }),
  callback: (input): number => {
    return input.text.replace(/[^a-zA-Z]/g, '').length
  },
})
