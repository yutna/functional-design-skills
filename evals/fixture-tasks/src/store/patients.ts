import type { PatientId } from '../domain/ids'

export type Patient = {
  readonly id: PatientId
  readonly name: string
  readonly dateOfBirth: Date
}

const patients = new Map<PatientId, Patient>()

export const findPatient = async (
  id: PatientId,
): Promise<Patient | undefined> => patients.get(id)

export const savePatient = async (patient: Patient): Promise<void> => {
  patients.set(patient.id, patient)
}
