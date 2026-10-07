// Builds a .docx file for a scheme of work or a lesson plan, client-side, in the standard
// Zambian format: a scheme is a week-by-week table (Topic & Content / Objectives / T&L
// Activities / T&L Resources / Evaluation); a lesson plan is the standard sequence (previous
// knowledge, objectives, materials, introduction, development, conclusion, evaluation,
// homework) with a remarks and signature block. The on-screen "Save as PDF" print preview uses
// the same field order so both exports read as the same document.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
} from "docx";

const LINE = "C9D8CF";
const TINT = "EEF3F1";
const DARK = "0F3D2B";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const run = (text: string, bold = false) => new TextRun({ text: text || "", bold });
const para = (text: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spaceAfter?: number } = {}) =>
  new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spaceAfter ?? 120 },
    children: [new TextRun({ text: text || "", bold: opts.bold, size: opts.size })],
  });

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function headerCell(text: string, width: number) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill: DARK, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })] })],
  });
}

function bodyCell(text: string, width: number, shaded: boolean) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: shaded ? { fill: TINT, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 70, bottom: 70, left: 90, right: 90 },
    children: [new Paragraph({ children: [new TextRun({ text: text || "—", size: 19 })] })],
  });
}

function metaLine(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text: `${label}: `, bold: true, size: 20 }), new TextRun({ text: value || "—", size: 20 })],
  });
}

function sectionHeading(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 }, children: [new TextRun({ text, bold: true, color: DARK })] });
}

function sectionBody(text: string) {
  return new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: text || "—", size: 20 })] });
}

export type SchemeDocInput = {
  schoolName: string;
  authorName: string;
  subjectName: string;
  className: string;
  term: string;
  academicYear: string;
  status: string;
  weeks: Array<{ weekNumber: number; topic: string; subTopics: string; objectives: string; activities: string; resources: string; assessment: string }>;
};

export async function buildSchemeDocxBlob(input: SchemeDocInput): Promise<Blob> {
  const widths = [800, 2600, 2000, 2000, 2000, 1800];
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("Wk", widths[0]), headerCell("Topic & Content", widths[1]), headerCell("Objectives", widths[2]),
        headerCell("T/L Activities", widths[3]), headerCell("T/L Resources", widths[4]), headerCell("Evaluation", widths[5]),
      ],
    }),
    ...input.weeks.map((w, i) => new TableRow({
      children: [
        bodyCell(String(w.weekNumber), widths[0], i % 2 === 1),
        bodyCell([w.topic, w.subTopics].filter(Boolean).join(" — "), widths[1], i % 2 === 1),
        bodyCell(w.objectives, widths[2], i % 2 === 1),
        bodyCell(w.activities, widths[3], i % 2 === 1),
        bodyCell(w.resources, widths[4], i % 2 === 1),
        bodyCell(w.assessment, widths[5], i % 2 === 1),
      ],
    })),
  ];

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      children: [
        para(input.schoolName, { bold: true, size: 28, align: AlignmentType.CENTER, spaceAfter: 40 }),
        para("SCHEME OF WORK", { bold: true, size: 22, align: AlignmentType.CENTER, spaceAfter: 200 }),
        metaLine("Subject", input.subjectName),
        metaLine("Class", input.className),
        metaLine("Term / Year", `Term ${input.term}, ${input.academicYear}`),
        metaLine("Prepared by", input.authorName || "—"),
        metaLine("Status", input.status),
        new Paragraph({ spacing: { after: 160 }, children: [] }),
        new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, rows }),
      ],
    }],
  });
  return Packer.toBlob(doc);
}

export type LessonDocInput = {
  schoolName: string;
  authorName: string;
  subjectName: string;
  className: string;
  lessonDate: string;
  durationMinutes: number;
  topic: string;
  previousKnowledge: string;
  objectives: string;
  materials: string;
  introduction: string;
  development: string;
  conclusion: string;
  evaluation: string;
  homework: string;
  teacherRemarks: string;
};

export async function buildLessonDocxBlob(input: LessonDocInput): Promise<Blob> {
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
      children: [
        para(input.schoolName, { bold: true, size: 28, align: AlignmentType.CENTER, spaceAfter: 40 }),
        para("LESSON PLAN", { bold: true, size: 22, align: AlignmentType.CENTER, spaceAfter: 200 }),
        metaLine("Subject", input.subjectName),
        metaLine("Class", input.className),
        metaLine("Date", input.lessonDate),
        metaLine("Duration", `${input.durationMinutes} minutes`),
        metaLine("Teacher", input.authorName || "—"),
        metaLine("Topic", input.topic),
        sectionHeading("Previous Knowledge"), sectionBody(input.previousKnowledge),
        sectionHeading("Objectives"), sectionBody(input.objectives),
        sectionHeading("Teaching / Learning Materials"), sectionBody(input.materials),
        sectionHeading("Introduction"), sectionBody(input.introduction),
        sectionHeading("Development"), sectionBody(input.development),
        sectionHeading("Conclusion"), sectionBody(input.conclusion),
        sectionHeading("Evaluation"), sectionBody(input.evaluation),
        sectionHeading("Homework / Follow-up Work"), sectionBody(input.homework),
        sectionHeading("Teacher's Remarks"), sectionBody(input.teacherRemarks),
        new Paragraph({ spacing: { before: 400 }, children: [run("Teacher's signature: ______________________        Date: ______________")] }),
        new Paragraph({ spacing: { before: 300 }, children: [run("HOD / Head's signature: ______________________        Date: ______________")] }),
      ],
    }],
  });
  return Packer.toBlob(doc);
}
