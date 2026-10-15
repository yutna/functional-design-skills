import { parsePatientId } from '../domain/ids'
import { findPatient } from '../store/patients'
import { HttpError, type Handler } from './server'

export const getPatient: Handler = async (request) => {
  const id = parsePatientId(request.params['id'])
  if (!id.ok) throw new HttpError(400, 'invalid patient id', id.error)
  const patient = await findPatient(id.value)
  if (patient === undefined) throw new HttpError(404, 'no such patient')
  return { status: 200, body: patient }
}
