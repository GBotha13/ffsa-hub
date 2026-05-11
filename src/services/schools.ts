// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// PROGRAMS
// ────────────────────────────────────────────────────────────

export async function getPrograms(
  supabase: Client,
  options?: { status?: string; search?: string }
) {
  let query = supabase
    .from("programs")
    .select("*, courses(id)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.search) {
    const term = `%${options.search}%`;
    query = query.or(`name.ilike.${term},code.ilike.${term}`);
  }

  return query;
}

export async function getProgramById(supabase: Client, id: string) {
  return supabase
    .from("programs")
    .select("*, courses(*)")
    .eq("id", id)
    .order("sort_order", { referencedTable: "courses", ascending: true })
    .single();
}

export async function createProgram(supabase: Client, data: {
  name: string;
  code: string;
  description?: string | null;
  credit_hours?: number;
  created_by: string;
}) {
  return supabase.from("programs").insert(data).select().single();
}

export async function updateProgram(
  supabase: Client,
  id: string,
  data: { name?: string; code?: string; description?: string | null; credit_hours?: number; status?: string }
) {
  return supabase.from("programs").update(data).eq("id", id).select().single();
}

// ────────────────────────────────────────────────────────────
// COURSES
// ────────────────────────────────────────────────────────────

export async function getCoursesByProgram(supabase: Client, programId: string) {
  return supabase
    .from("courses")
    .select("*")
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });
}

export async function createCourse(supabase: Client, data: {
  program_id: string;
  name: string;
  code: string;
  description?: string | null;
  credit_hours?: number;
  sort_order?: number;
}) {
  return supabase.from("courses").insert(data).select().single();
}

export async function updateCourse(
  supabase: Client,
  id: string,
  data: { name?: string; code?: string; description?: string | null; credit_hours?: number; sort_order?: number }
) {
  return supabase.from("courses").update(data).eq("id", id).select().single();
}

export async function deleteCourse(supabase: Client, id: string) {
  return supabase.from("courses").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// ENROLLMENTS
// ────────────────────────────────────────────────────────────

export async function getEnrollmentsByProgram(supabase: Client, programId: string) {
  return supabase
    .from("enrollments")
    .select("*, users!enrollments_user_id_fkey(id, first_name, last_name, preferred_name, email)")
    .eq("program_id", programId)
    .order("enrolled_at", { ascending: false });
}

export async function getEnrollmentsByUser(supabase: Client, userId: string) {
  return supabase
    .from("enrollments")
    .select("*, programs(*)")
    .eq("user_id", userId)
    .order("enrolled_at", { ascending: false });
}

export async function getEnrollmentById(supabase: Client, id: string) {
  return supabase
    .from("enrollments")
    .select("*, programs(*, courses(*)), users!enrollments_user_id_fkey(id, first_name, last_name, preferred_name, email, date_of_birth, nationality)")
    .eq("id", id)
    .single();
}

export async function createEnrollment(supabase: Client, data: {
  user_id: string;
  program_id: string;
  enrolled_by?: string;
  notes?: string | null;
}) {
  return supabase.from("enrollments").insert(data).select().single();
}

export async function updateEnrollmentStatus(
  supabase: Client,
  id: string,
  status: string,
  completedAt?: string | null
) {
  const data: Record<string, unknown> = { status };
  if (status === "completed") {
    data.completed_at = completedAt ?? new Date().toISOString();
  }
  return supabase.from("enrollments").update(data).eq("id", id).select().single();
}

// ────────────────────────────────────────────────────────────
// GRADES
// ────────────────────────────────────────────────────────────

export async function getGradesByEnrollment(supabase: Client, enrollmentId: string) {
  return supabase
    .from("grades")
    .select("*, courses(*)")
    .eq("enrollment_id", enrollmentId)
    .order("created_at", { ascending: true });
}

export async function getGradesByProgram(supabase: Client, programId: string) {
  return supabase
    .from("grades")
    .select("*, courses(*), enrollments!inner(id, user_id, program_id)")
    .eq("enrollments.program_id", programId);
}

export async function upsertGrade(supabase: Client, data: {
  enrollment_id: string;
  course_id: string;
  letter_grade: string | null;
  graded_by?: string;
  graded_at?: string;
}) {
  return supabase
    .from("grades")
    .upsert(
      {
        ...data,
        graded_at: data.graded_at ?? new Date().toISOString(),
      },
      { onConflict: "enrollment_id,course_id" }
    )
    .select()
    .single();
}

export async function bulkUpsertGrades(supabase: Client, grades: Array<{
  enrollment_id: string;
  course_id: string;
  letter_grade: string | null;
  graded_by?: string;
}>) {
  const now = new Date().toISOString();
  const data = grades.map((g) => ({ ...g, graded_at: now }));
  return supabase
    .from("grades")
    .upsert(data, { onConflict: "enrollment_id,course_id" })
    .select();
}

// ────────────────────────────────────────────────────────────
// GPA CALCULATION (client-side helper)
// ────────────────────────────────────────────────────────────

const GRADE_POINTS: Record<string, number> = {
  "A": 4.0, "A-": 3.7,
  "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7,
  "D+": 1.3, "D": 1.0, "D-": 0.7,
  "F": 0.0,
};

export function gradeToPoints(grade: string): number | null {
  return GRADE_POINTS[grade] ?? null;
}

export function calculateGPA(
  grades: Array<{ letter_grade: string | null; credit_hours: number }>
): number | null {
  let totalPoints = 0;
  let totalCredits = 0;

  for (const g of grades) {
    if (!g.letter_grade) continue;
    const points = gradeToPoints(g.letter_grade);
    if (points === null) continue; // W, I, P don't affect GPA
    totalPoints += points * g.credit_hours;
    totalCredits += g.credit_hours;
  }

  if (totalCredits === 0) return null;
  return Math.round((totalPoints / totalCredits) * 100) / 100;
}

// ────────────────────────────────────────────────────────────
// TRANSCRIPT DATA ASSEMBLER
// ────────────────────────────────────────────────────────────

export interface TranscriptData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    nationality: string | null;
  };
  program: {
    name: string;
    code: string;
    creditHours: number;
  };
  enrollment: {
    enrolledAt: string;
    completedAt: string | null;
    status: string;
  };
  courses: Array<{
    code: string;
    name: string;
    creditHours: number;
    letterGrade: string | null;
    qualityPoints: number | null;
  }>;
  gpa: number | null;
  totalCreditsAttempted: number;
  totalCreditsEarned: number;
  issueDate: string;
}

export async function getTranscriptData(
  supabase: Client,
  userId: string,
  programId: string
): Promise<TranscriptData | null> {
  // Get enrollment with user and program
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("*, programs(*), users!enrollments_user_id_fkey(id, first_name, last_name, date_of_birth, nationality)")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .single();

  if (!enrollment) return null;

  // Get courses for the program
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });

  // Get grades for this enrollment
  const { data: grades } = await supabase
    .from("grades")
    .select("*")
    .eq("enrollment_id", enrollment.id);

  const gradeMap = new Map<string, string>();
  for (const g of grades ?? []) {
    if (g.letter_grade) gradeMap.set(g.course_id, g.letter_grade);
  }

  const courseList = (courses ?? []).map((c: { code: string; name: string; credit_hours: number; id: string }) => {
    const letterGrade = gradeMap.get(c.id) ?? null;
    const points = letterGrade ? gradeToPoints(letterGrade) : null;
    return {
      code: c.code,
      name: c.name,
      creditHours: c.credit_hours,
      letterGrade,
      qualityPoints: points !== null ? Math.round(points * c.credit_hours * 100) / 100 : null,
    };
  });

  const gradedCourses = courseList
    .filter((c: { letterGrade: string | null }) => c.letterGrade !== null)
    .map((c: { letterGrade: string | null; creditHours: number }) => ({ letter_grade: c.letterGrade, credit_hours: c.creditHours }));

  const gpa = calculateGPA(gradedCourses);

  const totalCreditsAttempted = gradedCourses.reduce((sum: number, c: { credit_hours: number }) => sum + c.credit_hours, 0);
  const totalCreditsEarned = courseList
    .filter((c: { letterGrade: string | null }) => c.letterGrade && c.letterGrade !== "F" && c.letterGrade !== "W" && c.letterGrade !== "I")
    .reduce((sum: number, c: { creditHours: number }) => sum + c.creditHours, 0);

  const user = enrollment.users;
  const program = enrollment.programs;

  return {
    student: {
      id: user.id,
      firstName: user.first_name ?? "",
      lastName: user.last_name ?? "",
      dateOfBirth: user.date_of_birth,
      nationality: user.nationality,
    },
    program: {
      name: program.name,
      code: program.code,
      creditHours: program.credit_hours,
    },
    enrollment: {
      enrolledAt: enrollment.enrolled_at,
      completedAt: enrollment.completed_at,
      status: enrollment.status,
    },
    courses: courseList,
    gpa,
    totalCreditsAttempted,
    totalCreditsEarned,
    issueDate: new Date().toISOString().split("T")[0],
  };
}

// ────────────────────────────────────────────────────────────
// APPLICATION QUESTIONS
// ────────────────────────────────────────────────────────────

export async function getQuestionsByProgram(supabase: Client, programId: string) {
  return supabase
    .from("application_questions")
    .select("*")
    .eq("program_id", programId)
    .order("sort_order", { ascending: true });
}

export async function createQuestion(supabase: Client, data: {
  program_id: string;
  label: string;
  description?: string | null;
  type?: string;
  sort_order?: number;
  is_required?: boolean;
}) {
  return supabase.from("application_questions").insert(data).select().single();
}

export async function updateQuestion(
  supabase: Client,
  id: string,
  data: {
    label?: string;
    description?: string | null;
    type?: string;
    sort_order?: number;
    is_required?: boolean;
  }
) {
  return supabase.from("application_questions").update(data).eq("id", id).select().single();
}

export async function deleteQuestion(supabase: Client, id: string) {
  return supabase.from("application_questions").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// APPLICATION RESPONSES
// ────────────────────────────────────────────────────────────

export async function getResponsesByProgram(supabase: Client, programId: string) {
  return supabase
    .from("application_responses")
    .select("*, users!application_responses_user_id_fkey(id, first_name, last_name, preferred_name, email)")
    .eq("program_id", programId)
    .order("submitted_at", { ascending: false });
  // Note: nullable user_id FK join returns null for public applicants — PostgREST handles this automatically
}

export async function getResponseByUserAndProgram(
  supabase: Client,
  userId: string,
  programId: string
) {
  return supabase
    .from("application_responses")
    .select("*")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();
}

export async function getResponsesByUser(supabase: Client, userId: string) {
  return supabase
    .from("application_responses")
    .select("*, programs(id, name, code)")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false });
}

export async function createResponse(supabase: Client, data: {
  program_id: string;
  user_id: string;
  answers: Array<{ question_id: string; question_label: string; answer: string }>;
}) {
  return supabase.from("application_responses").insert(data).select().single();
}

export async function createPublicResponse(supabase: Client, data: {
  program_id: string;
  applicant_email: string;
  applicant_info: Record<string, unknown>;
  answers: Array<{ question_id: string; question_label: string; answer: string }>;
}) {
  return supabase
    .from("application_responses")
    .insert({
      program_id: data.program_id,
      user_id: null,
      applicant_email: data.applicant_email,
      applicant_info: data.applicant_info,
      answers: data.answers,
    })
    .select()
    .single();
}

export async function getResponseByEmailAndProgram(
  supabase: Client,
  email: string,
  programId: string
) {
  return supabase
    .from("application_responses")
    .select("id, status")
    .eq("applicant_email", email)
    .eq("program_id", programId)
    .is("user_id", null)
    .maybeSingle();
}

export async function getProgramPublicInfo(supabase: Client, programId: string) {
  return supabase
    .from("programs")
    .select("id, name, code, description, application_open, status")
    .eq("id", programId)
    .single();
}

export async function updateResponseStatus(
  supabase: Client,
  id: string,
  status: string,
  reviewedBy: string
) {
  return supabase
    .from("application_responses")
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
}
