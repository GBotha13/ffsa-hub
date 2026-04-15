import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { TranscriptData } from "@/services/schools";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    textAlign: "center",
    marginBottom: 20,
    borderBottom: "2px solid #1a1a1a",
    paddingBottom: 12,
  },
  institutionName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 8,
    color: "#555",
    marginBottom: 8,
  },
  transcriptTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    marginTop: 6,
  },

  // Student & Program info
  infoSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 20,
  },
  infoBlock: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    borderBottom: "1px solid #ccc",
    paddingBottom: 3,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  infoLabel: {
    width: 90,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  infoValue: {
    flex: 1,
    fontSize: 9,
  },

  // Course table
  tableSection: {
    marginTop: 10,
    marginBottom: 16,
  },
  tableSectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    borderBottom: "1px solid #ccc",
    paddingBottom: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderTop: "1px solid #1a1a1a",
    borderBottom: "1px solid #1a1a1a",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #ddd",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  colCode: { width: 70, fontSize: 9 },
  colName: { flex: 1, fontSize: 9 },
  colCredits: { width: 50, textAlign: "center", fontSize: 9 },
  colGrade: { width: 50, textAlign: "center", fontSize: 9 },
  colPoints: { width: 70, textAlign: "center", fontSize: 9 },
  headerText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Summary
  summarySection: {
    marginTop: 10,
    borderTop: "2px solid #1a1a1a",
    paddingTop: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 40,
    marginBottom: 4,
  },
  summaryItem: {
    flexDirection: "row",
    gap: 8,
  },
  summaryLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  summaryValue: {
    fontSize: 9,
  },
  gpaHighlight: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    borderTop: "1px solid #ccc",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#888",
  },
});

export function TranscriptDocument({ data }: { data: TranscriptData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.institutionName}>
            FAITH FOCUSED SERVICE ALLIANCE
          </Text>
          <Text style={styles.subtitle}>
            Cape Town, South Africa
          </Text>
          <Text style={styles.transcriptTitle}>
            OFFICIAL ACADEMIC TRANSCRIPT
          </Text>
        </View>

        {/* Student & Program Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Student Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name:</Text>
              <Text style={styles.infoValue}>
                {data.student.firstName} {data.student.lastName}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Student ID:</Text>
              <Text style={styles.infoValue}>
                {data.student.id.substring(0, 8).toUpperCase()}
              </Text>
            </View>
            {data.student.dateOfBirth && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date of Birth:</Text>
                <Text style={styles.infoValue}>
                  {new Date(data.student.dateOfBirth).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </View>
            )}
            {data.student.nationality && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nationality:</Text>
                <Text style={styles.infoValue}>{data.student.nationality}</Text>
              </View>
            )}
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Program Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Program:</Text>
              <Text style={styles.infoValue}>{data.program.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Program Code:</Text>
              <Text style={styles.infoValue}>{data.program.code}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Enrolled:</Text>
              <Text style={styles.infoValue}>
                {new Date(data.enrollment.enrolledAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status:</Text>
              <Text style={styles.infoValue}>
                {data.enrollment.status.charAt(0).toUpperCase() +
                  data.enrollment.status.slice(1)}
              </Text>
            </View>
            {data.enrollment.completedAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Completed:</Text>
                <Text style={styles.infoValue}>
                  {new Date(data.enrollment.completedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Course Table */}
        <View style={styles.tableSection}>
          <Text style={styles.tableSectionTitle}>Academic Record</Text>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <View style={styles.colCode}>
              <Text style={styles.headerText}>Code</Text>
            </View>
            <View style={styles.colName}>
              <Text style={styles.headerText}>Course Title</Text>
            </View>
            <View style={styles.colCredits}>
              <Text style={styles.headerText}>Credits</Text>
            </View>
            <View style={styles.colGrade}>
              <Text style={styles.headerText}>Grade</Text>
            </View>
            <View style={styles.colPoints}>
              <Text style={styles.headerText}>Quality Pts</Text>
            </View>
          </View>

          {/* Table Rows */}
          {data.courses.map((course, idx) => (
            <View
              key={course.code}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <View style={styles.colCode}>
                <Text>{course.code}</Text>
              </View>
              <View style={styles.colName}>
                <Text>{course.name}</Text>
              </View>
              <View style={styles.colCredits}>
                <Text>{course.creditHours}</Text>
              </View>
              <View style={styles.colGrade}>
                <Text>{course.letterGrade ?? "—"}</Text>
              </View>
              <View style={styles.colPoints}>
                <Text>
                  {course.qualityPoints !== null
                    ? course.qualityPoints.toFixed(2)
                    : "—"}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Credits Attempted:</Text>
              <Text style={styles.summaryValue}>
                {data.totalCreditsAttempted}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Credits Earned:</Text>
              <Text style={styles.summaryValue}>
                {data.totalCreditsEarned}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Cumulative GPA:</Text>
              <Text style={[styles.summaryValue, styles.gpaHighlight]}>
                {data.gpa !== null ? data.gpa.toFixed(2) : "N/A"}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Issue Date: {data.issueDate}
          </Text>
          <Text style={styles.footerText}>
            Faith Focused Service Alliance — Official Transcript
          </Text>
          <Text style={styles.footerText}>
            This transcript is not official without institutional seal.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
