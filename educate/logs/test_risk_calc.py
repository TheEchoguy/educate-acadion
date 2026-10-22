"""
Unit tests for Acadion ML Risk Prediction and SHAP Explainability Engine
"""
from ml_risk_xai import analyze_student_risk

def test_risk_thresholds():
    # 1. Critical High Risk: 0.0 / 15.0 (CIE 0.0%)
    res_zero = analyze_student_risk({
        "cieScaledPct": 0.0,
        "weakTopicsCount": 0,
        "moduleMasteryAvg": 0.0,
        "choiceSkipRatio": 0.0,
        "attendancePct": 85.0
    }, ["IoT Architecture", "Sensors"])
    assert res_zero["riskLevel"] == "HIGH_RISK", f"Expected HIGH_RISK, got {res_zero['riskLevel']}"
    assert 85.0 <= res_zero["riskScore"] <= 95.0, f"Expected hazard in [85, 95], got {res_zero['riskScore']}"
    assert res_zero["shapAttributions"][0]["direction"] == "INCREASES_RISK"
    assert "Critical Deficit" in res_zero["shapAttributions"][0]["description"]

    # 2. Needs Attention: 7.5 / 15.0 (CIE 50.0%)
    res_mid = analyze_student_risk({
        "cieScaledPct": 50.0,
        "weakTopicsCount": 2,
        "moduleMasteryAvg": 52.0,
        "choiceSkipRatio": 0.2,
        "attendancePct": 80.0
    }, ["IoT Protocols"])
    assert res_mid["riskLevel"] == "NEEDS_ATTENTION", f"Expected NEEDS_ATTENTION, got {res_mid['riskLevel']}"
    assert 45.0 <= res_mid["riskScore"] <= 68.0, f"Expected hazard in [45, 68], got {res_mid['riskScore']}"

    # 3. On Track: 10.0 / 15.0 (CIE 66.7%)
    res_ten = analyze_student_risk({
        "cieScaledPct": 66.7,
        "weakTopicsCount": 0,
        "moduleMasteryAvg": 65.0,
        "choiceSkipRatio": 0.0,
        "attendancePct": 85.0
    }, [])
    assert res_ten["riskLevel"] == "ON_TRACK", f"Expected ON_TRACK, got {res_ten['riskLevel']}"
    assert 20.0 <= res_ten["riskScore"] <= 30.0, f"Expected hazard in [20, 30], got {res_ten['riskScore']}"
    assert res_ten["riskScore"] != res_zero["riskScore"], "Scores must not be identical!"

    # 4. Perfect Distinction: 15.0 / 15.0 (CIE 100.0%)
    res_perfect = analyze_student_risk({
        "cieScaledPct": 100.0,
        "weakTopicsCount": 0,
        "moduleMasteryAvg": 95.0,
        "choiceSkipRatio": 0.0,
        "attendancePct": 95.0
    }, [])
    assert res_perfect["riskLevel"] == "ON_TRACK", f"Expected ON_TRACK, got {res_perfect['riskLevel']}"
    assert res_perfect["riskScore"] <= 15.0, f"Expected hazard <= 15.0, got {res_perfect['riskScore']}"

    print("All ML risk calculation tests passed successfully!")

if __name__ == "__main__":
    test_risk_thresholds()
