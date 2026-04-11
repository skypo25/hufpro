export type DirectoryClaimFormState = {
  ok: boolean
  error: string | null
}

export const initialClaimFormState: DirectoryClaimFormState = { ok: false, error: null }
