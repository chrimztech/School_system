export type ApplicantStage = "Inquiry" | "Assessment" | "Offer" | "Enrolled";
export type ApplicantPriority = "High" | "Normal" | "Watch";

export type Applicant = {
  id: string;
  learner: string;
  applyingFor: string;
  guardian: string;
  contact: string;
  source: string;
  stage: ApplicantStage;
  priority: ApplicantPriority;
  updatedAt: string;
};

export const admissionsApplicants: Applicant[] = [
  {
    id: "A-204",
    learner: "Mwaka Tembo",
    applyingFor: "Grade 8",
    guardian: "Joseph Tembo",
    contact: "+260 977 445 222",
    source: "Website",
    stage: "Assessment",
    priority: "High",
    updatedAt: "2026-05-21",
  },
  {
    id: "A-198",
    learner: "Brian Chibesa",
    applyingFor: "Grade 10",
    guardian: "Martha Chibesa",
    contact: "+260 966 312 019",
    source: "Referral",
    stage: "Offer",
    priority: "Normal",
    updatedAt: "2026-05-20",
  },
  {
    id: "A-193",
    learner: "Naomi Sakala",
    applyingFor: "Grade 4",
    guardian: "Peter Sakala",
    contact: "+260 955 213 877",
    source: "Walk-in",
    stage: "Inquiry",
    priority: "Watch",
    updatedAt: "2026-05-19",
  },
  {
    id: "A-189",
    learner: "Daniel Mwila",
    applyingFor: "Grade 12",
    guardian: "Ruth Mwila",
    contact: "+260 977 889 611",
    source: "Scholarship partner",
    stage: "Enrolled",
    priority: "High",
    updatedAt: "2026-05-18",
  },
];

export const admissionsChecklist = [
  { name: "Birth certificate", owner: "Admissions", status: "Verified" },
  { name: "Previous report card", owner: "Academics", status: "Pending" },
  { name: "Fee commitment form", owner: "Finance", status: "Verified" },
  { name: "Medical disclosure", owner: "Clinic", status: "Review" },
];

export type ProcurementRequest = {
  id: string;
  requester: string;
  department: string;
  item: string;
  amount: number;
  priority: "Critical" | "Standard" | "Low";
  status: "Draft" | "Pending approval" | "Approved" | "Ordered";
  vendor: string;
};

export const procurementRequests: ProcurementRequest[] = [
  {
    id: "PR-882",
    requester: "ICT Office",
    department: "Technology",
    item: "Chromebook lab refresh",
    amount: 184000,
    priority: "Critical",
    status: "Pending approval",
    vendor: "ZamTech Supplies",
  },
  {
    id: "PR-877",
    requester: "Procurement",
    department: "Operations",
    item: "Boarding mattress replacement",
    amount: 96000,
    priority: "Standard",
    status: "Approved",
    vendor: "Greenfield Interiors",
  },
  {
    id: "PR-869",
    requester: "Science Department",
    department: "Academics",
    item: "Chemistry lab reagents",
    amount: 38200,
    priority: "Critical",
    status: "Ordered",
    vendor: "EduLab Africa",
  },
  {
    id: "PR-861",
    requester: "Finance Office",
    department: "Finance",
    item: "Receipt printer spares",
    amount: 11200,
    priority: "Low",
    status: "Draft",
    vendor: "Mweb Consulting",
  },
];

export const procurementContracts = [
  { vendor: "ZamTech Supplies", category: "ICT & hardware", expiresOn: "2026-07-08", owner: "Procurement", risk: "Review" },
  { vendor: "Greenfield Foods", category: "Boarding meals", expiresOn: "2026-09-15", owner: "Operations", risk: "Healthy" },
  { vendor: "Nkonde Transport", category: "Transport services", expiresOn: "2026-06-02", owner: "Transport", risk: "High" },
  { vendor: "EduLab Africa", category: "Science materials", expiresOn: "2027-01-11", owner: "Academics", risk: "Healthy" },
];

export const procurementApprovals = [
  { name: "Two-step purchasing", detail: "All requests above K 50,000 require school admin and finance approval.", status: "Active" },
  { name: "Vendor due diligence", detail: "TPIN, banking, and conflict-of-interest checks tracked centrally.", status: "Active" },
  { name: "Contract renewals", detail: "7 vendor agreements expire in the next 60 days.", status: "Needs review" },
];

export type WorkOrder = {
  id: string;
  title: string;
  location: string;
  owner: string;
  priority: "High" | "Medium" | "Low";
  status: "Open" | "Scheduled" | "In progress" | "Closed";
  dueDate: string;
};

export const facilityWorkOrders: WorkOrder[] = [
  {
    id: "WO-514",
    title: "Repair leaking roof panel",
    location: "Grade 9 Block",
    owner: "Maintenance",
    priority: "High",
    status: "In progress",
    dueDate: "2026-05-23",
  },
  {
    id: "WO-509",
    title: "Replace dormitory corridor lights",
    location: "Boarding House B",
    owner: "Electrical team",
    priority: "Medium",
    status: "Scheduled",
    dueDate: "2026-05-25",
  },
  {
    id: "WO-503",
    title: "Service fire extinguishers",
    location: "Admin block",
    owner: "Safety officer",
    priority: "High",
    status: "Open",
    dueDate: "2026-05-24",
  },
  {
    id: "WO-497",
    title: "Fix science lab sink drainage",
    location: "Lab 2",
    owner: "Facilities",
    priority: "Low",
    status: "Closed",
    dueDate: "2026-05-18",
  },
];

export const facilityAssets = [
  { name: "Main generator", category: "Power", status: "Healthy", coverage: "94% uptime" },
  { name: "Bus fleet", category: "Transport", status: "Review", coverage: "1 bus in maintenance" },
  { name: "Computer labs", category: "Technology", status: "Healthy", coverage: "2 labs fully operational" },
  { name: "Water storage", category: "Utilities", status: "Watch", coverage: "Tank inspection due" },
];

export const maintenanceCalendar = [
  { title: "Quarterly electrical inspection", owner: "Facilities", date: "2026-05-27", type: "Safety" },
  { title: "Generator load test", owner: "Operations", date: "2026-05-29", type: "Utilities" },
  { title: "School bus servicing", owner: "Transport", date: "2026-06-01", type: "Transport" },
  { title: "Dormitory fumigation", owner: "Boarding", date: "2026-06-03", type: "Boarding" },
];
