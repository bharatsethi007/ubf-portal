import { useEffect, useState } from 'react'
import { listContacts, type Contact } from './contactsApi'

/** The account's saved contacts, loaded once. Empty on error so forms still work. */
export function useContacts(): Contact[] {
  const [c, setC] = useState<Contact[]>([])
  useEffect(() => { listContacts().then(setC).catch(() => setC([])) }, [])
  return c
}
