import axios from "axios";

const BASE_URL = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) || "http://localhost:8080";

export type BackendAuthSession = {
  token: string;
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId?: string | null;
  initials?: string | null;
};

export type BackendAppUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  initials?: string | null;
  schoolId?: string | null;
  phone?: string | null;
  active?: boolean;
};

export type BackendSchoolCampus = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  district?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  status?: string | null;
  levels?: string[] | null;
  studentCount?: number | null;
  teacherCount?: number | null;
};

export type BackendSchool = {
  id: string;
  name: string;
  shortCode: string;
  motto?: string | null;
  district?: string | null;
  province?: string | null;
  type?: string | null;
  ownership?: string | null;
  category?: string | null;
  gender?: string | null;
  curriculum?: string | null;
  languageOfInstruction?: string | null;
  email?: string | null;
  phone?: string | null;
  altPhone?: string | null;
  website?: string | null;
  physicalAddress?: string | null;
  poBox?: string | null;
  city?: string | null;
  postalCode?: string | null;
  gpsCoordinates?: string | null;
  headTeacher?: string | null;
  headTeacherEmail?: string | null;
  deputyHead?: string | null;
  boardChair?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  logoUrl?: string | null;
  reportFooter?: string | null;
  registrationNo?: string | null;
  tpinNo?: string | null;
  moeCode?: string | null;
  examCentreNo?: string | null;
  yearFounded?: number | null;
  weekStart?: string | null;
  gradingScale?: string | null;
  passMark?: number | null;
  currency?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankBranch?: string | null;
  termStart?: string | null;
  termEnd?: string | null;
  currentTerm?: number;
  currentYear?: number;
  totalStudents?: number;
  totalTeachers?: number;
  totalClasses?: number;
  subscriptionStatus?: string | null;
  planId?: string | null;
  billingCycle?: string | null;
  amount?: number | null;
  campusLimit?: number | null;
  nextInvoiceDate?: string | null;
  renewalDate?: string | null;
  learnerLimit?: number;
  smsQuota?: number | null;
  smsUsed?: number | null;
  supportLevel?: string | null;
  billingContact?: string | null;
  notes?: string | null;
  offlineMode?: boolean | null;
  levels?: string[] | null;
  campuses?: BackendSchoolCampus[] | null;
  features?: Record<string, boolean> | null;
  active?: boolean;
};

export type BackendSchoolDto = {
  name?: string;
  shortCode?: string;
  motto?: string;
  district?: string;
  province?: string;
  type?: string;
  ownership?: string;
  category?: string;
  gender?: string;
  curriculum?: string;
  languageOfInstruction?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  website?: string;
  physicalAddress?: string;
  poBox?: string;
  city?: string;
  postalCode?: string;
  gpsCoordinates?: string;
  headTeacher?: string;
  headTeacherEmail?: string;
  deputyHead?: string;
  boardChair?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  reportFooter?: string;
  registrationNo?: string;
  tpinNo?: string;
  moeCode?: string;
  examCentreNo?: string;
  yearFounded?: number;
  weekStart?: string;
  gradingScale?: string;
  passMark?: number;
  currency?: string;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  termStart?: string;
  termEnd?: string;
  currentTerm?: number;
  currentYear?: number;
  totalStudents?: number;
  totalTeachers?: number;
  totalClasses?: number;
  planId?: string;
  billingCycle?: string;
  amount?: number;
  campusLimit?: number;
  nextInvoiceDate?: string;
  renewalDate?: string;
  learnerLimit?: number;
  smsQuota?: number;
  smsUsed?: number;
  supportLevel?: string;
  billingContact?: string;
  notes?: string;
  offlineMode?: boolean;
  subscriptionStatus?: string;
  active?: boolean;
  levels?: string[];
  campuses?: BackendSchoolCampus[];
  features?: Record<string, boolean>;
};

export type PlatformWorkspaceRecord = Record<string, any>;

export type BackendPlatformWorkspace = {
  plans?: PlatformWorkspaceRecord[];
  addOns?: PlatformWorkspaceRecord[];
  promotions?: PlatformWorkspaceRecord[];
  supportTickets?: PlatformWorkspaceRecord[];
  supportSettings?: Record<string, any>;
  approvalItems?: PlatformWorkspaceRecord[];
  approvalPolicies?: Record<string, boolean>;
  statusIncidents?: PlatformWorkspaceRecord[];
  maintenanceWindows?: PlatformWorkspaceRecord[];
  statusSettings?: Record<string, any>;
  tenantHandoffs?: PlatformWorkspaceRecord[];
  tenantSuccessOverrides?: Record<string, any>;
  tenantLifecycleOverrides?: Record<string, any>;
  partners?: PlatformWorkspaceRecord[];
  partnerDeals?: PlatformWorkspaceRecord[];
  contracts?: PlatformWorkspaceRecord[];
  revenueCases?: PlatformWorkspaceRecord[];
  dataRequests?: PlatformWorkspaceRecord[];
  exportJobs?: PlatformWorkspaceRecord[];
  retentionRules?: PlatformWorkspaceRecord[];
  residencySettings?: Record<string, any>;
  rollouts?: PlatformWorkspaceRecord[];
  platformSecurity?: Record<string, any>;
  platformCommunications?: Record<string, any>;
  platformDefaults?: Record<string, any>;
  developerApiKeys?: PlatformWorkspaceRecord[];
  developerWebhooks?: PlatformWorkspaceRecord[];
  developerSandboxes?: PlatformWorkspaceRecord[];
  platformAuditEvents?: PlatformWorkspaceRecord[];
  services?: PlatformWorkspaceRecord[];
  queues?: PlatformWorkspaceRecord[];
  opsIncidents?: PlatformWorkspaceRecord[];
  releases?: PlatformWorkspaceRecord[];
};

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("srms_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("srms_token");
    }
    return Promise.reject(err);
  }
);

/** Unwraps ApiResponse<T> data field */
async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await promise;
  return res.data.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidSchoolId(id: string | null | undefined): boolean {
  return Boolean(id && UUID_RE.test(id));
}

export function schoolPath(schoolId: string, path: string) {
  const storedId = typeof localStorage !== "undefined" ? localStorage.getItem("srms_school_id") : null;
  const id = storedId || schoolId;
  if (!id || id.trim().length < 2) {
    throw new Error(`No valid school ID`);
  }
  return `/api/schools/${id}/${path}`;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    unwrap<BackendAuthSession>(
      apiClient.post("/api/auth/login", { email, password })
    ),
  auth: {
    me: () => unwrap<BackendAppUser>(apiClient.get("/api/auth/me")),
  },

  // Platform workspace
  platform: {
    getWorkspace: () => unwrap<BackendPlatformWorkspace>(apiClient.get("/api/platform/workspace")),
    updateWorkspace: (data: Partial<BackendPlatformWorkspace>) =>
      unwrap<BackendPlatformWorkspace>(apiClient.put("/api/platform/workspace", data)),
  },

  // Schools / tenants
  schools: {
    list: () => unwrap<BackendSchool[]>(apiClient.get("/api/schools")),
    get: (id: string) => unwrap<BackendSchool>(apiClient.get(`/api/schools/${id}`)),
    create: (data: BackendSchoolDto) => unwrap<BackendSchool>(apiClient.post("/api/schools", data)),
    update: (id: string, data: BackendSchoolDto) => unwrap<BackendSchool>(apiClient.put(`/api/schools/${id}`, data)),
  },

  // School users
  users: {
    list: (schoolId: string) => unwrap<BackendAppUser[]>(apiClient.get(`/api/schools/${schoolId}/users`)),
    create: (schoolId: string, data: { name: string; email: string; role: string; password?: string; phone?: string }) =>
      unwrap<BackendAppUser>(apiClient.post(`/api/schools/${schoolId}/users`, data)),
    updateForSchool: (schoolId: string, userId: string, data: { role?: string; phone?: string; active?: boolean }) =>
      unwrap<BackendAppUser>(apiClient.patch(`/api/schools/${schoolId}/users/${userId}`, data)),
    deleteForSchool: (schoolId: string, userId: string) => apiClient.delete(`/api/schools/${schoolId}/users/${userId}`),
    all: () => unwrap<BackendAppUser[]>(apiClient.get("/api/admin/users")),
    createGlobal: (data: { name: string; email: string; role: string; password?: string; phone?: string; schoolId?: string }) =>
      unwrap<BackendAppUser>(apiClient.post("/api/admin/users", data)),
    update: (userId: string, data: { role?: string; phone?: string; active?: boolean; schoolId?: string }) =>
      unwrap<BackendAppUser>(apiClient.patch(`/api/admin/users/${userId}`, data)),
    delete: (userId: string) => apiClient.delete(`/api/admin/users/${userId}`),
  },

  // Dashboard
  dashboard: (schoolId: string) =>
    unwrap<any>(apiClient.get(schoolPath(schoolId, "dashboard"))),

  // Students
  students: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "students"))),
    get: (schoolId: string, id: string) => unwrap<any>(apiClient.get(schoolPath(schoolId, `students/${id}`))),
    listByGuardian: (schoolId: string, email: string) =>
      unwrap<any[]>(apiClient.get(schoolPath(schoolId, "students/by-guardian"), { params: { email } })),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "students"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `students/${id}`), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `students/${id}`)),
  },

  // Teachers
  teachers: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "teachers"))),
    get: (schoolId: string, id: string) => unwrap<any>(apiClient.get(schoolPath(schoolId, `teachers/${id}`))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "teachers"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `teachers/${id}`), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `teachers/${id}`)),
  },

  // Classes
  classes: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "classes"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "classes"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `classes/${id}`), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `classes/${id}`)),
    // Class enrolments
    enrolments: (schoolId: string, classId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, `classes/${classId}/enrolments`))),
    enrolStudent: (schoolId: string, classId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, `classes/${classId}/enrolments`), data)),
    removeEnrolment: (schoolId: string, classId: string, enrolmentId: string) => apiClient.delete(schoolPath(schoolId, `classes/${classId}/enrolments/${enrolmentId}`)),
    // Teacher-subject assignments
    classTeachers: (schoolId: string, classId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, `classes/${classId}/teachers`))),
    assignTeacher: (schoolId: string, classId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, `classes/${classId}/teachers`), data)),
    removeTeacher: (schoolId: string, classId: string, assignmentId: string) => apiClient.delete(schoolPath(schoolId, `classes/${classId}/teachers/${assignmentId}`)),
  },

  // Departments
  departments: {
    list:   (schoolId: string)                    => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "departments"))),
    create: (schoolId: string, data: any)         => unwrap<any>(apiClient.post(schoolPath(schoolId, "departments"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `departments/${id}`), data)),
    delete: (schoolId: string, id: string)        => apiClient.delete(schoolPath(schoolId, `departments/${id}`)),
  },

  // Custom roles & permissions
  roles: {
    list:           (schoolId: string)                                      => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "roles"))),
    create:         (schoolId: string, data: any)                           => unwrap<any>(apiClient.post(schoolPath(schoolId, "roles"), data)),
    update:         (schoolId: string, id: string, data: any)               => unwrap<any>(apiClient.put(schoolPath(schoolId, `roles/${id}`), data)),
    delete:         (schoolId: string, id: string)                          => apiClient.delete(schoolPath(schoolId, `roles/${id}`)),
    getPermissions: (schoolId: string, roleName: string)                    => unwrap<any[]>(apiClient.get(schoolPath(schoolId, `roles/${roleName}/permissions`))),
    savePermissions:(schoolId: string, roleName: string, data: any[])       => unwrap<any[]>(apiClient.put(schoolPath(schoolId, `roles/${roleName}/permissions`), data)),
  },

  // Subjects
  subjects: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "subjects"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "subjects"), data)),
    bulk: (schoolId: string, data: any[]) => unwrap<any[]>(apiClient.post(schoolPath(schoolId, "subjects/bulk"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `subjects/${id}`), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `subjects/${id}`)),
  },

  // Attendance
  attendance: {
    summary: (schoolId: string) => unwrap<any>(apiClient.get(schoolPath(schoolId, "attendance/summary"))),
    byDate: (schoolId: string, date: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, `attendance/date/${date}`))),
    mark: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "attendance"), data)),
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "attendance"))),
  },

  // Assessments
  assessments: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "assessments"))),
    get: (schoolId: string, id: string) => unwrap<any>(apiClient.get(schoolPath(schoolId, `assessments/${id}`))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "assessments"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `assessments/${id}`), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `assessments/${id}`)),
    results: (schoolId: string, id: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, `assessments/${id}/results`))),
    studentResults: (schoolId: string, studentId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, `assessments/student/${studentId}`))),
  },

  // Report comments
  reportComments: {
    get: (schoolId: string, studentId: string, term: string, academicYear: string) =>
      unwrap<any>(apiClient.get(schoolPath(schoolId, `report-comments/student/${studentId}`), { params: { term, academicYear } })),
    upsert: (schoolId: string, studentId: string, term: string, academicYear: string, data: { teacherComment: string; headComment: string }) =>
      unwrap<any>(apiClient.put(schoolPath(schoolId, `report-comments/student/${studentId}`), data, { params: { term, academicYear } })),
  },

  // Fees
  fees: {
    payments: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "fees/payments"))),
    collected: async (schoolId: string) => {
      const data = await unwrap<any>(apiClient.get(schoolPath(schoolId, "fees/collected")));
      if (typeof data === "number") {
        return { collected: data, outstanding: 0, collectionRate: 0 };
      }
      return {
        collected: Number(data?.collected ?? 0),
        outstanding: Number(data?.outstanding ?? 0),
        collectionRate: Number(data?.collectionRate ?? 0),
      };
    },
    structures: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "fees/structures"))),
    createStructure: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "fees/structures"), data)),
    updateStructure: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `fees/structures/${id}`), data)),
    recordPayment: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "fees/payments"), data)),
    studentPayments: (schoolId: string, studentId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, `fees/payments/student/${studentId}`))),
    levies: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "fees/levies"))),
    createLevy: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "fees/levies"), data)),
    deleteLevy: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `fees/levies/${id}`)),
    discounts: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "fees/discounts"))),
    createDiscount: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "fees/discounts"), data)),
    updateDiscount: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `fees/discounts/${id}`), data)),
    billingRules: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "fees/billing-rules"))),
    createBillingRule: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "fees/billing-rules"), data)),
    updateBillingRule: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `fees/billing-rules/${id}`), data)),
  },

  // Communication
  communication: {
    announcements: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "announcements"))),
    createAnnouncement: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "announcements"), data)),
    updateAnnouncement: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `announcements/${id}`), data)),
    deleteAnnouncement: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `announcements/${id}`)),
    messages: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "messages"))),
    createMessage: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "messages"), data)),
    replyMessage: (schoolId: string, id: string, data: any) => unwrap<any>(
      apiClient.put(schoolPath(schoolId, `messages/${id}/reply`), {
        replyBody: data?.replyBody ?? data?.body ?? "",
      }),
    ),
  },

  // Discipline
  discipline: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "discipline"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "discipline"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `discipline/${id}`), data)),
    resolve: (schoolId: string, id: string) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `discipline/${id}/resolve`), {})),
  },

  // Library
  library: {
    books: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "library/books"))),
    createBook: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "library/books"), data)),
    updateBook: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `library/books/${id}`), data)),
    deleteBook: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `library/books/${id}`)),
    loans: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "library/loans"))),
    issueLoan: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "library/loans"), data)),
    returnLoan: (schoolId: string, id: string) => unwrap<any>(apiClient.put(schoolPath(schoolId, `library/loans/${id}/return`), {})),
  },

  // Transport
  transport: {
    vehicles: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "transport/vehicles"))),
    createVehicle: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "transport/vehicles"), data)),
    routes: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "transport/routes"))),
    createRoute: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "transport/routes"), data)),
    enrolments: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "transport/enrolments"))),
  },

  // HR
  hr: {
    staff: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "hr/staff"))),
    createStaff: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "hr/staff"), data)),
    updateStaff: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `hr/staff/${id}`), data)),
    leave: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "hr/leave"))),
    submitLeave: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "hr/leave"), data)),
    approveLeave: (schoolId: string, id: string) => unwrap<any>(apiClient.put(schoolPath(schoolId, `hr/leave/${id}/approve`), {})),
    rejectLeave: (schoolId: string, id: string) => unwrap<any>(apiClient.put(schoolPath(schoolId, `hr/leave/${id}/reject`), {})),
  },

  // Inventory
  inventory: {
    items: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "inventory"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "inventory"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `inventory/${id}`), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `inventory/${id}`)),
    movements: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "inventory/movements"))),
    recordMovement: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "inventory/movements"), data)),
  },

  // Hostel
  hostel: {
    rooms: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "hostel/rooms"))),
    createRoom: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "hostel/rooms"), data)),
    allocations: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "hostel/allocations"))),
    allocate: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "hostel/allocations"), data)),
    vacate: (schoolId: string, id: string) => unwrap<any>(apiClient.put(schoolPath(schoolId, `hostel/allocations/${id}/vacate`), {})),
    updateRoom: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `hostel/rooms/${id}`), data)),
    deleteRoom: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `hostel/rooms/${id}`)),
    leaves: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "hostel/leaves"))),
    createLeave: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "hostel/leaves"), data)),
    updateLeaveStatus: (schoolId: string, id: string, status: string) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `hostel/leaves/${id}/status`), null, { params: { status } })),
  },

  // Health
  health: {
    records: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "health/records"))),
    createRecord: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "health/records"), data)),
    updateRecord: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `health/records/${id}`), data)),
    visits: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "health/visits"))),
    createVisit: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "health/visits"), data)),
  },

  // Canteen
  canteen: {
    menu: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "canteen/menu"))),
    createMenuItem: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "canteen/menu"), data)),
    updateMenuItem: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `canteen/menu/${id}`), data)),
    orders: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "canteen/orders"))),
    createOrder: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "canteen/orders"), data)),
  },

  // Activities
  activities: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "activities"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "activities"), data)),
    enrolments: (schoolId: string, id: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, `activities/${id}/enrolments`))),
  },

  // Alumni
  alumni: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "alumni"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "alumni"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `alumni/${id}`), data)),
  },

  // Visitors
  visitors: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "visitors"))),
    checkIn: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "visitors"), data)),
    checkOut: (schoolId: string, id: string) => unwrap<any>(apiClient.put(schoolPath(schoolId, `visitors/${id}/checkout`), {})),
  },

  // Lost & Found
  lostFound: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "lost-found"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "lost-found"), data)),
    claim: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `lost-found/${id}/claim`), data)),
  },

  // Admissions
  admissions: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "admissions"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "admissions"), data)),
    accept: (schoolId: string, id: string) => unwrap<any>(apiClient.put(schoolPath(schoolId, `admissions/${id}/accept`), {})),
    reject: (schoolId: string, id: string) => unwrap<any>(apiClient.put(schoolPath(schoolId, `admissions/${id}/reject`), {})),
  },

  // Timetable
  timetable: {
    list: (schoolId: string, classId?: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "timetable"), { params: classId ? { classId } : {} })),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "timetable"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `timetable/${id}`), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `timetable/${id}`)),
  },

  // Payroll
  payroll: {
    runs: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "payroll/runs"))),
    createRun: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "payroll/runs"), data)),
    payslips: (schoolId: string, runId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, `payroll/runs/${runId}/payslips`))),
    processRun: (schoolId: string, id: string) => unwrap<any>(apiClient.post(schoolPath(schoolId, `payroll/runs/${id}/process`), {})),
  },

  // Exams
  exams: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "exams"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "exams"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `exams/${id}`), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `exams/${id}`)),
  },

  // Student Welfare
  welfare: {
    cases: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "welfare/cases"))),
    createCase: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "welfare/cases"), data)),
    updateCase: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `welfare/cases/${id}`), data)),
    sessions: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "welfare/sessions"))),
    createSession: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "welfare/sessions"), data)),
  },

  // Procurement
  procurement: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "procurement"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "procurement"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `procurement/${id}`), data)),
    approve: (schoolId: string, id: string) => apiClient.put(schoolPath(schoolId, `procurement/${id}/approve`), {}),
  },

  // Facilities
  facilities: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "facilities"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "facilities"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `facilities/${id}`), data)),
    close: (schoolId: string, id: string) => apiClient.patch(schoolPath(schoolId, `facilities/${id}/close`), {}),
  },

  // Bursaries
  bursaries: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "bursaries"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "bursaries"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `bursaries/${id}`), data)),
    applications: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "bursaries/applications"))),
    createApplication: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "bursaries/applications"), data)),
    updateApplication: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `bursaries/applications/${id}`), data)),
    renewals: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "bursaries/renewals"))),
    createRenewal: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "bursaries/renewals"), data)),
    updateRenewal: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `bursaries/renewals/${id}`), data)),
  },

  // Calendar
  calendar: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "calendar"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "calendar"), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `calendar/${id}`)),
  },

  // Duty Roster
  dutyRoster: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "duty-roster"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "duty-roster"), data)),
    delete: (schoolId: string, id: string) => apiClient.delete(schoolPath(schoolId, `duty-roster/${id}`)),
  },

  // Staff Development
  staffDevelopment: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "staff-development"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "staff-development"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `staff-development/${id}`), data)),
    appraisals: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "staff-development/appraisals"))),
    createAppraisal: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "staff-development/appraisals"), data)),
    updateAppraisal: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `staff-development/appraisals/${id}`), data)),
    observations: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "staff-development/observations"))),
    createObservation: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "staff-development/observations"), data)),
    pdps: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "staff-development/pdps"))),
    createPdp: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "staff-development/pdps"), data)),
    updatePdp: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `staff-development/pdps/${id}`), data)),
  },

  // Vendors
  vendors: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "vendors"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "vendors"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `vendors/${id}`), data)),
  },

  // Compliance
  compliance: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "compliance"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "compliance"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `compliance/${id}`), data)),
  },

  // Risk Register
  riskRegister: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "risk-register"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "risk-register"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `risk-register/${id}`), data)),
  },

  // Incidents
  incidents: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "incidents"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "incidents"), data)),
    update: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.put(schoolPath(schoolId, `incidents/${id}`), data)),
    resolve: (schoolId: string, id: string) => apiClient.patch(schoolPath(schoolId, `incidents/${id}/resolve`), {}),
  },

  // Strategic Plan
  strategicPlan: {
    goals: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "strategic-plan/goals"))),
    createGoal: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "strategic-plan/goals"), data)),
    updateGoal: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `strategic-plan/goals/${id}`), data)),
    actions: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "strategic-plan/actions"))),
    createAction: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "strategic-plan/actions"), data)),
    updateAction: (schoolId: string, id: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `strategic-plan/actions/${id}`), data)),
    reviews: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "strategic-plan/reviews"))),
    createReview: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "strategic-plan/reviews"), data)),
  },

  // Accounting
  accounting: {
    journalEntries: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "accounting/journal"))),
    createJournalEntry: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "accounting/journal"), data)),
    postJournalEntry: (schoolId: string, id: string) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `accounting/journal/${id}/post`), {})),
    expenses: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "accounting/expenses"))),
    createExpense: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "accounting/expenses"), data)),
  },

  // Reporting
  reporting: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "reporting/reports"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "reporting/reports"), data)),
  },

  // Integrations
  integrations: {
    list: (schoolId: string) => unwrap<any[]>(apiClient.get(schoolPath(schoolId, "integrations"))),
    create: (schoolId: string, data: any) => unwrap<any>(apiClient.post(schoolPath(schoolId, "integrations"), data)),
    update: (schoolId: string, code: string, data: any) => unwrap<any>(apiClient.patch(schoolPath(schoolId, `integrations/${code}`), data)),
  },
};
