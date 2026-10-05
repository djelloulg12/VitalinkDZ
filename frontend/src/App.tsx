import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { Login } from './views/Login'
import { Placeholder } from './views/Placeholder'
import { NotificationBell, ChangePasswordModal } from './notifications'
import { AboutPage } from './views/public/AboutPage'
import { PublicAssociations } from './views/public/PublicAssociations'
import { Landing } from './views/public/Landing'
import { MedicalTourism } from './views/public/MedicalTourism'

// تقطيع الحزم حسب الدور/القسم — يسرّع أول تحميل ويخفّض الحزمة الرئيسية.
const AdminLayout = lazy(() => import('./layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const Dashboard = lazy(() => import('./views/admin/Dashboard').then((m) => ({ default: m.Dashboard })))
const StaffAdmin = lazy(() => import('./views/admin/Staff').then((m) => ({ default: m.StaffAdmin })))
const Referrals = lazy(() => import('./views/admin/Referrals').then((m) => ({ default: m.Referrals })))
const Associations = lazy(() => import('./views/admin/Associations').then((m) => ({ default: m.Associations })))
const GpsMap = lazy(() => import('./views/admin/GpsMap').then((m) => ({ default: m.GpsMap })))
const Wilayas = lazy(() => import('./views/admin/Wilayas').then((m) => ({ default: m.Wilayas })))
const Audit = lazy(() => import('./views/admin/Audit').then((m) => ({ default: m.Audit })))
const Followups = lazy(() => import('./views/admin/Followups').then((m) => ({ default: m.Followups })))
const AboutAdmin = lazy(() => import('./views/admin/About').then((m) => ({ default: m.AboutAdmin })))
const Shifts = lazy(() => import('./views/admin/Shifts').then((m) => ({ default: m.Shifts })))
const Zones = lazy(() => import('./views/admin/Zones').then((m) => ({ default: m.Zones })))
const Agencies = lazy(() => import('./views/admin/Agencies').then((m) => ({ default: m.Agencies })))
const Thermal = lazy(() => import('./views/admin/Thermal').then((m) => ({ default: m.Thermal })))
const HealthOps = lazy(() => import('./views/admin/HealthOps').then((m) => ({ default: m.HealthOps })))
const AgencyPortal = lazy(() => import('./views/portals/AgencyPortal').then((m) => ({ default: m.AgencyPortal })))
const ThermalPortal = lazy(() => import('./views/portals/ThermalPortal').then((m) => ({ default: m.ThermalPortal })))
const ResearcherPortal = lazy(() => import('./views/portals/ResearcherPortal').then((m) => ({ default: m.ResearcherPortal })))
const FamilyPortal = lazy(() => import('./views/portals/FamilyPortal').then((m) => ({ default: m.FamilyPortal })))
const DassPortal = lazy(() => import('./views/portals/DassPortal').then((m) => ({ default: m.DassPortal })))
const PharmacistPortal = lazy(() => import('./views/portals/PharmacistPortal').then((m) => ({ default: m.PharmacistPortal })))
const NursePortal = lazy(() => import('./views/portals/NursePortal').then((m) => ({ default: m.NursePortal })))
const DoctorPortal = lazy(() => import('./views/portals/DoctorPortal').then((m) => ({ default: m.DoctorPortal })))
const PatientPortal = lazy(() => import('./views/portals/PatientPortal').then((m) => ({ default: m.PatientPortal })))
const VitalDZ = lazy(() => import('./views/VitalDZ').then((m) => ({ default: m.VitalDZ })))

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

/** طبقة جرس الإشعارات — تظهر فقط عند تسجيل الدخول. */
function BellLayer() {
  const { user, ready } = useAuth()
  if (!ready || !user) return null
  return <NotificationBell />
}

/** بوابة تأمين الحساب: إن تعيّن تغيير كلمة المرور، تُفرض النافذة فوق كل الشاشات. */
function ForceChangeGate() {
  const { user, ready, reloadUser } = useAuth()
  if (!ready || !user || !user.must_change_password) return null
  return <ChangePasswordModal locked onDone={() => reloadUser().catch(() => {})} />
}

function Router() {
  return (
    <Suspense fallback={<div className="page-loader">⏳ جارٍ تحميل المنظومة…</div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/tourism" element={<MedicalTourism />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Router />
        <ForceChangeGate />
        <BellLayer />
      </AuthProvider>
    </BrowserRouter>
  )
}