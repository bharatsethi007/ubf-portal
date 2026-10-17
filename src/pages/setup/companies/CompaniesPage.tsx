import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  fetchBranches, fetchCompanies, fetchCompanyContext, fetchStaffCompanies,
  type Branch, type Company, type StaffCompany,
} from '../../../features/company/companyApi'
import { useStaffList } from '../../../hooks/useStaffList'
import CompaniesSection from './CompaniesSection'
import BranchesSection from './BranchesSection'
import StaffAccessSection from './StaffAccessSection'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [access, setAccess] = useState<StaffCompany[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const { staff } = useStaffList()

  const reload = useCallback(async () => {
    try {
      const [c, b, a, ctx] = await Promise.all([fetchCompanies(), fetchBranches(), fetchStaffCompanies(), fetchCompanyContext()])
      setCompanies(c); setBranches(b); setAccess(a); setIsAdmin(ctx.is_admin)
    } catch {
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <Link to="/setup" style={{ fontSize: 13, textDecoration: 'none' }}>← Setup</Link>
        <header className="quotes-page__head" style={{ marginTop: 8 }}>
          <h1>Companies &amp; branches</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            Countries, their offices, and which staff work in each.{isAdmin ? '' : ' Admins can edit.'}
          </p>
        </header>
        {loading ? <p className="text-muted-foreground">Loading…</p> : (
          <>
            <CompaniesSection rows={companies} setRows={setCompanies} canEdit={isAdmin} reload={reload} />
            <BranchesSection rows={branches} setRows={setBranches} companies={companies} canEdit={isAdmin} reload={reload} />
            <StaffAccessSection rows={access} staff={staff} companies={companies} branches={branches} canEdit={isAdmin} reload={reload} />
          </>
        )}
      </div>
    </div>
  )
}
