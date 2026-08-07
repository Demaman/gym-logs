import type { GenerateProgramRequest, Program } from '@/types/api'
import { api } from './client'

export async function generateProgram(req: GenerateProgramRequest): Promise<Program> {
  const { data } = await api.post<Program>('/api/v1/ai/generate-program', req)
  return data
}
