export interface User {
  id: number
  username: string
  role: string
  name: string
  email: string
  phone: string
  wilaya_id?: number
  facility: string
  avatar: string
  must_change_password?: boolean
}

export interface Wilaya {
  code: number
  name_ar: string
  name_fr: string
  lat: number
  lng: number
}

export interface Staff {
  id: number
  full_name: string
  kind: string
  specialty: string
  institution_id?: number
  institution_name?: string | null
  wilaya_id?: number
  wilaya_ar?: string | null
  wilaya_fr?: string | null
  phone: string
  patients_count: number
  active: boolean
  created_at?: string
  license_doc?: string
  license_status?: string
  verified_by?: string
  verified_at?: string | null
}

export interface InstitutionRef {
  id: number
  name: string
  type: string
  city: string
  wilaya_id?: number
}

export interface Referral {
  id: number
  patient_name: string
  from?: InstitutionRef | null
  to?: InstitutionRef | null
  reason: string
  medical_note: string
  status: string
  severity?: string
  sla_hours?: number | null
  created_at?: string
  created_by?: string
  decided_at?: string
  decided_by?: string
  outcome?: string
  completed_at?: string
}

export interface Notification {
  id: number
  role: string
  title: string
  body: string
  icon: string
  entity: string
  entity_id: number
  link: string
  read: boolean
  created_at: string
}

export interface PublicStation {
  id: number
  name: string
  wilaya_ar: string
  wilaya_fr: string
  treatments: string
  water_temp: number
  services: string
  rating_avg: number
  packages_count: number
  min_price: number
}

export interface PublicPackage {
  id: number
  title: string
  destination: string
  nights: number
  price: number
  includes: string
  treatments: string
  station_name: string
  agency_name: string
}

export interface WilayaReportRow {
  wilaya_code: number
  wilaya_ar: string
  wilaya_fr: string
  staff: number
  doctors: number
  nurses: number
  referrals: number
  pending: number
  accepted: number
  done: number
  followups: number
  institutions: number
  stations: number
  pharmacies: number
  agencies: number
  bookings: number
}

export interface RedAlertItem {
  id: number
  patient_name: string
  reason: string
  medical_note: string
  created_at?: string
  age_hours: number
  breached: boolean
  from?: InstitutionRef | null
  to?: InstitutionRef | null
}

export interface Followup {
  id?: number
  patient_name: string
  referral_id?: number | null
  kind: string
  kind_label?: string
  date: string
  author?: string
  summary: string
  subjective: string
  objective: string
  vitals: { pulse?: number; bpSys?: number; bpDia?: number; temp?: number; spO2?: number; sugar?: number }
  medications: string[]
  attachments: { name: string; dataUrl: string }[]
  signed_by?: string
  signed_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface SiteContent {
  key: string
  title: string
  sections: { h: string; p: string }[]
  updated_by?: string
  updated_at?: string | null
}

export interface DutyShift {
  id: number
  staff_id: number
  staff_name?: string
  staff_kind?: string
  date: string
  shift: string
  shift_label?: string
  unit: string
  note: string
}

export interface GeoZone {
  id: number
  name: string
  wilaya_code?: number | null
  lat: number
  lng: number
  radius_km: number
  enabled: boolean
}

export interface Agency {
  id: number
  name: string
  license_no: string
  wilaya_id?: number | null
  city: string
  phone: string
  desc: string
  fleet: { id: number; kind: string; plate: string; seats: number; medical: boolean; active: boolean }[]
  guides: { id: number; name: string; langs: string; phone: string; license: string }[]
  packages: HealthPackage[]
}

export interface HealthPackage {
  id: number
  title: string
  destination: string
  nights: number
  price: number
  includes: string
  treatments: string
  agency_id?: number | null
  station_id?: number | null
}

export interface ThermalStation {
  id: number
  name: string
  wilaya_id?: number | null
  lat: number
  lng: number
  treatments: string
  water_temp: number
  services: string
  rating_avg: number
  reviews?: { id: number; stars: number; comment: string; user_name: string }[]
  packages?: HealthPackage[]
}

export interface ThermalBooking {
  id: number
  station_id: number
  station_name?: string
  package_id?: number | null
  patient_name: string
  agency_id?: number | null
  date_start: string
  date_end: string
  price: number
  insurance: boolean
  insurance_label?: string
  doctor_approved?: boolean | null
  doctor_name?: string
  status: string
  created_by?: string
  created_at?: string
}

export interface ThermalReport {
  total: number
  approved: number
  pending: number
  revenue_dzd: number
  insured: number
  doc_approved: number
  top_stations: { name: string; count: number }[]
}

export interface Review {
  id?: number
  target_type: string
  target_id: number
  stars: number
  comment: string
  user_name?: string
}

export const ROLE_INFO: Record<string, { title: string; desc: string; icon: string }> = {
  admin: { title: 'مدير وطني', desc: 'لوحة الإدارة الوطنية والمراقبة', icon: '🏛️' },
  doctor: { title: 'مستشفى / طبيب', desc: 'المعاينات والبروتوكولات العلاجية', icon: '🏥' },
  nurse: { title: 'ممرض متنقل', desc: 'الزيارات المنزلية والقياسات الميدانية', icon: '🩺' },
  patient: { title: 'مستفيد', desc: 'ملفي الصحي وخدمات الرعاية', icon: '🧑‍🦳' },
  family: { title: 'عائلة / مرافق', desc: 'متابعة ومرافقة المريض', icon: '👨‍👩‍👧' },
  dass: { title: 'DASS', desc: 'النشاط الاجتماعي والتضامن', icon: '🤝' },
  agency: { title: 'وكالة سياحة وأسفار', desc: 'الرحلات العلاجية والمرشدون السياحيون', icon: '🧭' },
  thermal: { title: 'السياحة العلاجية والحمامات', desc: 'الحمامات المعدنية والمسارات العلاجية', icon: '♨️' },
  pharmacist: { title: 'صيدلي', desc: 'الروشتات الإلكترونية والمخزون والصرف', icon: '💊' },
  researcher: { title: 'من نحن وفكرة المنصة', desc: 'السيرة الذاتية والمذكرة الأكاديمية', icon: '🎓' },
}

export interface InLink {
  id: number
  a?: InstitutionRef | null
  b?: InstitutionRef | null
  active: boolean
}

export interface Association {
  id: number
  name: string
  wilaya_ar?: string | null
  wilaya_fr?: string | null
  volunteers: number
  visits: number
  activities: number
  points: number
  stars: number
  last_evaluated_at?: string | null
  reward?: { badge: string; reward: string }
}

export interface AdminStats {
  staff: number; doctors: number; nurses: number; patients: number
  referrals: number; pending: number; accepted: number; red_alerts: number
  associations: number; total_points: number
  units: number; hospitals: number; links: number; users: number; wilayas: number
  followups: number; shifts: number; zones: number
  agencies: number; packages: number; stations: number
  bookings: number; reviews: number
  alerts: number; alerts_open: number
  pharmacies: number; rx_total: number; rx_open: number; low_stock: number
  consents: number; careplans: number; psych_runs: number; tele_pending: number
  sos_fired: number; bg_active: number
  by_status: Record<string, number>
  top_association: { name: string; points: number; stars: number } | null
}

export const DEMO_USERNAME: Record<string, string> = {
  admin: 'admin',
  doctor: 'doctor_1',
  nurse: 'nurse_1',
  patient: 'patient_1',
  family: 'family_1',
  dass: 'dass_1',
  agency: 'agency_1',
  thermal: 'thermal_1',
  pharmacist: 'pharma_1',
  researcher: 'researcher_1',
}

// =================  المرحلة 2α — الأنواع الجديدة  =================

export interface Pharmacy {
  id: number; name: string; wilaya_id?: number | null; city: string; phone: string
  manager: string; license_no: string; open_24: boolean; items: number; low: number
}

export interface InventoryItem {
  id: number; pharmacy_id: number; pharmacy: string; drug: string; strength: string
  form: string; qty: number; min_level: number; low: boolean
}

export interface RxItem {
  drug: string; strength: string; dosage: string; duration: string; qty: number
}

export interface Prescription {
  id: number; ref: string; patient_name: string; doctor_name: string; institution: string
  purpose: string; notes: string; status: string; created_at?: string | null
  dispensed_by?: string; dispensed_at?: string | null; items: RxItem[]
}

export interface Consent {
  id: number; ref: string; patient_name: string; type: string; type_label: string
  grantor: string; granted_to: string; scope: string; signed: boolean
  expires_on: string; revoked: boolean; created_at?: string | null
}

export interface CarePlan {
  id: number; patient_name: string; doctor_name: string; title: string; summary: string
  goals: { g: string; done: boolean }[]; schedule: { task: string; when: string }[]
  active: boolean; created_at?: string | null
}

export interface PsychScreen {
  id: number; patient_name: string; kind: string; score: number; level: string
  advice: string; created_at?: string | null
}

export interface PsychSession {
  id: number; patient_name: string; specialist: string; kind: string; slot: string
  reason: string; status: string; created_by?: string; created_at?: string | null
}

export interface SosDispatch {
  id: number; ref: string; patient_name: string; phone: string; lat: number; lng: number
  detail: string; channel: string; status: string; resolved_by?: string
  created_at?: string | null; maps?: string
}

export interface BreakGlass {
  id: number; requester: string; role: string; reason: string; otp_plain?: string
  otp_used: boolean; status: string; expires_at?: string | null; granted_at?: string | null
  released_at?: string | null; created_at?: string | null
}