"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Plus, Trash2, Download, ChevronUp, ChevronDown, Edit2, ClipboardList, Copy, Check, Link as LinkIcon, Archive } from "lucide-react";
import { ProgramActions } from "../program-actions";

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

type ReferenceSlot = {
  id: string;
  program_id: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_required: boolean;
};

type ReferenceRequest = {
  id: string;
  application_id: string;
  slot_id: string;
  referee_name: string;
  referee_email: string;
  status: string;
  relationship: string | null;
  known_duration: string | null;
  reference_text: string | null;
  submitted_at: string | null;
  reference_slots: { label: string; description: string | null } | null;
};

type ApplicantInfo = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  country?: string;
  city?: string;
};

type AppResponse = {
  id: string;
  program_id: string;
  user_id: string | null;
  applicant_email: string | null;
  applicant_info: ApplicantInfo | null;
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
  } | null;
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
  referenceSlots,
}: {
  program: Program;
  enrollments: Enrollment[];
  grades: GradeRow[];
  allUsers: UserOption[];
  questions: AppQuestion[];
  responses: AppResponse[];
  referenceSlots: ReferenceSlot[];
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/schools" className="text-xs text-muted-foreground hover:text-foreground uppercase" style={{ letterSpacing: "0.15em" }}>
          ← Schools
        </Link>
      </div>
      {program.status === "archived" && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-600/30 bg-yellow-950/20 px-4 py-3">
          <Archive className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-200">
            This program is archived. It is hidden from non-admin users and no new enrollments can be made.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <p className="page-eyebrow">TRAINING &amp; EDUCATION</p>
          <h1 className="page-title">{program.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {program.code} &middot; {program.credit_hours} credit hours
            {program.description && ` — ${program.description}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={program.status === "active" ? "default" : "secondary"}>
            {program.status}
          </Badge>
          <ProgramActions program={program} variant="button" redirectAfterDelete />
        </div>
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
            referenceSlots={referenceSlots}
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
  referenceSlots,
}: {
  programId: string;
  applicationOpen: boolean;
  questions: AppQuestion[];
  responses: AppResponse[];
  referenceSlots: ReferenceSlot[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(applicationOpen);
  const [toggling, setToggling] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AppQuestion | null>(null);
  const [reviewingResponse, setReviewingResponse] = useState<AppResponse | null>(null);

  // Reference slot state
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ReferenceSlot | null>(null);
  const [slotLabel, setSlotLabel] = useState("");
  const [slotDescription, setSlotDescription] = useState("");
  const [slotRequired, setSlotRequired] = useState(true);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  // Reference display in review dialog
  const [reviewReferences, setReviewReferences] = useState<ReferenceRequest[]>([]);
  const [refsLoading, setRefsLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  function copyPublicLink() {
    const link = `${window.location.origin}/apply/${programId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

  // ── Reference Slot Helpers ──

  function resetSlotForm() {
    setSlotLabel("");
    setSlotDescription("");
    setSlotRequired(true);
    setSlotError(null);
    setEditingSlot(null);
    setShowAddSlot(false);
  }

  function startEditSlot(slot: ReferenceSlot) {
    setEditingSlot(slot);
    setSlotLabel(slot.label);
    setSlotDescription(slot.description ?? "");
    setSlotRequired(slot.is_required);
    setShowAddSlot(true);
  }

  async function handleSaveSlot(e: React.FormEvent) {
    e.preventDefault();
    setSlotLoading(true);
    setSlotError(null);

    try {
      if (editingSlot) {
        const res = await fetch("/api/schools/applications/reference-slots", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingSlot.id,
            label: slotLabel,
            description: slotDescription || null,
            is_required: slotRequired,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setSlotError(data.error || "Failed to update"); return; }
      } else {
        const res = await fetch("/api/schools/applications/reference-slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            program_id: programId,
            label: slotLabel,
            description: slotDescription || null,
            is_required: slotRequired,
            sort_order: referenceSlots.length,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setSlotError(data.error || "Failed to add"); return; }
      }

      resetSlotForm();
      router.refresh();
    } catch {
      setSlotError("Network error");
    } finally {
      setSlotLoading(false);
    }
  }

  async function handleDeleteSlot(id: string) {
    if (!confirm("Delete this reference slot?")) return;
    try {
      const res = await fetch(`/api/schools/applications/reference-slots?id=${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } catch {
      alert("Failed to delete reference slot");
    }
  }

  async function handleMoveSlot(slotId: string, direction: "up" | "down") {
    const idx = referenceSlots.findIndex((s) => s.id === slotId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= referenceSlots.length) return;

    const updates = [
      { id: referenceSlots[idx].id, sort_order: referenceSlots[swapIdx].sort_order },
      { id: referenceSlots[swapIdx].id, sort_order: referenceSlots[idx].sort_order },
    ];

    for (const u of updates) {
      await fetch("/api/schools/applications/reference-slots", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(u),
      });
    }
    router.refresh();
  }

  async function fetchReferences(applicationId: string) {
    setRefsLoading(true);
    try {
      const res = await fetch(`/api/schools/applications/references?application_id=${applicationId}`);
      const data = await res.json();
      if (res.ok) setReviewReferences(data.references ?? []);
    } catch {
      // ignore
    } finally {
      setRefsLoading(false);
    }
  }

  async function handleReviewSave() {
    if (!reviewingResponse || !reviewStatus) return;
    setReviewLoading(true);

    try {
      // Public applicant being accepted — use the accept-application pipeline
      if (reviewStatus === "accepted" && !reviewingResponse.user_id) {
        const shouldAccept = confirm(
          "Accept this application? This will create a user account, enroll the student, and send them an invite email."
        );
        if (!shouldAccept) {
          setReviewLoading(false);
          return;
        }

        const res = await fetch("/api/admin/accept-application", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response_id: reviewingResponse.id }),
        });

        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to accept application");
          return;
        }

        setReviewingResponse(null);
        router.refresh();
        return;
      }

      // Standard status update (for authenticated applicants or non-accept statuses)
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

      // If accepted (authenticated user), offer to auto-enroll
      if (reviewStatus === "accepted" && reviewingResponse.user_id) {
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

  function respName(resp: AppResponse) {
    if (resp.users) {
      const u = resp.users;
      if (u.first_name) return `${u.preferred_name ?? u.first_name} ${u.last_name ?? ""}`.trim();
      return u.email ?? "Unknown";
    }
    if (resp.applicant_info) {
      return `${resp.applicant_info.first_name} ${resp.applicant_info.last_name}`.trim();
    }
    return resp.applicant_email ?? "Unknown";
  }

  function respEmail(resp: AppResponse) {
    return resp.users?.email ?? resp.applicant_email ?? resp.applicant_info?.email ?? "—";
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
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Application Status</h3>
            <p className="text-sm text-muted-foreground">
              {isOpen
                ? "Application is open — students can apply from the portal or via the public link."
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

        {isOpen && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <LinkIcon className="h-4 w-4" />
              Public Application Link
            </div>
            <p className="text-xs text-muted-foreground">
              Share this link with prospective students. They can apply without needing an account.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono select-all truncate">
                {`${window.location.origin}/apply/${programId}`}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={copyPublicLink}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
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

      {/* ─── REFERENCE SLOTS ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Reference Slots ({referenceSlots.length})</h3>
          {!showAddSlot && !editingSlot && (
            <Button size="sm" variant="outline" onClick={() => setShowAddSlot(true)}>
              <Plus className="mr-1 h-3 w-3" /> Add Reference Slot
            </Button>
          )}
        </div>

        {(showAddSlot || editingSlot) && (
          <form onSubmit={handleSaveSlot} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="slot-label">Label *</Label>
                <Input
                  id="slot-label"
                  placeholder="e.g. Friend Reference"
                  value={slotLabel}
                  onChange={(e) => setSlotLabel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slot-desc">Description</Label>
                <Input
                  id="slot-desc"
                  placeholder="Optional instructions for the referee"
                  value={slotDescription}
                  onChange={(e) => setSlotDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="slot-required"
                checked={slotRequired}
                onChange={(e) => setSlotRequired(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="slot-required" className="mb-0">Required</Label>
            </div>
            {slotError && <p className="text-sm text-destructive">{slotError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={slotLoading}>
                {slotLoading ? "Saving..." : editingSlot ? "Update Slot" : "Add Slot"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={resetSlotForm}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {referenceSlots.length === 0 && !showAddSlot ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No reference slots configured. Add one to require references from applicants.
          </p>
        ) : (
          <div className="space-y-2">
            {referenceSlots.map((slot, idx) => (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {slot.label}
                    {slot.is_required && (
                      <span className="ml-2 text-xs text-muted-foreground">Required</span>
                    )}
                  </p>
                  {slot.description && (
                    <p className="text-xs text-muted-foreground truncate">{slot.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    disabled={idx === 0}
                    onClick={() => handleMoveSlot(slot.id, "up")}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    disabled={idx === referenceSlots.length - 1}
                    onClick={() => handleMoveSlot(slot.id, "down")}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => startEditSlot(slot)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteSlot(slot.id)}
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
                      {respName(resp)}
                      {!resp.user_id && (
                        <Badge variant="secondary" className="ml-2 text-xs">Public</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {respEmail(resp)}
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
                          fetchReferences(resp.id);
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
              Application Review — {reviewingResponse && respName(reviewingResponse)}
            </DialogTitle>
          </DialogHeader>

          {reviewingResponse && (
            <div className="space-y-6">
              {/* Applicant Info */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Email: {respEmail(reviewingResponse)}</p>
                <p>
                  Submitted:{" "}
                  {new Date(reviewingResponse.submitted_at).toLocaleDateString()}
                </p>
                {!reviewingResponse.user_id && reviewingResponse.applicant_info && (
                  <div className="mt-3 rounded-md bg-muted p-3 space-y-1">
                    <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-2">Applicant Details</p>
                    {reviewingResponse.applicant_info.phone && (
                      <p>Phone: {reviewingResponse.applicant_info.phone}</p>
                    )}
                    {reviewingResponse.applicant_info.date_of_birth && (
                      <p>Date of Birth: {reviewingResponse.applicant_info.date_of_birth}</p>
                    )}
                    {reviewingResponse.applicant_info.gender && (
                      <p>Gender: {reviewingResponse.applicant_info.gender}</p>
                    )}
                    {reviewingResponse.applicant_info.nationality && (
                      <p>Nationality: {reviewingResponse.applicant_info.nationality}</p>
                    )}
                    {reviewingResponse.applicant_info.country && (
                      <p>Country: {reviewingResponse.applicant_info.country}</p>
                    )}
                    {reviewingResponse.applicant_info.city && (
                      <p>City: {reviewingResponse.applicant_info.city}</p>
                    )}
                  </div>
                )}
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

              {/* References */}
              {referenceSlots.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">References</h4>
                  {refsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading references…</p>
                  ) : reviewReferences.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No references requested for this application.</p>
                  ) : (
                    <div className="space-y-3">
                      {reviewReferences.map((ref) => (
                        <div key={ref.id} className="rounded-lg border bg-muted/50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">
                                {ref.reference_slots?.label ?? "Reference"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {ref.referee_name} · {ref.referee_email}
                              </p>
                            </div>
                            <Badge variant={ref.status === "submitted" ? "default" : "secondary"}>
                              {ref.status === "submitted" ? "Submitted" : "Pending"}
                            </Badge>
                          </div>
                          {ref.status === "submitted" && (
                            <div className="space-y-2 pt-1 border-t text-sm">
                              {ref.relationship && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Relationship</p>
                                  <p>{ref.relationship}</p>
                                </div>
                              )}
                              {ref.known_duration && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Known Duration</p>
                                  <p>{ref.known_duration}</p>
                                </div>
                              )}
                              {ref.reference_text && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground">Reference</p>
                                  <p className="whitespace-pre-wrap">{ref.reference_text}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
