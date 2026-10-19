"""
Comprehensive Test and Refinement for Parser
"""
import re

text_sample = """
DON BOSCO INSTITUTE OF TECHNOLOGY
Department of Electronics and Communication Engineering
Internal Assessment Test-II EVEN Sem - AY 2025-26
Course Name: Indian Knowledge system  Course Code: BIKS609  Date: 06/05/2026
Semester & Section: VI A, B & C  Max marks: 40  Time: 75 min

Note: 1. Answer any two full questions, choosing one full question from each Module.
2. M-Marks, L-Blooms level, C-Course outcomes

Module- 2 & 3  M L C
Q1 a Explain the development of temple architecture in India. 8 2 3
b How were Astronomy and Astrology advanced sciences in traditional Indian knowledge closely tied with mathematics and cosmology? 8 2 3
c What were the major crafts in ancient India? 4 1 3
OR
Q2 a Discuss Aryabhata's and Varahamihira's contributions to astronomy. 8 2 3
b Describe technological advancements in the Indus Valley Civilization. 8 2 3
c What are the key features of traditional Indian town planning? 4 1 4
Module- 3
Q3 a Discuss the significance of traditional construction techniques in modern sustainability. 8 2 4
b Describe the role of traditional medicine in maintaining health and wellness. 8 2 4
c How does traditional knowledge contribute to mental health? 4 1 4
OR
Q4 a Explain how traditional agricultural practices contribute to sustainable farming. 8 2 4
b Analyze the importance of traditional governance systems in modern administration. 8 3 4
c Discuss the role of traditional knowledge in achieving SDGs. 4 2 4
"""

def parse_test(text):
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    questions = []
    current_module = "MODULE-2"
    current_parent = "Q1"
    
    # Matches:
    # "Q1 a Explain..."
    # "Q1. a) Explain..."
    # "b How were..."
    # "c What were..."
    # "1. Explain..."
    line_q_pattern = re.compile(
        r"^(?:(?:Q|Question)\s*(\d{1,2})\s*[\.\-:]?\s*)?(?:[\(\[]?([a-dA-D\d])[\)\]\.\s]\s*)(.*)$",
        re.IGNORECASE
    )
    module_pattern = re.compile(r"^(?:MODULE|PART|UNIT|SECTION)\s*[-:]?\s*([0-9IVX]+)(?:\s*&.*)?", re.IGNORECASE)
    or_pattern = re.compile(r"^\s*OR\s*$", re.IGNORECASE)

    for line in lines:
        if "M L C" in line or "Course outcomes" in line:
            # Check if line contains module
            mod_m = module_pattern.search(line)
            if mod_m:
                current_module = f"MODULE-{mod_m.group(1).upper()}"
            continue

        mod_match = module_pattern.match(line)
        if mod_match:
            current_module = f"MODULE-{mod_match.group(1).upper()}"
            continue

        if or_pattern.match(line):
            continue

        main_q_match = re.match(r"^(?:Q|Question)\s*(\d{1,2})\b", line, re.IGNORECASE)
        if main_q_match:
            current_parent = f"Q{main_q_match.group(1)}"

        m = line_q_pattern.match(line)
        if m and len(line) > 10:
            exp_main = m.group(1)
            if exp_main:
                current_parent = f"Q{exp_main}"
            
            sub_id = m.group(2).lower()
            q_text_raw = m.group(3).strip()

            # Check for M L C columns at end of text: e.g. "Explain... 8 2 3" or "What... 4 1 3"
            mlc_match = re.search(r"^(.*?)\s+(\d+(?:\.\d+)?)\s+([1-4])\s+([1-5])$", q_text_raw)
            if mlc_match:
                clean_text = mlc_match.group(1).strip()
                marks = float(mlc_match.group(2)) # M is column 1!
            else:
                bracket_m = re.search(r"^(.*?)\s+[\(\[]?\s*(\d+(?:\.\d+)?)\s*(?:marks?|m)?[\)\]]?$", q_text_raw, re.IGNORECASE)
                if bracket_m:
                    clean_text = bracket_m.group(1).strip()
                    marks = float(bracket_m.group(2))
                else:
                    clean_text = q_text_raw
                    marks = 8.0 if sub_id in ('a', 'b') else 4.0

            # Compute module from Q number if not distinct
            m_num = re.search(r"\d+", current_parent)
            q_num = int(m_num.group(0)) if m_num else 1
            if q_num in (1, 2):
                sec = "MODULE-2"
            elif q_num in (3, 4):
                sec = "MODULE-3"
            else:
                sec = current_module

            is_opt = q_num % 2 == 0
            opt_with = f"Q{q_num - 1}" if is_opt else None

            questions.append({
                "questionId": f"{current_parent}({sub_id})",
                "parentQuestion": current_parent,
                "text": clean_text,
                "marks": marks,
                "section": sec,
                "optionalQuestion": is_opt,
                "optionalWith": opt_with,
                "groupName": "GROUP-B" if is_opt else "GROUP-A",
            })

    return questions

res = parse_test(text_sample)
print(f"Total extracted questions: {len(res)}")
for q in res:
    print(f"{q['questionId']} [{q['section']}]: Marks={q['marks']}M, Parent={q['parentQuestion']}, OptWith={q['optionalWith']}")
