"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Download, ChevronUp, ChevronDown, Edit2, ClipboardList } from "lucide-react";

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

type Course = {
  id: string;
  name: string;
  code: string;
  credit_hours: number;
  sort_order: number;
};

type Enrollment = {
  id: string;
  user_id: string;
  status: string;
  enrolled_at: string;
  users: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    email: string | null;
  };
};

type GradeRow = {
  id: string;
  enrollment_id: string;
  course_id: string;
  letter_grade: string | null;
  courses: Course;
  enrollments: {
    id: string;
    user_id: string;
    program_id: string;
  };
};

type UserOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
};

type Program = {
  id: string;
  name: string;
  code: string;
  credit_hours: number;
  status: string;
  description: string | null;
  application_open: boolean;
  courses: Course[];
};

type AppQuestion = {
  id: string;
  program_id: string;
  label: string;
  description: string | null;
  type: string;
  sort_order: number;
  is_required: boolean;
};

type AppResponse = {
  id: string;
  program_id: string;
  user_id: string;
  answers: Array<{ question_id: string; question_label: string; answer: string }>;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
  users: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    email: string | null;
  };
};

const LETTER_GRADES = [
  "A", "A-", "B+", "B", "B-", "C+", "C", "C-",
  "D+", "D", "D-", "F", "W", "I", "P",
];

// ────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────

export function ProgramDetail({
  program,
  enrollments,
  grades,
  allUsers,
  questions,
  responses,
}: {
  program: Program;
  enrollments: Enrollment[];
  grades: GradeRow[];
  allUsers: UserOption[];
  questions: AppQuestion[];
  responses: AppResponse[];
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{program.name}</h1>
          <p className="text-sm text-muted-foreground">
            {program.code} &middot; {program.credit_hours} credit hours
            {program.description && ` — ${program.description}`}
          </p>
        </div>
        <Badge variant={program.status === "active" ? "default" : "secondary"}>
          {program.status}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="courses">
        <TabsList>
          <TabsTrigger value="courses">
            Courses ({program.courses.length})
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            Enrollments ({enrollments.length})
          </TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="application">
            Application ({responses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="mt-4">
          <CoursesTab programId={program.id} courses={program.courses} />
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          <EnrollmentsTab
            programId={program.id}
            enrollments={enrollments}
            allUsers={allUsers}
          />
        </TabsContent>

        <TabsContent value="grades" className="mt-4">
          <GradesTab
            programId={program.id}
            courses={program.courses}
            enrollments={enrollments}
            grades={grades}
          />
        </TabsContent>

        <TabsContent value="application" className="mt-4">
          <ApplicationTab
            programId={program.id}
            applicationOpen={program.application_open}
            questions={questions}
            responses={responses}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// COURSES TAB
// ────────────────────────────────────────────────────────────

function CoursesTab({
  programId,
  courses,
}: {
  programId: string;
  courses: Course[];
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [creditHours, setCreditHours] = useState("3");
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/schools/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: programId,
          name,
          code: code.toUpperCase(),
          credit_hours: parseInt(creditHours) || 3,
          sort_order: courses.length,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add course");
        return;
      }

      setName("");
      setCode("");
      setCreditHours("3");
      setShowAdd(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(courseId: string) {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    setDeleting(courseId);
    try {
      const res = await fetch(`/api/schools/courses?id=${courseId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete course");
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to delete course");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Course
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border p-4">
          <form onSubmit={handleAddCourse} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Course Name *</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Biblical Studies I"
                />
              </div>
              <div>
                <Label>Code *</Label>
                <Input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. BIB101"
                  className="uppercase"
                />
              </div>
              <div>
                <Label>Credit Hours</Label>
                <Input
                  type="number"
                  min="0"
                  value={creditHours}
                  onChange={(e) => setCreditHours(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Adding..." : "Add Course"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Course Name</TableHead>
              <TableHead>Credit Hours</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No courses yet. Add courses to this program.
                </TableCell>
              </TableRow>
            ) : (
              courses.map((course, idx) => (
                <TableRow key={course.id}>
                  <TableCell className="text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {course.code}
                  </TableCell>
                  <TableCell className="font-medium">{course.name}</TableCell>
                  <TableCell>{course.credit_hours}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(course.id)}
                      disabled={deleting === course.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ENROLLMENTS TAB
// ────────────────────────────────────────────────────────────

function EnrollmentsTab({
  programId,
  enrollments,
  allUsers,
}: {
  programId: string;
  enrollments: Enrollment[];
  allUsers: UserOption[];
}) {
  const router = useRouter();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Filter out already-enrolled users
  const enrolledIds = new Set(enrollments.map((e) => e.user_id));
  const availableUsers = allUsers.filter((u) => !enrolledIds.has(u.id));

  function userName(u: { first_name: string | null; last_name: string | null; preferred_name: string | null; email: string | null }) {
    if (u.first_name) {
      return `${u.preferred_name ?? u.first_name} ${u.last_name ?? ""}`.trim();
    }
    return u.email ?? "Unknown";
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/schools/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUserId, program_id: programId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to enroll user");
        return;
      }

      setSelectedUserId("");
      setEnrollOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(enrollmentId: string, newStatus: string) {
    setUpdatingStatus(enrollmentId);
    try {
      const res = await fetch("/api/schools/enrollments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: enrollmentId, status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update status");
        return;
      }

      router.refresh();
    } catch {
      alert("Failed to update status");
    } finally {
      setUpdatingStatus(null);
    }
  }

  const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
    active: "default",
    completed: "secondary",
    withdrawn: "destructive",
    on_hold: "secondary",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Enroll Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enroll Student</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEnroll} className="space-y-4">
              <div>
                <Label>Select Student</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a student..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        All users are already enrolled
                      </SelectItem>
                    ) : (
                      availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {userName(u)} {u.email ? `(${u.email})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEnrollOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !selectedUserId}
                >
                  {loading ? "Enrolling..." : "Enroll"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrollments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  No students enrolled yet.
                </TableCell>
              </TableRow>
            ) : (
              enrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell className="font-medium">
                    {userName(enrollment.users)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {enrollment.users.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(enrollment.enrolled_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={enrollment.status}
                      onValueChange={(val) =>
                        handleStatusChange(enrollment.id, val)
                      }
                      disabled={updatingStatus === enrollment.id}
                    >
                      <SelectTrigger className="w-[130px]">
                        <Badge variant={statusColors[enrollment.status] ?? "secondary"}>
                          {enrollment.status}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="withdrawn">Withdrawn</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// GRADES TAB
// ────────────────────────────────────────────────────────────

function GradesTab({
  programId,
  courses,
  enrollments,
  grades,
}: {
  programId: string;
  courses: Course[];
  enrollments: Enrollment[];
  grades: GradeRow[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Build a map: enrollmentId -> courseId -> letterGrade
  const gradeMap = new Map<string, Map<string, string>>();
  for (const g of grades) {
    if (!gradeMap.has(g.enrollment_id)) {
      gradeMap.set(g.enrollment_id, new Map());
    }
    if (g.letter_grade) {
      gradeMap.get(g.enrollment_id)!.set(g.course_id, g.letter_grade);
    }
  }

  // Local state for edits
  const [edits, setEdits] = useState<
    Map<string, Map<string, string | null>>
  >(new Map());

  function getGrade(enrollmentId: string, courseId: string): string {
    // Check local edits first
    const editVal = edits.get(enrollmentId)?.get(courseId);
    if (editVal !== undefined) return editVal ?? "";
    // Then check server data
    return gradeMap.get(enrollmentId)?.get(courseId) ?? "";
  }

  function setGrade(enrollmentId: string, courseId: string, grade: string) {
    setEdits((prev) => {
      const next = new Map(prev);
      if (!next.has(enrollmentId)) {
        next.set(enrollmentId, new Map());
      }
      next.get(enrollmentId)!.set(courseId, grade || null);
      return next;
    });
    setSuccess(false);
  }

  function userName(e: Enrollment) {
    const u = e.users;
    if (u.first_name) {
      return `${u.preferred_name ?? u.first_name} ${u.last_name ?? ""}`.trim();
    }
    return u.email ?? "Unknown";
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Collect all grades (edits + existing)
    const allGrades: Array<{
      enrollment_id: string;
      course_id: string;
      letter_grade: string | null;
    }> = [];

    for (const enrollment of enrollments) {
      for (const course of courses) {
        const grade = getGrade(enrollment.id, course.id);
        if (grade) {
          allGrades.push({
            enrollment_id: enrollment.id,
            course_id: course.id,
            letter_grade: grade,
          });
        }
      }
    }

    if (allGrades.length === 0) {
      setError("No grades to save");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/schools/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades: allGrades }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save grades");
        return;
      }

      setEdits(new Map());
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // Filter to active enrollments for grading
  const activeEnrollments = enrollments.filter(
    (e) => e.status === "active" || e.status === "completed"
  );

  if (courses.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        Add courses before entering grades.
      </p>
    );
  }

  if (activeEnrollments.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        Enroll students before entering grades.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Enter grades for each student. Click Save All when done.
        </p>
        <div className="flex items-center gap-3">
          {success && (
            <span className="text-sm text-green-600">Grades saved!</span>
          )}
          {error && <span className="text-sm text-destructive">{error}</span>}
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? "Saving..." : "Save All Grades"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10 min-w-[180px]">
                Student
              </TableHead>
              {courses.map((course) => (
                <TableHead key={course.id} className="text-center min-w-[100px]">
                  <div className="font-mono text-xs">{course.code}</div>
                  <div className="text-xs font-normal text-muted-foreground truncate max-w-[120px]">
                    {course.name}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center min-w-[80px]">
                Transcript
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeEnrollments.map((enrollment) => (
              <TableRow key={enrollment.id}>
                <TableCell className="sticky left-0 bg-card z-10 font-medium">
                  {userName(enrollment)}
                </TableCell>
                {courses.map((course) => (
                  <TableCell key={course.id} className="p-1">
                    <Select
                      value={getGrade(enrollment.id, course.id) || "_empty"}
                      onValueChange={(val) =>
                        setGrade(
                          enrollment.id,
                          course.id,
                          val === "_empty" ? "" : val
                        )
                      }
                    >
                      <SelectTrigger className="h-8 text-center text-sm">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_empty">—</SelectItem>
                        {LETTER_GRADES.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-primary"
                    onClick={() => {
                      window.open(
                        `/api/schools/transcript?userId=${enrollment.user_id}&programId=${programId}`,
                        "_blank"
                      );
                    }}
                    title="Download Transcript"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// APPLICATION TAB
// ────────────────────────────────────────────────────────────

function ApplicationTab({
  programId,
  applicationOpen,
  questions,
  responses,
}: {
  programId: string;
  applicationOpen: boolean;
  questions: AppQuestion[];
  responses: AppResponse[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(applicationOpen);
  const [toggling, setToggling] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AppQuestion | null>(null);
  const [reviewingResponse, setReviewingResponse] = useState<AppResponse | null>(null);

  // Question form state
  const [qLabel, setQLabel] = useState("");
  const [qDescription, setQDescription] = useState("");
  const [qType, setQType] = useState("short_answer");
  const [qRequired, setQRequired] = useState(true);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState<string | null>(null);

  // Review state
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  async function handleToggleOpen() {
    setToggling(true);
    try {
      // We'll add a simple toggle endpoint, but for now use the programs route
      const newVal = !isOpen;
      const res = await fetch("/api/schools/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: programId, application_open: newVal }),
      });
      if (res.ok) {
        setIsOpen(newVal);
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setToggling(false);
    }
  }

  function resetQuestionForm() {
    setQLabel("");
    setQDescription("");
    setQType("short_answer");
    setQRequired(true);
    setQError(null);
    setEditingQuestion(null);
    setShowAddQuestion(false);
  }

  function startEdit(q: AppQuestion) {
    setEditingQuestion(q);
    setQLabel(q.label);
    setQDescription(q.description ?? "");
    setQType(q.type);
    setQRequired(q.is_required);
    setShowAddQuestion(true);
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setQLoading(true);
    setQError(null);

    try {
      if (editingQuestion) {
        // Update
        const res = await fetch("/api/schools/applications/questions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingQuestion.id,
            label: qLabel,
            description: qDescription || null,
            type: qType,
            is_required: qRequired,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setQError(data.error || "Failed to update question");
          return;
        }
      } else {
        // Create
        const res = await fetch("/api/schools/applications/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            program_id: programId,
            label: qLabel,
            description: qDescription || null,
            type: qType,
            is_required: qRequired,
            sort_order: questions.length,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setQError(data.error || "Failed to add question");
          return;
        }
      }

      resetQuestionForm();
      router.refresh();
    } catch {
      setQError("Network error");
    } finally {
      setQLoading(false);
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    try {
      const res = await fetch(`/api/schools/applications/questions?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } catch {
      alert("Failed to delete question");
    }
  }

  async function handleMoveQuestion(questionId: string, direction: "up" | "down") {
    const idx = questions.findIndex((q) => q.id === questionId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= questions.length) return;

    // Swap sort orders
    const updates = [
      { id: questions[idx].id, sort_order: questions[swapIdx].sort_order },
      { id: questions[swapIdx].id, sort_order: questions[idx].sort_order },
    ];

    for (const u of updates) {
      await fetch("/api/schools/applications/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(u),
      });
    }
    router.refresh();
  }

  async function handleReviewSave() {
    if (!reviewingResponse || !reviewStatus) return;
    setReviewLoading(true);

    try {
      const res = await fetch("/api/schools/applications/responses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reviewingResponse.id,
          status: reviewStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update status");
        return;
      }

      // If accepted, offer to auto-enroll
      if (reviewStatus === "accepted") {
        const shouldEnroll = confirm(
          "Application accepted! Would you like to automatically enroll this student in the program?"
        );
        if (shouldEnroll) {
          await fetch("/api/schools/enrollments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: reviewingResponse.user_id,
              program_id: programId,
            }),
          });
        }
      }

      setReviewingResponse(null);
      router.refresh();
    } catch {
      alert("Failed to update status");
    } finally {
      setReviewLoading(false);
    }
  }

  function userName(u: { first_name: string | null; last_name: string | null; preferred_name: string | null; email: string | null }) {
    if (u.first_name) {
      return `${u.preferred_name ?? u.first_name} ${u.last_name ?? ""}`.trim();
    }
    return u.email ?? "Unknown";
  }

  const responseStatusColors: Record<string, "default" | "secondary" | "destructive"> = {
    submitted: "secondary",
    accepted: "default",
    rejected: "destructive",
    waitlisted: "secondary",
  };

  return (
    <div className="space-y-6">
      {/* Application Open Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <h3 className="font-medium">Application Status</h3>
          <p className="text-sm text-muted-foreground">
            {isOpen
              ? "Application is open — students can apply from their portal."
              : "Application is closed — students cannot apply."}
          </p>
        </div>
        <Button
          variant={isOpen ? "destructive" : "default"}
          size="sm"
          onClick={handleToggleOpen}
          disabled={toggling}
        >
          {toggling
            ? "Updating..."
            : isOpen
              ? "Close Application"
              : "Open Application"}
        </Button>
      </div>

      {/* ─── APPLICATION BUILDER ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Application Questions ({questions.length})
          </h3>
          <Button
            size="sm"
            onClick={() => {
              resetQuestionForm();
              setShowAddQuestion(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>

        {/* Add/Edit Question Form */}
        {showAddQuestion && (
          <div className="rounded-lg border p-4">
            <form onSubmit={handleSaveQuestion} className="space-y-3">
              <div>
                <Label>Question Label *</Label>
                <Input
                  required
                  value={qLabel}
                  onChange={(e) => setQLabel(e.target.value)}
                  placeholder="e.g. Tell us about your faith journey"
                />
              </div>
              <div>
                <Label>Help Text / Description</Label>
                <Input
                  value={qDescription}
                  onChange={(e) => setQDescription(e.target.value)}
                  placeholder="Optional instructions for the applicant"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Answer Type</Label>
                  <Select value={qType} onValueChange={setQType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short_answer">Short Answer</SelectItem>
                      <SelectItem value="long_answer">Long Answer (Essay)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="q-required"
                    checked={qRequired}
                    onChange={(e) => setQRequired(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="q-required" className="mb-0">Required</Label>
                </div>
              </div>
              {qError && <p className="text-sm text-destructive">{qError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={qLoading}>
                  {qLoading
                    ? "Saving..."
                    : editingQuestion
                      ? "Update Question"
                      : "Add Question"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetQuestionForm}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Questions List */}
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No questions yet. Add questions to build the application form.
          </p>
        ) : (
          <div className="space-y-2">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={idx === 0}
                    onClick={() => handleMoveQuestion(q.id, "up")}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={idx === questions.length - 1}
                    onClick={() => handleMoveQuestion(q.id, "down")}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{q.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {q.type === "long_answer" ? "Essay" : "Short"}
                    </Badge>
                    {q.is_required && (
                      <Badge variant="secondary" className="text-xs">Required</Badge>
                    )}
                  </div>
                  {q.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {q.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => startEdit(q)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteQuestion(q.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── APPLICATION REVIEW ─── */}
      <div className="space-y-4">
        <h3 className="font-medium">Submitted Applications ({responses.length})</h3>

        {responses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No applications submitted yet.
          </p>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((resp) => (
                  <TableRow key={resp.id}>
                    <TableCell className="font-medium">
                      {userName(resp.users)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {resp.users.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(resp.submitted_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={responseStatusColors[resp.status] ?? "secondary"}>
                        {resp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReviewingResponse(resp);
                          setReviewStatus(resp.status);
                        }}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Review Dialog */}
      <Dialog
        open={reviewingResponse !== null}
        onOpenChange={(open) => {
          if (!open) setReviewingResponse(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Application Review — {reviewingResponse && userName(reviewingResponse.users)}
            </DialogTitle>
          </DialogHeader>

          {reviewingResponse && (
            <div className="space-y-6">
              {/* Student Info */}
              <div className="text-sm text-muted-foreground">
                <p>Email: {reviewingResponse.users.email}</p>
                <p>
                  Submitted:{" "}
                  {new Date(reviewingResponse.submitted_at).toLocaleDateString()}
                </p>
              </div>

              {/* Answers */}
              <div className="space-y-4">
                {reviewingResponse.answers.map((a, idx) => (
                  <div key={idx} className="space-y-1">
                    <Label className="text-sm font-medium">
                      {a.question_label}
                    </Label>
                    <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                      {a.answer || <span className="text-muted-foreground italic">No answer provided</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status Update */}
              <div className="flex items-center gap-4 border-t pt-4">
                <Label>Decision:</Label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="waitlisted">Waitlisted</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleReviewSave}
                  disabled={reviewLoading || reviewStatus === reviewingResponse.status}
                  size="sm"
                >
                  {reviewLoading ? "Saving..." : "Save Decision"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
