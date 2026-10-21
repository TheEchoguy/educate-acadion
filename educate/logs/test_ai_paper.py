import json
from ai_extractor import parse_questions_heuristically

sample_text = """
Wayanamac Education Trust®
DON BOSCO INSTITUTE OF TECHNOLOGY
Kumbalgodu, Mysore Road, Bengaluru – 560074
Department of Computer Science & Engineering
Internal Assessment Test-II
Course Name: Artificial Intelligence Course Code: AI-INT-601 Date: 15/08/2026
Semester & Section: VI A, B & C Max marks: 40 Time: 75 min
Date: 15/08/2026 Time: 75 min Questions M L
Note: 1. Answer any two full questions, choosing one full question from each Module.
2. M – Marks, L – Bloom's level, C – Course outcomes.
Module – 2 & 3
Questions M L C
Q1 a
Explain the concept of intelligent agents and describe the structure and working of a rational
agent with a suitable example. 8 2 3
b
Explain uninformed search techniques. Compare Breadth First Search (BFS) and Depth First
Search (DFS) with respect to completeness, optimality and complexity. 8 3 3
c What is a heuristic function? Explain the role of heuristics in informed search. 4 1 3
OR
Q2 a
Explain A* search algorithm with its evaluation function. Discuss the conditions under which A*
is complete and optimal. 8 2 3
b
Explain the Minimax algorithm for game playing and describe the role of utility values in
decision making. 8 3 3
c What is alpha-beta pruning? State how it improves the efficiency of Minimax search. 4 1 3
Module – 3
Q3 a
Define knowledge representation. Explain propositional logic and its use in representing
knowledge in Artificial Intelligence. 8 2 4
b
Explain first-order logic and discuss the representation of facts, objects, relations and rules
using suitable examples. 8 3 4
c What is inference in Artificial Intelligence? Explain forward chaining briefly. 4 1 4
OR
Q4 a
Explain Bayesian reasoning and Bayes' theorem. Illustrate its application in decision making
with a suitable example. 8 2 4
b
Explain the concept of uncertainty in Artificial Intelligence and describe how probability is used
to handle uncertain knowledge. 8 3 4
c
Discuss any two real-world applications of AI that use knowledge representation or probabilistic
reasoning. 4 2 4
At the end of the course the student will be able to
CO1: Explain the fundamental concepts of Artificial Intelligence and intelligent agents.
CO2: Apply uninformed and informed search techniques to solve AI problems.
CO3: Represent knowledge using logic and perform reasoning under certainty and uncertainty.
CO4: Analyze AI techniques and identify suitable applications for real-world problems.
"""

result = parse_questions_heuristically(sample_text)
print("TOTAL QUESTIONS EXTRACTED:", len(result["questions"]))
print("METADATA:", json.dumps(result["metadata"], indent=2))
print("QUESTIONS:")
for q in result["questions"]:
    print(f"  {q['questionId']} [{q['marks']}M] ({q['topic']}) -> {q['text'][:60]}...")
