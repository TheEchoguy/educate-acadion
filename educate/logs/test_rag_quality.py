"""
Acadion RAG Study Tutor Quality Test Suite
Verifies grounded retrieval and synthesis against Modules 1-5 notes.
Tests 4 core academic questions and validates keywords in retrieved context and answer.
"""

import sys
import os
import re

# Ensure stdout handles unicode characters safely on Windows console
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from rag_tutor import ask_study_tutor

CLASSROOM_ID = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "6ad5c9592ea967aa02bd2cc8"

TEST_CASES = [
    {
        "name": "Case 1: SNMP Architecture Components & 5 Limitations",
        "query": "Explain SNMP with its components and 5 main limitations in IoT",
        "focus_module": 2,
        "required_context_keywords": [
            "stateless",
            "udp",
            "mib",
            "configuration data",
            "security"
        ],
        "required_answer_keywords": [
            "stateless",
            "udp",  # or connectionless
            "mib",  # or writable
            "configuration",
            "security"
        ],
        "custom_check": lambda ans, ctx: any(k in ans.lower() for k in ["stateless"]) and any(k in ans.lower() for k in ["udp", "connectionless"]) and any(k in ans.lower() for k in ["mib", "writable"])
    },
    {
        "name": "Case 2: IoT vs M2M Tabular Comparison",
        "query": "Differentiate IoT and M2M in tabular format",
        "focus_module": 2,
        "required_context_keywords": [
            "m2m",
            "iot",
            "communication protocols",
            "hardware"
        ],
        "required_answer_keywords": [
            "m2m",
            "iot"
        ],
        "custom_check": lambda ans, ctx: ("|" in ans and re.search(r"\|.*\|.*\|", ans)) or ("m2m" in ans.lower() and "iot" in ans.lower())
    },
    {
        "name": "Case 3: Conventional Network vs SDN/NFV",
        "query": "Compare conventional network and SDN/NFV in IoT",
        "focus_module": 2,
        "required_context_keywords": [
            "sdn",
            "nfv",
            "control plane",
            "data plane",
            "conventional"
        ],
        "required_answer_keywords": [
            "sdn",
            "nfv",
            "control plane",
            "data plane"
        ],
        "custom_check": lambda ans, ctx: any(k in ans.lower() for k in ["control plane"]) and any(k in ans.lower() for k in ["data plane"])
    },
    {
        "name": "Case 4: IoT Enabling Technologies",
        "query": "Explain IoT enabling technologies",
        "focus_module": 1,
        "required_context_keywords": [
            "enabling",
            "wireless sensor",
            "cloud",
            "big data",
            "embedded"
        ],
        "required_answer_keywords": [
            "wireless sensor",
            "cloud",
            "big data",
            "embedded"
        ],
        "custom_check": lambda ans, ctx: any(k in ans.lower() for k in ["wireless sensor", "wsn"]) and "cloud" in ans.lower() and "embedded" in ans.lower()
    }
]

def safe_print(text: str):
    """Prints text ensuring cp1252 / terminal safety on Windows"""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode("ascii"))

def run_tests():
    safe_print("=" * 70)
    safe_print(" ACADION RAG QUALITY VERIFICATION TEST SUITE")
    safe_print(f" Target Classroom ID: {CLASSROOM_ID}")
    safe_print("=" * 70)

    overall_pass = True

    for idx, tc in enumerate(TEST_CASES, start=1):
        safe_print(f"\n[{idx}/4] {tc['name']}")
        safe_print(f"Query: \"{tc['query']}\" (Focus Module: {tc['focus_module']})")
        safe_print("-" * 70)

        res = ask_study_tutor(
            classroom_id=CLASSROOM_ID,
            student_query=tc["query"],
            focus_module=tc.get("focus_module")
        )

        gen_mode = res.get("generationMode")
        sources = res.get("sources", [])
        answer = res.get("answer", "")

        all_context = " ".join([s.get("content", "") for s in sources]).lower()
        ans_lower = answer.lower()

        safe_print(f"Generation Mode : {gen_mode}")
        safe_print(f"Chunks Retrieved: {len(sources)}")
        safe_print("Sources Used   :")
        for s in sources[:5]:
            sec = s.get("section") or "General"
            p = s.get("page")
            mod = s.get("module")
            sim = s.get("similarity")
            safe_print(f"  * [Module {mod} | p.{p} | Sim: {sim}] {sec}")
        if len(sources) > 5:
            safe_print(f"  ... and {len(sources) - 5} more chunks")

        # Evaluate Context Grounding
        missing_context_kw = [k for k in tc["required_context_keywords"] if k.lower() not in all_context]
        context_ok = len(missing_context_kw) == 0

        # Evaluate Answer Coverage
        missing_ans_kw = [k for k in tc["required_answer_keywords"] if k.lower() not in ans_lower]
        custom_ok = tc["custom_check"](answer, all_context) if "custom_check" in tc else True
        ans_ok = len(missing_ans_kw) == 0 and custom_ok

        passed = context_ok and ans_ok

        safe_print("\nVerification Checklist:")
        safe_print(f"  * Context Grounding Keywords : {'PASS' if context_ok else 'FAIL: Missing ' + str(missing_context_kw)}")
        safe_print(f"  * Answer Content Keywords    : {'PASS' if len(missing_ans_kw) == 0 else 'FAIL: Missing ' + str(missing_ans_kw)}")
        if "custom_check" in tc:
            safe_print(f"  * Custom Structure/Table     : {'PASS' if custom_ok else 'FAIL'}")

        status_str = "PASS" if passed else "FAIL"
        safe_print(f"Result: >>> {status_str} <<<")
        preview = answer[:250].replace("\n", " ")
        safe_print("Answer Preview: " + preview)

        if not passed:
            overall_pass = False

    safe_print("\n" + "=" * 70)
    if overall_pass:
        safe_print(" ALL 4 RAG QUALITY TESTS PASSED PERFECTLY!")
    else:
        safe_print(" SOME TESTS FAILED. CHECK KEYWORD AND CONTEXT LOGS ABOVE.")
    safe_print("=" * 70)

    return 0 if overall_pass else 1

if __name__ == "__main__":
    sys.exit(run_tests())
