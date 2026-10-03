import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { Login } from './views/Login'
import { Placeholder } from './views/Placeholder'
import { AdminLayout } from './layouts/AdminLayout'
import { Dashboard } from './views/admin/Dashboard'
import { StaffAdmin } from './views/admin/Staff'
import { Referrals } from './views/admin/Referrals'
import { Associations } from './views/admin/Associations'
import { GpsMap } from './views/admin/GpsMap'
import { Wilayas } from './views/admin/Wilayas'
import { Audit } from './views/admin/Audit'
import { Followups } from './views/admin/Followups'
import { AboutAdmin } from './views/admin/About'
import { Shifts } from './views/admin/Shifts'
import { Zones } from './views/admin/Zones'
import { Agencies } from './views/admin/Agencies'
import { Thermal } from './views/admin/Thermal'
import { AgencyPortal } from './views/portals/AgencyPortal'
import { ThermalPortal } from './views/portals/ThermalPortal'
import { ResearcherPortal } from './views/portals/ResearcherPortal'
import { FamilyPortal } from './views/portals/FamilyPortal'
import { DassPortal } from './views/portals/DassPortal'
import { PharmacistPortal } from './views/portals/PharmacistPortal'
import { NursePortal } from './views/portals/NursePortal'
import { DoctorPortal } from './views/portals/DoctorPortal'
import { PatientPortal } from './views/portals/PatientPortal'
import { HealthOps } from './views/admin/HealthOps'
import { AboutPage } from './views/public/AboutPage'
import { PublicAssociations } from './views/public/PublicAssociations'
import { VitalDZ } from './views/VitalDZ'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return <div className="login-screen muted">جارٍ التحقق…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RolePortal() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'agency') return <AgencyPortal />
  if (user.role === 'thermal') return <ThermalPortal />
  if (user.role === 'researcher') return <ResearcherPortal />
  if (user.role === 'family') return <FamilyPortal />
  if (user.role === 'dass') return <DassPortal />
  if (user.role === 'pharmacist') return <PharmacistPortal />
  if (user.role === 'nurse') return <NursePortal />
  if (user.role === 'doctor') return <DoctorPortal />
  if (user.role === 'patient') return <PatientPortal />
  return <Placeholder />
}

function Router() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/public/associations" element={<PublicAssociations />} />
      <Route
        path="/admin/*"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="healthops" element={<HealthOps />} />
        <Route path="wilayas" element={<Wilayas />} />
        <Route path="staff" element={<StaffAdmin />} />
        <Route path="referrals" element={<Referrals />} />
        <Route path="followups" element={<Followups />} />
        <Route path="associations" element={<Associations />} />
        <Route path="shifts" element={<Shifts />} />
        <Route path="agencies" element={<Agencies />} />
        <Route path="thermal" element={<Thermal />} />
        <Route path="zones" element={<Zones />} />
        <Route path="about" element={<AboutAdmin />} />
        <Route path="gps" element={<GpsMap />} />
        <Route path="audit" element={<Audit />} />
      </Route>
      <Route
        path="/portal/:role"
        element={
          <RequireAuth>
            <RolePortal />
          </RequireAuth>
        }
      />
      <Route
        path="/cv"
        element={
          <RequireAuth>
            <ResearcherPortal />
          </RequireAuth>
        }
      />
      <Route
        path="/vital"
        element={
          <RequireAuth>
            <VitalDZ />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </BrowserRouter>
  )
}