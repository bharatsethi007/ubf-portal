import { useState } from 'react'
import UsersTab from './UsersTab'
import RolesTab from './RolesTab'

export default function UsersArea() {
  const [tab, setTab] = useState<'users' | 'roles'>('users')
  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head"><h1>Users & Roles</h1></header>
        <div className="quotes-tabs" style={{ marginBottom: 16 }}>
          <button type="button" className={`quotes-tabs__btn${tab === 'users' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('users')}>Users</button>
          <button type="button" className={`quotes-tabs__btn${tab === 'roles' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('roles')}>Roles</button>
        </div>
        {tab === 'users' ? <UsersTab /> : <RolesTab />}
      </div>
    </div>
  )
}
