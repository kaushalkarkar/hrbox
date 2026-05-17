export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type LeaveType = 'SICK' | 'CASUAL' | 'PAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface EmployeeSummary {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

export interface LoginResponse {
  token: string;
  userId: number;
  email: string;
  role: Role;
  employee: EmployeeSummary | null;
}

export interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  designation?: string;
  departmentId?: number | null;
  departmentName?: string | null;
  managerId?: number | null;
  managerName?: string | null;
  joinedOn: string;
  photoFilename?: string | null;
}

export interface EmployeeCreate {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  designation?: string;
  departmentId?: number | null;
  managerId?: number | null;
  joinedOn: string;
  initialPassword: string;
  role: Role;
}

export interface EmployeeUpdate {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  designation?: string;
  departmentId?: number | null;
  managerId?: number | null;
  joinedOn: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface Leave {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  decidedByName: string | null;
  decisionComment: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface LeaveApply {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface LeaveBalance {
  year: number;
  type: LeaveType;
  allocated: number;
  used: number;
  remaining: number;
}

export type AttendanceStatus = 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND';

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  late: boolean;
  workingMinutes: number | null;
}

export interface AttendanceDay {
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  late: boolean;
  workingMinutes: number | null;
  note: string | null;
}

export interface MonthSummary {
  year: number;
  month: number;
  present: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  holiday: number;
  weekend: number;
  lateMarks: number;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  description: string | null;
}

export type NotificationType =
  | 'LEAVE_APPLIED' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED'
  | 'PAYSLIP_RELEASED' | 'PASSWORD_RESET' | 'PASSWORD_CHANGED'
  | 'GENERIC';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface SalaryStructure {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  effectiveFrom: string;
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
  grossMonthly: number;
  netMonthly: number;
}

export interface SalaryStructureRequest {
  effectiveFrom: string;
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
}

export interface Payslip {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  year: number;
  month: number;
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
  grossSalary: number;
  netSalary: number;
  workingDays: number;
  paidDays: number;
  generatedAt: string;
}

export interface PayslipGenerateResult {
  generated: number;
  skippedNoStructure: number;
  alreadyExisted: number;
}

export interface OrgNode {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  departmentName: string | null;
  photoFilename: string | null;
}

export interface OrgChart {
  chain: OrgNode[];
  reports: OrgNode[];
}

export type GoalStatus = 'DRAFT' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface Goal {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  weight: number;
  progress: number;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string | null;
}

export interface GoalCreate {
  title: string;
  description?: string;
  targetDate?: string | null;
  weight?: number;
}

export interface GoalUpdate {
  title: string;
  description?: string;
  targetDate?: string | null;
  weight?: number;
  progress?: number;
  status?: GoalStatus;
}

export interface PerformanceReview {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  period: string;
  rating: number;
  comments: string | null;
  reviewerName: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ReviewRequest {
  period: string;
  rating: number;
  comments?: string;
}

export type DocumentCategory =
  | 'AADHAR' | 'PAN' | 'PASSPORT' | 'RESUME'
  | 'OFFER_LETTER' | 'CONTRACT' | 'PAYSLIP' | 'CERTIFICATE' | 'OTHER';

export interface EmployeeDocument {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  category: DocumentCategory;
  filename: string;
  sizeBytes: number;
  contentType: string;
  description: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
}

export type ExpenseCategory =
  | 'TRAVEL' | 'FOOD' | 'INTERNET' | 'PHONE'
  | 'OFFICE_SUPPLIES' | 'TRAINING' | 'OTHER';

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Expense {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  expenseDate: string;
  description: string | null;
  status: ExpenseStatus;
  decidedByName: string | null;
  decisionComment: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface ExpenseSubmit {
  category: ExpenseCategory;
  amount: number;
  currency: string;
  expenseDate: string;
  description?: string;
}

export interface ExpenseStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvedThisMonth: number;
  currency: string;
}

export type PolicyCategory =
  | 'LEAVE' | 'ATTENDANCE' | 'CODE_OF_CONDUCT' | 'REMOTE_WORK'
  | 'SECURITY' | 'EXPENSE' | 'IT' | 'HR_GENERAL';

export interface PolicySummary {
  id: number;
  title: string;
  category: PolicyCategory;
  summary: string | null;
  version: string;
  effectiveFrom: string;
  acknowledged: boolean;
}

export interface Policy {
  id: number;
  title: string;
  category: PolicyCategory;
  summary: string | null;
  contentMarkdown: string;
  version: string;
  effectiveFrom: string;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  ackCount: number;
}

export interface PolicyRequest {
  title: string;
  category: PolicyCategory;
  summary?: string;
  contentMarkdown: string;
  version: string;
  effectiveFrom?: string;
}

export type TicketCategory = 'IT' | 'HR' | 'PAYROLL' | 'FACILITY' | 'SECURITY' | 'OTHER';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus   = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface Ticket {
  id: number;
  raisedById: number;
  raisedByCode: string;
  raisedByName: string;
  assigneeId: number | null;
  assigneeName: string | null;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  resolution: string | null;
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
}

export interface TicketCreate {
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
}

export interface TicketStats {
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  closedCount: number;
}

export type TravelMode = 'FLIGHT' | 'TRAIN' | 'BUS' | 'CAB' | 'OWN_VEHICLE' | 'OTHER';
export type TravelStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BOOKED' | 'COMPLETED' | 'CANCELLED';

export interface TravelRequest {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  mode: TravelMode;
  purpose: string;
  estimatedCost: number;
  currency: string;
  accommodation: string | null;
  status: TravelStatus;
  decidedByName: string | null;
  decisionComment: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface TravelSubmit {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  mode: TravelMode;
  purpose: string;
  estimatedCost?: number;
  currency?: string;
  accommodation?: string;
}

export interface TravelStats {
  pendingCount: number;
  approvedCount: number;
  bookedCount: number;
  completedCount: number;
  totalApprovedCost: number;
}

export type TaskType =
  | 'LEAVE_APPROVAL' | 'EXPENSE_APPROVAL' | 'TRAVEL_APPROVAL'
  | 'TICKET_ASSIGNED' | 'POLICY_ACK'
  | 'MY_LEAVE' | 'MY_EXPENSE' | 'MY_TRAVEL';

export interface TaskItem {
  type: TaskType;
  id: number;
  title: string;
  subtitle: string;
  status: string;
  createdAt: string;
  link: string;
  pillColor: 'amber' | 'red' | 'blue' | 'violet' | 'gray';
}

export interface TaskBoxView {
  total: number;
  approvals: TaskItem[];
  assignedToMe: TaskItem[];
  policyAcks: TaskItem[];
  myPending: TaskItem[];
}

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type JobStatus = 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'CLOSED';
export type ApplicationStage = 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';

export interface Job {
  id: number;
  title: string;
  departmentId: number | null;
  departmentName: string | null;
  location: string | null;
  employmentType: EmploymentType;
  description: string | null;
  minExperienceYears: number;
  openings: number;
  status: JobStatus;
  postedByName: string | null;
  postedOn: string | null;
  closedOn: string | null;
  applicantCount: number;
  stageCounts: Record<ApplicationStage, number>;
}

export interface JobRequest {
  title: string;
  departmentId?: number | null;
  location?: string;
  employmentType: EmploymentType;
  description?: string;
  minExperienceYears?: number;
  openings?: number;
  status?: JobStatus;
}

export interface Candidate {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  currentCompany: string | null;
  yearsOfExperience: number | null;
  source: string;
  referrerName: string | null;
  resumeFilename: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CandidateRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  currentCompany?: string;
  yearsOfExperience?: number;
  source?: string;
  referrerId?: number | null;
  notes?: string;
}

export interface JobApplication {
  id: number;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  jobId: number;
  jobTitle: string;
  stage: ApplicationStage;
  latestNote: string | null;
  lastMovedByName: string | null;
  appliedAt: string;
  lastStageChangeAt: string;
}

export type PostCategory = 'ANNOUNCEMENT' | 'KUDOS' | 'EVENT' | 'QUESTION' | 'GENERAL';
export type ReactionType = 'LIKE' | 'CELEBRATE' | 'INSIGHTFUL' | 'HEART';

export interface VibeAuthor {
  id: number;
  name: string;
  employeeCode: string;
  designation: string | null;
  departmentName: string | null;
  photoFilename: string | null;
}

export interface VibePost {
  id: number;
  category: PostCategory;
  body: string;
  pinned: boolean;
  author: VibeAuthor;
  subject: VibeAuthor | null;
  createdAt: string;
  commentCount: number;
  reactionCounts: Record<ReactionType, number>;
  myReactions: ReactionType[];
}

export interface VibeComment {
  id: number;
  author: VibeAuthor;
  body: string;
  createdAt: string;
}

export interface VibePostDetail {
  post: VibePost;
  comments: VibeComment[];
}

export interface CreatePostRequest {
  category: PostCategory;
  body: string;
  subjectEmployeeId?: number | null;
  pinned?: boolean;
}
