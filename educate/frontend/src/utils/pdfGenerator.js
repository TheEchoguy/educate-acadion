import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Generates and downloads a Standard University Question Paper PDF
 * @param {Object} paper - Question Paper object from backend
 */
export function exportQuestionPaperPdf(paper) {
  if (!paper) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  // 1. INSTITUTION & EXAM HEADER BANNER
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(margin, y, pageWidth - margin * 2, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ACADION ACADEMIC EXAMINATION PORTAL", pageWidth / 2, y + 8, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225); // #cbd5e1
  const examTitle = paper.examName || (paper.internalNo ? `Continuous Internal Assessment (CIE-${paper.internalNo})` : "Semester Examination");
  doc.text(examTitle.toUpperCase(), pageWidth / 2, y + 15, { align: "center" });

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Confidential • Authorized Question Paper Document", pageWidth / 2, y + 22, { align: "center" });

  y += 34;

  // 2. METADATA DETAILS TABLE / GRID
  const subjectName = paper.subject || "Academic Subject";
  const subjectCode = paper.subjectCode || paper.paperId || "N/A";
  const semester = paper.semester ? `Semester ${paper.semester}` : (paper.assignedSemester ? `Sem ${paper.assignedSemester}` : "All Semesters");
  const maxMarks = paper.maxMarks ? `${paper.maxMarks} Marks` : "40 Marks";
  const duration = paper.durationMinutes ? `${paper.durationMinutes} Minutes` : (paper.paperFormat === "MCQ" ? "30 Minutes" : "90 Minutes");
  const format = paper.paperFormat === "MCQ" || paper.paperCategory === "QUIZ" ? "Objective (MCQ)" : "Descriptive (Theory)";

  const metaData = [
    [
      { content: `Subject: ${subjectName}`, styles: { fontStyle: "bold" } },
      { content: `Subject Code / ID: ${subjectCode}`, styles: { fontStyle: "bold" } },
    ],
    [
      { content: `Academic Level: ${semester}` },
      { content: `Maximum Marks: ${maxMarks}`, styles: { fontStyle: "bold" } },
    ],
    [
      { content: `Examination Format: ${format}` },
      { content: `Time Duration: ${duration}` },
    ],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: metaData,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: (pageWidth - margin * 2) * 0.55 },
      1: { cellWidth: (pageWidth - margin * 2) * 0.45 },
    },
  });

  y = doc.lastAutoTable.finalY + 5;

  // 3. GENERAL INSTRUCTIONS BOX (MULTI-LINE DYNAMIC WRAPPING)
  const isMcq = paper.paperFormat === "MCQ" || paper.paperCategory === "QUIZ";
  const instructionsList = isMcq
    ? [
        "1. Answer all objective multiple-choice questions.",
        "2. Each question carries the designated marks indicated alongside.",
        "3. Select the single best answer for each question.",
      ]
    : [
        "1. Answer all questions according to module choices or internal choices indicated.",
        "2. Draw neat, labeled diagrams wherever applicable.",
        "3. Figures to the right indicate full marks for each question.",
      ];

  const maxTextWidth = pageWidth - margin * 2 - 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const wrappedInstructionLines = [];
  instructionsList.forEach((item) => {
    const splitLines = doc.splitTextToSize(item, maxTextWidth);
    wrappedInstructionLines.push(...splitLines);
  });

  const lineHeight = 4.2;
  const boxHeight = 8 + wrappedInstructionLines.length * lineHeight;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("INSTRUCTIONS TO CANDIDATES:", margin + 4, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(wrappedInstructionLines, margin + 4, y + 9.5);

  y += boxHeight + 5;  // 4. QUESTIONS BODY WITH ACCURATE OPTIONAL/OR AND MODULE GROUPING
  const questions = paper.questions || [];

  if (questions.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("No questions configured for this question paper.", margin, y + 10);
  } else {
    const isMcqPaper =
      paper.paperFormat === "MCQ" ||
      paper.paperCategory === "QUIZ" ||
      (paper.paperId && paper.paperId.toUpperCase().includes("MCQ")) ||
      (paper.subjectCode && paper.subjectCode.toUpperCase().includes("MCQ")) ||
      (questions.length > 0 && questions.every((q) => q.options && q.options.length > 0));

    // Helper to extract main question number and parent identifier
    const extractQuestionInfo = (q, idx) => {
      if (!q) return { parent: `Q${idx + 1}`, num: idx + 1 };
      if (q.parentQuestion) {
        const match = q.parentQuestion.match(/\d+/);
        const num = match ? parseInt(match[0], 10) : idx + 1;
        return { parent: `Q${num}`, num };
      }
      const match = (q.questionId || "").match(/(?:Q|Question)?\s*(\d+)/i);
      const num = match ? parseInt(match[1], 10) : null;
      return { parent: num ? `Q${num}` : `Q${idx + 1}`, num: num != null ? num : idx + 1 };
    };

    // Check if a question is explicitly an OR/optional choice (MCQ papers NEVER have OR choices)
    const isOrChoice = (q) => {
      if (isMcqPaper) return false;
      if (!q) return false;
      return q.optionalQuestion === true || Boolean(q.optionalWith) || q.isOr === true;
    };

    const hasAnyOr = !isMcqPaper && questions.some(isOrChoice);

    // Group into Modules
    const moduleMap = new Map();

    if (isMcqPaper) {
      // Objective MCQ papers are ALWAYS a single continuous list without module headers
      moduleMap.set("ALL", questions.map((q, idx) => ({ ...q, _info: extractQuestionInfo(q, idx), _idx: idx })));
    } else {
      questions.forEach((q, idx) => {
        const info = extractQuestionInfo(q, idx);
        let modKey = 1;

        if (q.section && q.section.trim()) {
          modKey = q.section.trim();
        } else if (q.moduleNumber || q.module) {
          modKey = q.moduleNumber || q.module;
        } else if (hasAnyOr && info.num != null) {
          modKey = Math.ceil(info.num / 2);
        } else {
          modKey = "ALL";
        }

        if (!moduleMap.has(modKey)) {
          moduleMap.set(modKey, []);
        }
        moduleMap.get(modKey).push({ ...q, _info: info, _idx: idx });
      });
    }

    const isSingleSection = moduleMap.size === 1 && moduleMap.has("ALL");
    let moduleDisplayIndex = 1;

    for (const [modKey, modQuestions] of moduleMap.entries()) {
      const modTitle = isSingleSection
        ? null
        : typeof modKey === "number"
        ? `MODULE — ${modKey}`
        : isNaN(Number(modKey)) && modKey !== "ALL"
        ? `MODULE — ${moduleDisplayIndex++}`
        : `MODULE — ${modKey}`;

      const tableRows = [];
      let previousParent = null;

      modQuestions.forEach((q, qIdx) => {
        const currParent = q._info.parent;

        // Detect if this is an OR alternative question transition
        const isNewParent = previousParent !== null && currParent !== previousParent;
        const isOrDividerNeeded = isNewParent && isOrChoice(q);

        if (isOrDividerNeeded && qIdx > 0) {
          tableRows.push([
            {
              content: "— — — — — — — — — — — — — — — — — — — — — — OR — — — — — — — — — — — — — — — — — — — — — —",
              colSpan: 3,
              styles: {
                halign: "center",
                fontStyle: "bold",
                textColor: [37, 99, 235], // #2563eb Blue
                fillColor: [241, 245, 249], // #f1f5f9
                fontSize: 9,
              },
            },
          ]);
        }

        previousParent = currParent;

        let qContent = q.questionText || q.text || `Question ${qIdx + 1}`;
        if (q.options && q.options.length > 0) {
          const optsStr = q.options.map((opt, oIdx) => `  [${String.fromCharCode(65 + oIdx)}] ${opt}`).join("\n");
          qContent += `\n${optsStr}`;
        }

        tableRows.push([
          { content: q.questionId || q._info.parent, styles: { halign: "center", fontStyle: "bold" } },
          { content: qContent },
          { content: `${q.maxMarks || q.marks || 5} M`, styles: { halign: "center", fontStyle: "bold" } },
        ]);
      });

      const head = [];
      if (modTitle) {
        head.push([
          {
            content: modTitle,
            colSpan: 3,
            styles: {
              fillColor: [15, 23, 42],
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 9.5,
              halign: "left",
            },
          },
        ]);
      }
      head.push([
        { content: "Q.No", styles: { halign: "center", cellWidth: 18 } },
        { content: "Question Description & Examination Prompt", styles: { halign: "left" } },
        { content: "Marks", styles: { halign: "center", cellWidth: 20 } },
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head,
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
          textColor: [15, 23, 42],
        },
      });

      y = doc.lastAutoTable.finalY + 6;
    }
  }

  // 5. FOOTER ON ALL PAGES
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    const paperCode = paper.subjectCode || paper.paperId || "EXAM";
    doc.text(`Acadion Academic Examination System • Paper ID: ${paperCode}`, margin, pageHeight - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  const filename = `${(paper.subjectCode || paper.paperId || "Question_Paper").replace(/\s+/g, "_")}_Question_Paper.pdf`;
  doc.save(filename);
}

/**
 * Generates and downloads an Official Evaluated Student Submission PDF Scorecard
 * @param {Object} result - Evaluated response object from backend
 * @param {Object} studentInfo - Optional student metadata (name, usn, sem, dept)
 * @param {Array} paperQuestions - Optional original paper questions list
 */
export function exportEvaluatedSubmissionPdf(result, studentInfo = {}, paperQuestions = []) {
  if (!result) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const isMcqEvaluation =
    result.paperCategory === "QUIZ" ||
    result.paperFormat === "MCQ" ||
    (result.paperId && result.paperId.toUpperCase().includes("MCQ")) ||
    (paperQuestions && paperQuestions.length > 0 && paperQuestions.every((q) => q.options && q.options.length > 0));

  // 1. INSTITUTION & OFFICIAL EVALUATION HEADER
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.rect(margin, y, pageWidth - margin * 2, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("ACADION UNIVERSITY EXAMINATION CELL", pageWidth / 2, y + 8, { align: "center" });

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text("OFFICIAL EVALUATION SCORECARD & ANSWER SCRIPT", pageWidth / 2, y + 15, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const modeLabel = result.submissionMode === "OFFLINE_MANUAL"
    ? "Classroom Offline Written Test Evaluation"
    : isMcqEvaluation
    ? "Objective MCQ Quiz Evaluation"
    : "Online Digital Examination Evaluation";
  doc.text(`Record Type: ${modeLabel}`, pageWidth / 2, y + 22, { align: "center" });

  y += 34;

  // 2. STUDENT & EXAMINATION METADATA GRID
  const studentName = studentInfo.name || localStorage.getItem("name") || result.studentName || "Student Candidate";
  const usn = studentInfo.usn || localStorage.getItem("usn") || result.usn || "N/A";
  const dept = studentInfo.department || localStorage.getItem("department") || "Computer Science & Engineering";
  const subjectName = result.subject || result.paperId || "Academic Course";
  const paperId = result.paperId || "N/A";
  const evaluatedBy = result.evaluatedBy || (result.submissionMode === "OFFLINE_MANUAL" ? "Faculty Evaluator" : isMcqEvaluation ? "AI Auto-Evaluator (MCQ)" : "Authorized Faculty");

  const submitDate = result.submittedAt
    ? new Date(result.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : (result.evaluatedAt ? new Date(result.evaluatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recorded");

  const metaData = [
    [
      { content: `Student Name: ${studentName}`, styles: { fontStyle: "bold" } },
      { content: `University USN: ${usn}`, styles: { fontStyle: "bold" } },
    ],
    [
      { content: `Subject: ${subjectName}` },
      { content: `Paper ID: ${paperId}` },
    ],
    [
      { content: `Department: ${dept}` },
      { content: `Evaluation Date: ${submitDate}` },
    ],
    [
      { content: `Evaluator: ${evaluatedBy}`, styles: { fontStyle: "bold", textColor: [37, 99, 235] } },
      { content: `Evaluation Status: ${result.evaluationCompleted ? "Evaluated & Certified" : "Completed"}`, styles: { fontStyle: "bold", textColor: [16, 185, 129] } },
    ],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: metaData,
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: (pageWidth - margin * 2) * 0.55 },
      1: { cellWidth: (pageWidth - margin * 2) * 0.45 },
    },
  });

  y = doc.lastAutoTable.finalY + 5;

  // 3. SCORE & PERFORMANCE SUMMARY BANNER
  const totalM = result.totalMarks != null ? result.totalMarks : 0;
  const maxM = result.maxMarks || 40;
  const pct = maxM > 0 ? Math.round((totalM / maxM) * 10000) / 100 : 0;
  const predScore = result.predictedScore != null ? `${result.predictedScore}%` : "N/A";
  const risk = result.riskLevel || "ON_TRACK";

  const bannerWidth = pageWidth - margin * 2;
  const colWidth = bannerWidth / 4;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, bannerWidth, 16, 2, 2, "FD");

  // Col 1: Marks Scored
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("TOTAL MARKS", margin + colWidth * 0 + 4, y + 5.5);
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235); // Blue
  doc.text(`${totalM} / ${maxM} M`, margin + colWidth * 0 + 4, y + 12);

  // Col 2: Percentage
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("PERCENTAGE", margin + colWidth * 1 + 4, y + 5.5);
  doc.setFontSize(12);
  doc.setTextColor(16, 185, 129); // Green
  doc.text(`${pct}%`, margin + colWidth * 1 + 4, y + 12);

  // Col 3: AI Predicted Score
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("AI PREDICTED", margin + colWidth * 2 + 4, y + 5.5);
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`${predScore}`, margin + colWidth * 2 + 4, y + 12);

  // Col 4: Risk Level
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("ACADEMIC STATUS", margin + colWidth * 3 + 4, y + 5.5);
  doc.setFontSize(11);
  const isHighRisk = risk === "HIGH" || risk === "CRITICAL";
  doc.setTextColor(isHighRisk ? 220 : 16, isHighRisk ? 38 : 185, isHighRisk ? 38 : 129);
  doc.text(risk, margin + colWidth * 3 + 4, y + 12);

  y += 22;

  // 4. QUESTION-WISE EVALUATION TABLE WITH STRICT OPTIONAL/OR HANDLING
  const submittedResponses = result.responses || [];

  let allQuestionsToRender = [];
  if (paperQuestions && paperQuestions.length > 0) {
    allQuestionsToRender = paperQuestions.map((pq, idx) => {
      const match = submittedResponses.find(
        (a) => a.questionId?.toLowerCase() === pq.questionId?.toLowerCase()
      );
      return {
        questionId: pq.questionId || `Q${idx + 1}`,
        questionText: pq.questionText || pq.text || match?.questionText || "",
        topic: pq.topic || match?.topic || "",
        maxMarks: pq.maxMarks || pq.marks || match?.maxMarks || 5,
        marksObtained: match?.marksObtained,
        answer: match?.answer,
        feedback: match?.feedback,
        section: pq.section || match?.section,
        parentQuestion: pq.parentQuestion || match?.parentQuestion,
        optionalQuestion: pq.optionalQuestion || match?.optionalQuestion,
        optionalWith: pq.optionalWith || match?.optionalWith,
        groupName: pq.groupName || match?.groupName,
        attempted: Boolean(match && (match.answer || match.marksObtained != null)),
      };
    });
  } else {
    allQuestionsToRender = submittedResponses.map((a, idx) => ({
      ...a,
      questionId: a.questionId || `Q${idx + 1}`,
      maxMarks: a.maxMarks || 5,
      attempted: true,
    }));
  }

  if (allQuestionsToRender.length === 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [
        [
          { content: "Examination Type", styles: { halign: "center", cellWidth: 35 } },
          { content: "Assessment Summary & Faculty Remarks", styles: { halign: "left" } },
          { content: "Awarded Score", styles: { halign: "center", cellWidth: 28 } },
        ],
      ],
      body: [
        [
          { content: "Classroom Written Test", styles: { halign: "center", fontStyle: "bold" } },
          { content: `Physical paper verified and evaluated by ${evaluatedBy}. Recorded in student academic record.` },
          { content: `${totalM} / ${maxM} M`, styles: { halign: "center", fontStyle: "bold", textColor: [16, 185, 129] } },
        ],
      ],
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: "bold" },
      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [203, 213, 225], lineWidth: 0.2 },
    });
    y = doc.lastAutoTable.finalY + 12;
  } else {
    // Check if questions are explicitly marked as optional (MCQ evaluations NEVER have OR choices)
    const isOrChoice = (q) => {
      if (isMcqEvaluation) return false;
      if (!q) return false;
      return q.optionalQuestion === true || Boolean(q.optionalWith) || q.isOr === true;
    };

    const hasAnyOr = !isMcqEvaluation && allQuestionsToRender.some(isOrChoice);

    const extractParent = (item, idx) => {
      if (!item) return { parent: `Q${idx + 1}`, num: idx + 1 };
      if (item.parentQuestion) {
        const match = item.parentQuestion.match(/\d+/);
        const num = match ? parseInt(match[0], 10) : idx + 1;
        return { parent: `Q${num}`, num };
      }
      const match = (item.questionId || "").match(/(?:Q|Question)?\s*(\d+)/i);
      const num = match ? parseInt(match[1], 10) : null;
      return { parent: num ? `Q${num}` : `Q${idx + 1}`, num: num != null ? num : idx + 1 };
    };

    const moduleMap = new Map();

    if (isMcqEvaluation) {
      // Objective MCQ evaluations are ALWAYS a single continuous list without module headers
      moduleMap.set("ALL", allQuestionsToRender.map((q, idx) => ({ ...q, _info: extractParent(q, idx), _idx: idx })));
    } else {
      allQuestionsToRender.forEach((q, idx) => {
        const info = extractParent(q, idx);
        let modKey = 1;

        if (q.section && q.section.trim()) {
          modKey = q.section.trim();
        } else if (q.moduleNumber || q.module) {
          modKey = q.moduleNumber || q.module;
        } else if (hasAnyOr && info.num != null) {
          modKey = Math.ceil(info.num / 2);
        } else {
          modKey = "ALL";
        }

        if (!moduleMap.has(modKey)) {
          moduleMap.set(modKey, []);
        }
        moduleMap.get(modKey).push({ ...q, _info: info, _idx: idx });
      });
    }

    const isSingleSection = moduleMap.size === 1 && moduleMap.has("ALL");
    let modIndex = 1;

    for (const [modKey, modQuestions] of moduleMap.entries()) {
      const modTitle = isSingleSection
        ? null
        : typeof modKey === "number"
        ? `MODULE — ${modKey}`
        : isNaN(Number(modKey)) && modKey !== "ALL"
        ? `MODULE — ${modIndex++}`
        : `MODULE — ${modKey}`;

      const tableRows = [];
      let previousParent = null;

      modQuestions.forEach((ans, qIdx) => {
        const currParent = ans._info.parent;

        // An OR divider is rendered ONLY if the question is an explicit optional choice
        const isNewParent = previousParent !== null && currParent !== previousParent;
        const isOrNeeded = isNewParent && isOrChoice(ans);

        if (isOrNeeded && qIdx > 0) {
          tableRows.push([
            {
              content: "— — — — — — — — — — — — — — — — — — — — — — OR — — — — — — — — — — — — — — — — — — — — — —",
              colSpan: 3,
              styles: {
                halign: "center",
                fontStyle: "bold",
                textColor: [37, 99, 235],
                fillColor: [241, 245, 249],
                fontSize: 9,
              },
            },
          ]);
        }

        previousParent = currParent;

        const qNum = ans.questionId || ans._info.parent;
        const qText = ans.questionText ? `Q: ${ans.questionText}\n` : "";

        let studentAns = "";
        if (result.submissionMode === "OFFLINE_MANUAL") {
          studentAns = "Exam Mode: Classroom Physical Written Paper";
        } else if (ans.attempted && ans.answer) {
          studentAns = `Ans: ${ans.answer}`;
        } else if (!ans.attempted) {
          studentAns = "(Alternative Question — Not Attempted / Optional)";
        } else {
          studentAns = "(No written response submitted)";
        }

        const feedback = ans.feedback ? `\nRemarks: ${ans.feedback}` : "";
        const fullContent = `${qText}${studentAns}${feedback}`;

        const marksStr = ans.marksObtained != null
          ? `${ans.marksObtained} / ${ans.maxMarks || 5} M`
          : (ans.attempted ? `0 / ${ans.maxMarks || 5} M` : `— / ${ans.maxMarks || 5} M`);

        tableRows.push([
          { content: qNum, styles: { halign: "center", fontStyle: "bold" } },
          { content: fullContent },
          { content: marksStr, styles: { halign: "center", fontStyle: "bold" } },
        ]);
      });

      const head = [];
      if (modTitle) {
        head.push([
          {
            content: modTitle,
            colSpan: 3,
            styles: {
              fillColor: [15, 23, 42],
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 9.5,
              halign: "left",
            },
          },
        ]);
      }
      head.push([
        { content: "Q.No", styles: { halign: "center", cellWidth: 16 } },
        { content: "Question Prompt, Student Answer & Faculty Feedback", styles: { halign: "left" } },
        { content: "Marks", styles: { halign: "center", cellWidth: 22 } },
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head,
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: "bold",
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.8,
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
          textColor: [15, 23, 42],
        },
      });

      y = doc.lastAutoTable.finalY + 6;
    }
  }

  // 5. OFFICIAL SIGNATURE & VERIFICATION BLOCK
  // Check if we need a new page for signatures
  if (y > pageHeight - 35) {
    doc.addPage();
    y = margin + 10;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Signatures Row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  // Student Signature
  doc.line(margin + 5, y + 10, margin + 45, y + 10);
  doc.text("Candidate Signature", margin + 10, y + 14);

  // Evaluator Faculty Signature
  doc.line(pageWidth / 2 - 20, y + 10, pageWidth / 2 + 20, y + 10);
  doc.text("Faculty Evaluator Signature", pageWidth / 2 - 18, y + 14);

  // Controller of Examinations Stamp
  doc.line(pageWidth - margin - 45, y + 10, pageWidth - margin - 5, y + 10);
  doc.text("Academic Cell Seal", pageWidth - margin - 38, y + 14);

  // 6. FOOTER ON ALL PAGES
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(`Acadion Academic Evaluation System • Official Certified Scorecard • USN: ${usn}`, margin, pageHeight - 6);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  // Download PDF
  const filename = `Scorecard_${(usn || "Student").replace(/[^a-zA-Z0-9_-]/g, "_")}_${(result.paperId || "Exam").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
  doc.save(filename);
}
