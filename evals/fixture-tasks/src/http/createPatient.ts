import { randomUUID } from 'node:crypto'
import type { PatientId } from '../domain/ids'
import { savePatient } from '../store/patients'
import type { Handler } from './server'

export const createPatient: Handler = async (request) => {
  const body = request.body as { name: string; dateOfBirth: string }
  const patient = {
    id: randomUUID() as PatientId,
    name: body.name,
    dateOfBirth: new Date(body.dateOfBirth),
  }
  await savePatient(patient)
  return { status: 201, body: patient }
}
