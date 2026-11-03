/**
 * Demo data: US and Canadian jobs, staff, candidates and applications.
 *
 *   npm run db:seed
 *
 * - Always syncs permissions and built-in roles (safe to run after every deploy).
 * - Demo records are only created when the database has no jobs yet.
 * - With NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_DEMO_PASSWORD set,
 *   demo staff/candidates get real Supabase logins and sample PDF resumes are uploaded.
 *   Without them, records are created for browsing data only (no logins, no files).
 */
import { randomUUID } from "node:crypto";
import { PrismaClient, type ApplicationStatus, type Prisma, type Source } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { syncRolesAndPermissions } from "../src/modules/access-control/sync";
import { buildCandidateSnapshot } from "../src/modules/candidates/snapshot";
import { replaceCandidateSkills, replaceJobSkills } from "../src/modules/candidates/skills";
import { refreshCandidateSearchVector } from "../src/modules/candidates/search-vector";

const prisma = new PrismaClient();
const DOMAIN = process.env.SEED_EMAIL_DOMAIN ?? "example.com";
const PASSWORD = process.env.SEED_DEMO_PASSWORD;
const BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET ?? "candidate-documents";
const supabase: SupabaseClient | null =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && PASSWORD
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const dateIn = (n: number) => new Date(`${new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)}T00:00:00.000Z`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function authUser(email: string, metadata: Record<string, string>): Promise<string> {
  if (!supabase) return randomUUID();
  const { data, error } = await supabase.auth.admin.createUser({ email, password: PASSWORD!, email_confirm: true, user_metadata: metadata });
  if (data.user) return data.user.id;
  // Already exists from an earlier partial run.
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const found = list.users.find((u) => u.email === email);
  if (!found) throw error ?? new Error(`Could not create ${email}`);
  return found.id;
}

/** Minimal single-page PDF so demo resumes open in a browser. */
function samplePdf(lines: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 18 : 11} Tf 72 ${720 - i * 22} Td (${esc(l)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

async function storeResume(candidateId: string, fileName: string, lines: string[], uploadedById: string | null, link: { applicationId?: string; folderId?: string } = {}) {
  if (!supabase) return null;
  const id = randomUUID();
  const path = `documents/${new Date().getUTCFullYear()}/${id}/${fileName}`;
  const bytes = samplePdf(lines);
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf" });
  if (error) throw new Error(`Upload failed (run "npm run setup:storage" first): ${error.message}`);
  return prisma.document.create({
    data: {
      id, type: "RESUME", status: "ACTIVE", fileName, mimeType: "application/pdf", sizeBytes: bytes.length, storagePath: path,
      candidateId, uploadedById, activatedAt: new Date(), applicationId: link.applicationId ?? null, folderId: link.folderId ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const STAFF = [
  { key: "admin", first: "Alex", last: "Morgan", role: "SUPER_ADMIN", groups: [] as string[] },
  { key: "ops", first: "Jordan", last: "Reyes", role: "ADMIN", groups: [] },
  { key: "emma", first: "Emma", last: "Tremblay", role: "RECRUITER", groups: ["Canada Recruitment Team", "Java Recruitment Team"] },
  { key: "marcus", first: "Marcus", last: "Johnson", role: "RECRUITER", groups: ["US Recruitment Team", "Data Engineering Recruitment Team"] },
  { key: "aisha", first: "Aisha", last: "Khan", role: "RECRUITER", groups: ["US Recruitment Team"] },
];

const GROUPS = [
  ["US Recruitment Team", "Recruiters covering US-based roles"],
  ["Canada Recruitment Team", "Recruiters covering Canadian roles"],
  ["Java Recruitment Team", "Java and JVM specialists"],
  ["Data Engineering Recruitment Team", "Data, analytics and ML roles"],
] as const;

type JobSeed = {
  key: string; title: string; country: "US" | "CA"; state: string; city: string;
  wa: "REMOTE" | "HYBRID" | "ONSITE"; et: "FULL_TIME" | "CONTRACT" | "PART_TIME"; min: number; max: number;
  pay: [number, number]; currency: "USD" | "CAD"; type: "ANNUAL" | "HOURLY"; public: boolean;
  required: string[]; preferred: string[]; status: "DRAFT" | "PUBLISHED" | "CLOSED"; posted: number | null;
  deadline: number | null; recruiter: string; groups: string[]; featured?: boolean;
};

const JOBS: JobSeed[] = [
  { key: "java-tor", title: "Senior Java Developer", country: "CA", state: "ON", city: "Toronto", wa: "HYBRID", et: "FULL_TIME", min: 5, max: 8, pay: [110000, 130000], currency: "CAD", type: "ANNUAL", public: true, required: ["Java", "Spring Boot", "AWS"], preferred: ["Kafka", "Kubernetes"], status: "PUBLISHED", posted: 4, deadline: 27, recruiter: "emma", groups: ["Canada Recruitment Team", "Java Recruitment Team"], featured: true },
  { key: "data-aus", title: "Data Engineer", country: "US", state: "TX", city: "Austin", wa: "REMOTE", et: "CONTRACT", min: 4, max: 7, pay: [75, 90], currency: "USD", type: "HOURLY", public: true, required: ["Python", "SQL", "Azure"], preferred: ["Databricks", "Airflow"], status: "PUBLISHED", posted: 2, deadline: 30, recruiter: "marcus", groups: ["US Recruitment Team", "Data Engineering Recruitment Team"], featured: true },
  { key: "devops-van", title: "Cloud DevOps Engineer", country: "CA", state: "BC", city: "Vancouver", wa: "HYBRID", et: "FULL_TIME", min: 3, max: 6, pay: [105000, 125000], currency: "CAD", type: "ANNUAL", public: false, required: ["Terraform", "AWS", "Kubernetes"], preferred: ["Python", "GitHub Actions"], status: "PUBLISHED", posted: 9, deadline: null, recruiter: "emma", groups: ["Canada Recruitment Team"] },
  { key: "react-ny", title: "React Frontend Developer", country: "US", state: "NY", city: "New York", wa: "REMOTE", et: "FULL_TIME", min: 3, max: 6, pay: [120000, 145000], currency: "USD", type: "ANNUAL", public: true, required: ["React", "TypeScript"], preferred: ["Next.js", "GraphQL"], status: "PUBLISHED", posted: 12, deadline: 18, recruiter: "aisha", groups: ["US Recruitment Team"], featured: true },
  { key: "net-cal", title: ".NET Developer (Contract)", country: "CA", state: "AB", city: "Calgary", wa: "ONSITE", et: "CONTRACT", min: 5, max: 10, pay: [80, 95], currency: "CAD", type: "HOURLY", public: true, required: ["C#", ".NET", "SQL Server"], preferred: ["Azure"], status: "PUBLISHED", posted: 20, deadline: 10, recruiter: "emma", groups: ["Canada Recruitment Team"] },
  { key: "qa-chi", title: "QA Automation Engineer", country: "US", state: "IL", city: "Chicago", wa: "HYBRID", et: "FULL_TIME", min: 2, max: 5, pay: [90000, 110000], currency: "USD", type: "ANNUAL", public: false, required: ["Selenium", "Java"], preferred: ["Cypress", "Playwright"], status: "PUBLISHED", posted: 6, deadline: null, recruiter: "aisha", groups: ["US Recruitment Team"] },
  { key: "sf-mtl", title: "Salesforce Developer", country: "CA", state: "QC", city: "Montreal", wa: "HYBRID", et: "FULL_TIME", min: 3, max: 6, pay: [95000, 115000], currency: "CAD", type: "ANNUAL", public: false, required: ["Salesforce", "Apex"], preferred: ["LWC"], status: "DRAFT", posted: null, deadline: null, recruiter: "emma", groups: ["Canada Recruitment Team"] },
  { key: "py-sea", title: "Python Backend Engineer", country: "US", state: "WA", city: "Seattle", wa: "ONSITE", et: "FULL_TIME", min: 4, max: 8, pay: [140000, 165000], currency: "USD", type: "ANNUAL", public: true, required: ["Python", "Django", "PostgreSQL"], preferred: ["AWS"], status: "CLOSED", posted: 45, deadline: null, recruiter: "marcus", groups: ["US Recruitment Team"] },
];

type CandidateSeed = {
  key: string; first: string; last: string; portal: boolean; source: Source; country: "US" | "CA"; state: string; city: string;
  title: string; employer?: string; total: number; relevant: number; primary: string[]; secondary: string[];
  qualification: "BACHELOR" | "MASTER" | "DIPLOMA"; education: string; certs: string[]; titles: string[]; locations: string[];
  wa: ("REMOTE" | "HYBRID" | "ONSITE")[]; et: ("FULL_TIME" | "CONTRACT" | "PART_TIME")[]; comp: number; currency: "USD" | "CAD"; compType: "ANNUAL" | "HOURLY";
  notice: number; authCountry: "US" | "CA"; auth: "CITIZEN" | "PERMANENT_RESIDENT" | "WORK_PERMIT" | "REQUIRES_SPONSORSHIP"; phone: string; owner?: string;
};

const CANDIDATES: CandidateSeed[] = [
  { key: "john", first: "John", last: "Smith", portal: true, source: "JOB_PORTAL", country: "CA", state: "ON", city: "Toronto", title: "Senior Java Developer", employer: "Shopify", total: 6, relevant: 6, primary: ["Java", "Spring Boot"], secondary: ["AWS", "Kafka", "PostgreSQL"], qualification: "BACHELOR", education: "B.Sc. Computer Science, University of Toronto", certs: ["AWS Certified Developer – Associate"], titles: ["Senior Java Developer", "Backend Engineer"], locations: ["Toronto", "Remote (Canada)"], wa: ["HYBRID", "REMOTE"], et: ["FULL_TIME"], comp: 125000, currency: "CAD", compType: "ANNUAL", notice: 14, authCountry: "CA", auth: "CITIZEN", phone: "+14165550101" },
  { key: "sarah", first: "Sarah", last: "Wilson", portal: false, source: "INTERNAL_RECRUITMENT", country: "CA", state: "ON", city: "Ottawa", title: "Java Developer", employer: "CGI", total: 7, relevant: 7, primary: ["Java", "Spring Boot"], secondary: ["Microservices", "Docker"], qualification: "MASTER", education: "M.Eng. Software Engineering, Carleton University", certs: ["Oracle Certified Professional Java SE 11"], titles: ["Java Developer", "Senior Software Engineer"], locations: ["Ottawa", "Toronto"], wa: ["HYBRID"], et: ["FULL_TIME", "CONTRACT"], comp: 118000, currency: "CAD", compType: "ANNUAL", notice: 30, authCountry: "CA", auth: "PERMANENT_RESIDENT", phone: "+16135550102", owner: "emma" },
  { key: "david", first: "David", last: "Lee", portal: true, source: "JOB_PORTAL", country: "CA", state: "BC", city: "Vancouver", title: "Software Engineer", employer: "Telus", total: 5, relevant: 5, primary: ["Java", "AWS"], secondary: ["Spring Boot", "Terraform"], qualification: "BACHELOR", education: "B.A.Sc. Computer Engineering, UBC", certs: [], titles: ["Java Developer", "Cloud Engineer"], locations: ["Vancouver"], wa: ["HYBRID", "ONSITE"], et: ["FULL_TIME"], comp: 115000, currency: "CAD", compType: "ANNUAL", notice: 30, authCountry: "CA", auth: "CITIZEN", phone: "+16045550103" },
  { key: "priya", first: "Priya", last: "Patel", portal: true, source: "JOB_PORTAL", country: "US", state: "TX", city: "Dallas", title: "Data Engineer", employer: "AT&T", total: 5, relevant: 4, primary: ["Python", "SQL"], secondary: ["Azure", "Databricks", "Spark"], qualification: "MASTER", education: "M.S. Data Science, UT Dallas", certs: ["Microsoft Certified: Azure Data Engineer Associate"], titles: ["Data Engineer"], locations: ["Remote (US)", "Dallas"], wa: ["REMOTE"], et: ["CONTRACT", "FULL_TIME"], comp: 85, currency: "USD", compType: "HOURLY", notice: 14, authCountry: "US", auth: "PERMANENT_RESIDENT", phone: "+12145550104" },
  { key: "michael", first: "Michael", last: "Brown", portal: false, source: "REFERRAL", country: "US", state: "WA", city: "Seattle", title: "Senior Data Engineer", employer: "Amazon", total: 9, relevant: 8, primary: ["Python", "SQL", "Azure"], secondary: ["Airflow", "Snowflake"], qualification: "BACHELOR", education: "B.S. Computer Science, University of Washington", certs: [], titles: ["Senior Data Engineer", "Data Architect"], locations: ["Seattle", "Remote (US)"], wa: ["REMOTE", "HYBRID"], et: ["CONTRACT"], comp: 95, currency: "USD", compType: "HOURLY", notice: 45, authCountry: "US", auth: "CITIZEN", phone: "+12065550105", owner: "marcus" },
  { key: "linh", first: "Linh", last: "Nguyen", portal: true, source: "JOB_PORTAL", country: "US", state: "NY", city: "Brooklyn", title: "Frontend Developer", employer: "Etsy", total: 4, relevant: 4, primary: ["React", "TypeScript"], secondary: ["Next.js", "GraphQL", "CSS"], qualification: "BACHELOR", education: "B.S. Information Science, NYU", certs: [], titles: ["Frontend Developer", "React Developer"], locations: ["New York", "Remote (US)"], wa: ["REMOTE", "HYBRID"], et: ["FULL_TIME"], comp: 135000, currency: "USD", compType: "ANNUAL", notice: 14, authCountry: "US", auth: "WORK_PERMIT", phone: "+17185550106" },
  { key: "carlos", first: "Carlos", last: "Garcia", portal: false, source: "INTERNAL_RECRUITMENT", country: "US", state: "IL", city: "Chicago", title: "QA Automation Engineer", employer: "Groupon", total: 3, relevant: 3, primary: ["Selenium", "Java"], secondary: ["Cypress", "Jenkins"], qualification: "DIPLOMA", education: "Diploma in Software Testing, Harper College", certs: ["ISTQB Foundation"], titles: ["QA Automation Engineer", "SDET"], locations: ["Chicago"], wa: ["HYBRID", "ONSITE"], et: ["FULL_TIME"], comp: 98000, currency: "USD", compType: "ANNUAL", notice: 14, authCountry: "US", auth: "CITIZEN", phone: "+13125550107", owner: "aisha" },
  { key: "fatima", first: "Fatima", last: "Haddad", portal: true, source: "JOB_PORTAL", country: "CA", state: "AB", city: "Calgary", title: ".NET Developer", employer: "Enbridge", total: 8, relevant: 7, primary: ["C#", ".NET"], secondary: ["SQL Server", "Azure"], qualification: "BACHELOR", education: "B.Sc. Software Engineering, University of Calgary", certs: ["Microsoft Certified: Azure Developer Associate"], titles: [".NET Developer"], locations: ["Calgary", "Edmonton"], wa: ["ONSITE", "HYBRID"], et: ["CONTRACT", "FULL_TIME"], comp: 90, currency: "CAD", compType: "HOURLY", notice: 21, authCountry: "CA", auth: "CITIZEN", phone: "+14035550108" },
  { key: "ethan", first: "Ethan", last: "Roberts", portal: false, source: "INTERNAL_RECRUITMENT", country: "CA", state: "BC", city: "Victoria", title: "DevOps Engineer", employer: "BC Hydro", total: 4, relevant: 4, primary: ["Kubernetes", "Terraform"], secondary: ["AWS", "Python"], qualification: "BACHELOR", education: "B.Sc. Computer Science, University of Victoria", certs: ["Certified Kubernetes Administrator (CKA)"], titles: ["DevOps Engineer", "Site Reliability Engineer"], locations: ["Vancouver", "Victoria", "Remote (Canada)"], wa: ["REMOTE", "HYBRID"], et: ["FULL_TIME"], comp: 120000, currency: "CAD", compType: "ANNUAL", notice: 30, authCountry: "CA", auth: "CITIZEN", phone: "+12505550109", owner: "emma" },
  { key: "olga", first: "Olga", last: "Ivanova", portal: true, source: "JOB_PORTAL", country: "US", state: "CA", city: "San Jose", title: "Python Developer", employer: "Cisco", total: 6, relevant: 5, primary: ["Python", "Django"], secondary: ["PostgreSQL", "AWS"], qualification: "MASTER", education: "M.S. Computer Science, San Jose State University", certs: [], titles: ["Python Backend Engineer"], locations: ["San Francisco Bay Area", "Seattle"], wa: ["ONSITE", "HYBRID"], et: ["FULL_TIME"], comp: 150000, currency: "USD", compType: "ANNUAL", notice: 30, authCountry: "US", auth: "REQUIRES_SPONSORSHIP", phone: "+14085550110" },
];

const APPLICATIONS: { candidate: string; job: string; status: ApplicationStatus; days: number }[] = [
  { candidate: "john", job: "java-tor", status: "SHORTLISTED", days: 3 },
  { candidate: "sarah", job: "java-tor", status: "SUBMITTED_TO_CLIENT", days: 3 },
  { candidate: "david", job: "java-tor", status: "APPLIED", days: 1 },
  { candidate: "priya", job: "data-aus", status: "UNDER_REVIEW", days: 1 },
  { candidate: "michael", job: "data-aus", status: "INTERVIEW", days: 2 },
  { candidate: "linh", job: "react-ny", status: "APPLIED", days: 5 },
  { candidate: "fatima", job: "net-cal", status: "SELECTED", days: 15 },
  { candidate: "ethan", job: "devops-van", status: "SHORTLISTED", days: 6 },
  { candidate: "carlos", job: "qa-chi", status: "UNDER_REVIEW", days: 4 },
  { candidate: "olga", job: "py-sea", status: "REJECTED", days: 40 },
  { candidate: "david", job: "devops-van", status: "APPLIED", days: 2 },
];

const PATH: ApplicationStatus[] = ["APPLIED", "UNDER_REVIEW", "SHORTLISTED", "SUBMITTED_TO_CLIENT", "INTERVIEW", "SELECTED"];

async function main() {
  await syncRolesAndPermissions(prisma);
  console.log("✓ Permissions and built-in roles synced");

  if (await prisma.job.count()) {
    console.log("Demo data already present (jobs exist) — skipping.");
    return;
  }
  if (!supabase) console.warn("! Supabase credentials or SEED_DEMO_PASSWORD missing: demo users get no logins and no resume files.");

  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.key, r.id]));
  const candidateRoleId = roles.CANDIDATE;

  const groups: Record<string, string> = {};
  for (const [name, description] of GROUPS) groups[name] = (await prisma.group.create({ data: { name, description } })).id;

  const staff: Record<string, string> = {};
  for (const s of STAFF) {
    const email = `${s.key}@${DOMAIN}`;
    const id = await authUser(email, { account_type: "staff" });
    await prisma.user.create({
      data: {
        id, email, firstName: s.first, lastName: s.last, type: "STAFF",
        roles: { create: [{ roleId: roles[s.role] }] },
        groups: { create: s.groups.map((g) => ({ groupId: groups[g] })) },
      },
    });
    staff[s.key] = id;
  }
  console.log(`✓ ${STAFF.length} staff users${supabase ? ` (password from SEED_DEMO_PASSWORD, e.g. admin@${DOMAIN})` : ""}`);

  const jobs: Record<string, { id: string; caseFileId: string; recruiter: string }> = {};
  for (const j of JOBS) {
    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          title: j.title,
          description: `Our client is hiring a ${j.title} to join a growing technology team in ${j.city}. You will design, build and support production systems, collaborate with product and engineering partners, and help raise the bar for quality and reliability.`,
          responsibilities: ["Design, develop and test production-grade software", "Collaborate in an agile team with product, QA and DevOps", "Participate in code reviews and technical design", "Troubleshoot and resolve production issues"].join("\n"),
          minExperience: j.min, maxExperience: j.max, education: "Bachelor's degree in Computer Science or equivalent experience",
          country: j.country, state: j.state, city: j.city, workArrangement: j.wa, employmentType: j.et,
          compensationMin: j.pay[0], compensationMax: j.pay[1], currency: j.currency, compensationType: j.type, salaryPublic: j.public,
          applicationDeadline: j.deadline != null ? dateIn(j.deadline) : null, isFeatured: !!j.featured,
          status: j.status, publishedAt: j.posted != null ? daysAgo(j.posted) : null, closedAt: j.status === "CLOSED" ? daysAgo(5) : null,
          createdAt: daysAgo((j.posted ?? 0) + 2), assignedRecruiterId: staff[j.recruiter], createdById: staff.ops,
          internalNotes: "Client prefers candidates who can start within 30 days.",
          caseFile: { create: {} }, groups: { create: j.groups.map((g) => ({ groupId: groups[g] })) },
        },
        include: { caseFile: true },
      });
      await replaceJobSkills(tx, created.id, j.required, j.preferred);
      return created;
    });
    jobs[j.key] = { id: job.id, caseFileId: job.caseFile!.id, recruiter: staff[j.recruiter] };
  }
  console.log(`✓ ${JOBS.length} jobs with case files`);

  const candidates: Record<string, string> = {};
  for (const c of CANDIDATES) {
    const email = `${c.first}.${c.last}@${DOMAIN}`.toLowerCase();
    let userId: string | null = null;
    if (c.portal) {
      userId = await authUser(email, { account_type: "candidate", first_name: c.first, last_name: c.last, phone: c.phone, country: c.country });
      await prisma.user.create({ data: { id: userId, email, firstName: c.first, lastName: c.last, type: "CANDIDATE", roles: { create: [{ roleId: candidateRoleId }] } } });
    }
    const profile = await prisma.$transaction(async (tx) => {
      const p = await tx.candidateProfile.create({
        data: {
          userId, source: c.source, firstName: c.first, lastName: c.last, email, phone: c.phone, country: c.country, state: c.state, city: c.city,
          linkedinUrl: `https://www.linkedin.com/in/${c.first}-${c.last}`.toLowerCase(), professionalTitle: c.title, currentTitle: c.title,
          currentEmployer: c.employer, totalExperienceYears: c.total, relevantExperienceYears: c.relevant, highestQualification: c.qualification,
          education: c.education, certifications: c.certs, preferredJobTitles: c.titles, preferredLocations: c.locations,
          preferredWorkArrangements: c.wa, preferredEmploymentTypes: c.et, expectedCompensation: c.comp, currency: c.currency,
          compensationType: c.compType, noticePeriodDays: c.notice, workAuthCountry: c.authCountry, workAuthStatus: c.auth,
          profileOwnerId: c.owner ? staff[c.owner] : null, createdById: c.portal ? null : staff[c.owner ?? "ops"],
          internalNotes: c.portal ? null : "Strong communicator; verified references.",
        },
      });
      await replaceCandidateSkills(tx, p.id, c.primary, c.secondary);
      return p;
    });
    await refreshCandidateSearchVector(profile.id, prisma);
    const resume = await storeResume(profile.id, `${c.first}-${c.last}-Resume.pdf`, [`${c.first} ${c.last}`, c.title, `${c.city}, ${c.state}`, `Skills: ${[...c.primary, ...c.secondary].join(", ")}`, `Experience: ${c.total} years`, c.education], userId ?? staff[c.owner ?? "ops"]);
    if (resume) await prisma.candidateProfile.update({ where: { id: profile.id }, data: { defaultResumeId: resume.id } });
    candidates[c.key] = profile.id;
  }
  console.log(`✓ ${CANDIDATES.length} candidates (portal and internal)`);

  for (const a of APPLICATIONS) {
    const profile = await prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidates[a.candidate] },
      include: { skills: { include: { skill: true } }, defaultResume: true },
    });
    const job = jobs[a.job];
    const internal = profile.source !== "JOB_PORTAL";
    const appliedAt = daysAgo(a.days);
    const target = a.status === "REJECTED" ? ["APPLIED", "UNDER_REVIEW", "REJECTED"] as ApplicationStatus[] : PATH.slice(0, PATH.indexOf(a.status) + 1);
    const history: Prisma.ApplicationStatusHistoryCreateWithoutApplicationInput[] = target.map((status, i) => ({
      fromStatus: i === 0 ? null : target[i - 1],
      toStatus: status,
      changedAt: new Date(appliedAt.getTime() + i * 6 * 3600 * 1000),
      changedBy: i === 0 && !internal ? undefined : { connect: { id: job.recruiter } },
      note: i === 0 ? (internal ? "Added to job by recruiter" : "Submitted on the job portal") : null,
    }));

    const app = await prisma.application.create({
      data: {
        candidateId: profile.id, jobId: job.id, status: a.status, source: internal ? "INTERNAL_RECRUITMENT" : "JOB_PORTAL", appliedAt,
        relevantExperienceYears: profile.relevantExperienceYears, availability: `${profile.noticePeriodDays} days' notice`,
        workAuthorizationResponse: profile.workAuthStatus?.replace(/_/g, " ").toLowerCase() ?? null,
        relevantExperienceSummary: `${profile.relevantExperienceYears} years building systems with ${profile.skills.slice(0, 3).map((s) => s.skill.name).join(", ")}.`,
        assignedRecruiterId: job.recruiter,
        consentBasis: internal ? "Candidate confirmed by phone that MIG may submit their profile for this role." : null,
        consentRecordedAt: internal ? appliedAt : null, consentRecordedById: internal ? job.recruiter : null,
        candidateSnapshot: buildCandidateSnapshot(profile, profile.defaultResume, appliedAt) as unknown as Prisma.InputJsonValue,
        folder: { create: { caseFileId: job.caseFileId } },
        statusHistory: { create: history },
        notes: a.status !== "APPLIED" ? { create: { authorId: job.recruiter, body: "Phone screen completed — solid fundamentals, good communication.", createdAt: new Date(appliedAt.getTime() + 8 * 3600 * 1000) } } : undefined,
      },
      include: { folder: true },
    });
    await storeResume(profile.id, profile.defaultResume?.fileName ?? "Resume.pdf", [`${profile.firstName} ${profile.lastName}`, "Resume submitted with application", app.displayId], profile.userId ?? job.recruiter, { applicationId: app.id, folderId: app.folder!.id });
  }
  console.log(`✓ ${APPLICATIONS.length} applications with case folders and status history`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
