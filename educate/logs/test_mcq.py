"""
Test MCQ and Theory Question Paper Detection
"""
import re

mcq_sample = """
DON BOSCO INSTITUTE OF TECHNOLOGY
Department of Computer Science & Engineering
Course Name: Python Programming  Course Code: 21CS54
Quiz & MCQ Assessment - AY 2025-26
Max Marks: 20  Time: 30 min

1. Which of the following is an immutable data type in Python?
A) List
B) Dictionary
C) Tuple
D) Set

2. What is the output of print(2 ** 3)?
A) 6
B) 8
C) 9
D) 5

3. Which keyword is used to define a function in Python?
A) func
B) define
C) def
D) function

4. How do you start a comment in Python?
A) //
B) /*
C) #
D) --
"""

from ai_extractor import parse_questions_heuristically

# Test MCQ heuristic detection
def parse_mcq_test(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    questions = []
    current_q = None
    current_options = []

    for line in lines:
        # Check if line is a new question: e.g. "1. Which...", "Q1. What..."
        q_match = re.match(r"^(?:(?:Q|Question)\s*)?(\d{1,2})[\.\)]\s+(.*)$", line, re.IGNORECASE)
        # Check if line is an option: e.g. "A) List", "A. List", "(A) List"
        opt_match = re.match(r"^[\(\[]?([A-Da-d])[\)\]\.]\s+(.*)$", line)

        if opt_match and current_q:
            opt_letter = opt_match.group(1).upper()
            opt_text = opt_match.group(2).strip()
            current_options.append(f"{opt_letter}) {opt_text}")
        elif q_match:
            if current_q:
                current_q["options"] = current_options
                current_q["questionType"] = "MCQ" if len(current_options) >= 2 else "THEORY"
                current_q["marks"] = 1.0 if current_q["questionType"] == "MCQ" else 5.0
                questions.append(current_q)
                current_options = []

            q_num = q_match.group(1)
            q_text = q_match.group(2).strip()
            current_q = {
                "questionId": f"Q{q_num}",
                "parentQuestion": f"Q{q_num}",
                "text": q_text,
                "marks": 1.0,
                "questionType": "MCQ",
                "section": "MCQ-SECTION",
                "options": [],
                "optionalQuestion": False,
                "optionalWith": None
            }

    if current_q:
        current_q["options"] = current_options
        current_q["questionType"] = "MCQ" if len(current_options) >= 2 else "THEORY"
        current_q["marks"] = 1.0 if current_q["questionType"] == "MCQ" else 5.0
        questions.append(current_q)

    return questions

res = parse_mcq_test(mcq_sample)
print(f"Total MCQ Extracted: {len(res)}")
for q in res:
    print(f"{q['questionId']} [{q['questionType']}]: {q['text']} -> {len(q['options'])} options: {q['options']} (Marks: {q['marks']}M)")
