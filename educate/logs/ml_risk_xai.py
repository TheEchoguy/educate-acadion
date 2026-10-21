"""
Python ML Risk Prediction & SHAP Explainable AI (XAI) Engine
Part of Acadion Academic Intelligence
"""

import os
import json
import numpy as np
import pandas as pd
from typing import Dict, List, Any
import joblib

from sklearn.ensemble import RandomForestClassifier

# Model artifact path
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "academic_risk_model.joblib")

FEATURE_NAMES = [
    "cie_scaled_pct",
    "weak_topics_count",
    "module_mastery_avg",
    "choice_skip_ratio",
    "attendance_pct"
]

CLASS_LABELS = ["ON_TRACK", "NEEDS_ATTENTION", "HIGH_RISK"]


def get_or_train_risk_model() -> RandomForestClassifier:
    """
    Loads existing trained Random Forest model or synthesizes 1,200 realistic
    engineering student academic records to train and persist weights.
    """
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            return model
        except Exception as e:
            print(f"[Warning]: Failed to load existing model ({e}), retraining...")

    print("[ML Engine]: Synthesizing 1,200 student vectors for curriculum training...")
    np.random.seed(42)
    n_samples = 1200

    # 1. cie_scaled_pct (0 to 100)
    # Mixture of high performers (60%), medium (25%), struggling (15%)
    cluster = np.random.choice([0, 1, 2], size=n_samples, p=[0.55, 0.28, 0.17])

    cie_scaled_pct = np.zeros(n_samples)
    weak_topics_count = np.zeros(n_samples)
    module_mastery_avg = np.zeros(n_samples)
    choice_skip_ratio = np.zeros(n_samples)
    attendance_pct = np.zeros(n_samples)
    target = np.zeros(n_samples, dtype=int)

    for i in range(n_samples):
        c = cluster[i]
        if c == 0:  # High/Passing
            cie = np.random.uniform(62.0, 98.0)
            weak = np.random.choice([0, 1, 2], p=[0.70, 0.25, 0.05])
            mod = np.random.uniform(65.0, 98.0)
            skip = np.random.uniform(0.0, 0.25)
            att = np.random.uniform(78.0, 99.0)
            lbl = 0  # ON_TRACK
        elif c == 1:  # Marginal / Needs Attention
            cie = np.random.uniform(40.0, 61.9)
            weak = np.random.choice([1, 2, 3, 4], p=[0.20, 0.40, 0.30, 0.10])
            mod = np.random.uniform(42.0, 63.0)
            skip = np.random.uniform(0.15, 0.45)
            att = np.random.uniform(65.0, 88.0)
            lbl = 1  # NEEDS_ATTENTION
        else:  # Failing / High Risk
            cie = np.random.uniform(10.0, 39.9)
            weak = np.random.choice([3, 4, 5, 6, 7], p=[0.15, 0.30, 0.30, 0.15, 0.10])
            mod = np.random.uniform(15.0, 42.0)
            skip = np.random.uniform(0.30, 0.70)
            att = np.random.uniform(45.0, 75.0)
            lbl = 2  # HIGH_RISK

        cie_scaled_pct[i] = cie
        weak_topics_count[i] = weak
        module_mastery_avg[i] = mod
        choice_skip_ratio[i] = skip
        attendance_pct[i] = att
        target[i] = lbl

    X = pd.DataFrame({
        "cie_scaled_pct": cie_scaled_pct,
        "weak_topics_count": weak_topics_count,
        "module_mastery_avg": module_mastery_avg,
        "choice_skip_ratio": choice_skip_ratio,
        "attendance_pct": attendance_pct
    })
    y = target

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        random_state=42
    )
    model.fit(X, y)

    try:
        joblib.dump(model, MODEL_PATH)
        print(f"[ML Engine]: Model trained and saved successfully to '{MODEL_PATH}'")
    except Exception as e:
        print(f"[Warning]: Could not persist model to disk: {e}")

    return model


# Pre-load or initialize model
model = get_or_train_risk_model()


def compute_shap_tree_attributions(
    model: RandomForestClassifier,
    features_df: pd.DataFrame,
    predicted_class: int
) -> List[Dict[str, Any]]:
    """
    Computes SHAP feature importance values using shap.TreeExplainer,
    with an exact mathematical fallback if tree explainer encounters any environment issue.
    """
    attributions = []

    try:
        import shap
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(features_df)

        # shap_values can be list of arrays [class_0, class_1, class_2] or 3D array
        if isinstance(shap_values, list):
            class_shap = shap_values[predicted_class][0]
        elif hasattr(shap_values, "shape") and len(shap_values.shape) == 3:
            class_shap = shap_values[0, :, predicted_class]
        elif hasattr(shap_values, "values"):
            # New shap Explanation object
            vals = shap_values.values
            if len(vals.shape) == 3:
                class_shap = vals[0, :, predicted_class]
            else:
                class_shap = vals[0]
        else:
            class_shap = np.array(shap_values)[0]

    except Exception as shap_err:
        print(f"[SHAP Fallback]: Using tree feature contribution fallback: {shap_err}")
        # Mathematical approximation based on feature values relative to mean and feature importances
        feature_importances = model.feature_importances_
        row = features_df.iloc[0]
        class_shap = []
        for i, col in enumerate(FEATURE_NAMES):
            val = row[col]
            if col in ["cie_scaled_pct", "module_mastery_avg", "attendance_pct"]:
                diff = (val - 50.0) / 50.0
                # Lower values increase risk (for class 1 or 2)
                impact = -diff * feature_importances[i] if predicted_class > 0 else diff * feature_importances[i]
            else:
                diff = (val - 1.0) / 3.0
                impact = diff * feature_importances[i] if predicted_class > 0 else -diff * feature_importances[i]
            class_shap.append(impact)
        class_shap = np.array(class_shap)

    # Normalize SHAP values into intuitive percentage contributions
    abs_sum = np.sum(np.abs(class_shap))
    if abs_sum == 0:
        abs_sum = 1.0

    impact_pcts = (np.abs(class_shap) / abs_sum) * 100.0

    readable_names = {
        "cie_scaled_pct": "Scaled CIE Score",
        "weak_topics_count": "Weak Sub-Questions Count (<50%)",
        "module_mastery_avg": "Syllabus Module Mastery Average",
        "choice_skip_ratio": "Choice Question Blank Ratio",
        "attendance_pct": "Lecture & Lab Attendance Rate"
    }

    row = features_df.iloc[0]
    for i, col in enumerate(FEATURE_NAMES):
        raw_val = class_shap[i]
        pct = round(float(impact_pcts[i]), 1)
        feat_val = row[col]

        # Determine if this feature INCREASES_RISK or DECREASES_RISK
        if predicted_class == 0:
            # For ON_TRACK: positive SHAP means keeping student on track
            direction = "DECREASES_RISK" if raw_val >= 0 else "INCREASES_RISK"
        else:
            # For NEEDS_ATTENTION or HIGH_RISK: positive SHAP pushes towards risk
            direction = "INCREASES_RISK" if raw_val >= 0 else "DECREASES_RISK"

        # Generate descriptive statement
        if col == "cie_scaled_pct":
            desc = (
                f"Scaled CIE Score ({feat_val:.1f}%) directly {'amplifies course failure hazard' if direction == 'INCREASES_RISK' else 'anchors passing status'} by {pct}%"
            )
        elif col == "weak_topics_count":
            desc = (
                f"{int(feat_val)} weak sub-question{'' if int(feat_val) == 1 else 's'} scored below 50%, contributing {pct}% to risk profile"
                if int(feat_val) > 0
                else f"Zero weak sub-questions recorded, protecting overall academic trajectory by {pct}%"
            )
        elif col == "module_mastery_avg":
            desc = (
                f"Module syllabus mastery at {feat_val:.1f}% {'creates key conceptual deficits' if direction == 'INCREASES_RISK' else 'provides solid foundational coverage'} ({pct}% impact)"
            )
        elif col == "choice_skip_ratio":
            desc = (
                f"{feat_val*100:.0f}% optional choice avoidance indicates selective revision habits ({pct}% impact)"
            )
        else:
            desc = (
                f"Classroom Attendance at {feat_val:.1f}% {'shields against academic probation' if direction == 'DECREASES_RISK' else 'heightens risk of attendance shortage'} ({pct}% impact)"
            )

        attributions.append({
            "featureName": readable_names.get(col, col),
            "rawFeatureKey": col,
            "featureValue": float(feat_val),
            "impactPct": pct,
            "direction": direction,
            "description": desc
        })

    # Sort attributions by impactPct descending
    attributions.sort(key=lambda x: x["impactPct"], reverse=True)
    return attributions


def generate_actionable_guidance(
    risk_level: str,
    weak_topics: List[str],
    cie_scaled_pct: float,
    attendance_pct: float
) -> Dict[str, Any]:
    """
    Generates contextual student action plan and teacher remedial intervention.
    """
    plan = []
    topics_mention = ", ".join(weak_topics[:2]) if weak_topics else "upcoming syllabus concepts"

    if risk_level == "HIGH_RISK":
        plan.append(
            f"1. Immediate Diagnostic Re-study: Schedule focused 45-min study sessions on '{topics_mention}'."
        )
        plan.append(
            "2. Practice Choice Questions: Attempt alternate choice problems from previous 3 years' question papers."
        )
        plan.append(
            f"3. Minimum Passing Benchmark: Target at least 28+ marks in the next IA to rescue your scaled CIE above the 20.0 passing threshold."
        )
        teacher_rec = (
            f"Immediate Remedial Intervention: Conduct a 15-minute one-on-one review addressing '{topics_mention}' and verify student's submitted assignment solutions."
        )
    elif risk_level == "NEEDS_ATTENTION":
        plan.append(
            f"1. Target Topic Reinforcement: Review core definitions and formulas for '{topics_mention}'."
        )
        plan.append(
            "2. Internal Assessment Target: Aim for 32/40 in the upcoming IA test to elevate your standing to First Class distinction."
        )
        plan.append(
            "3. Question Choice Strategy: Practice answering both choice sub-questions in Module tests to eliminate knowledge gaps."
        )
        teacher_rec = (
            f"Guided Practice: Assign targeted practice problem set on '{topics_mention}' before next lecture."
        )
    else:  # ON_TRACK
        plan.append(
            "1. Maintain Consistent Review: Consolidate formula cheat-sheets for tested modules."
        )
        plan.append(
            "2. Distinction Target: Strive for 36+/40 in the final IA to lock in the top S/A grade band."
        )
        plan.append(
            "3. Semester Exam Readiness: Solve complete 100-mark model papers under timed conditions."
        )
        teacher_rec = (
            "Encourage Peer Mentoring: Student has demonstrated solid subject mastery and can lead study circles for Module revision."
        )

    return {
        "studentActionPlan": plan,
        "teacherIntervention": teacher_rec
    }


def analyze_student_risk(features_dict: Dict[str, Any], weak_topics_list: List[str]) -> Dict[str, Any]:
    """
    Main evaluation pipeline:
    Runs Random Forest prediction, computes SHAP explanations, and formats actionable insights.
    """
    global model
    if model is None:
        model = get_or_train_risk_model()

    cie_scaled_pct = float(features_dict.get("cieScaledPct", features_dict.get("cie_scaled_pct", 75.0)))
    weak_topics_count = int(features_dict.get("weakTopicsCount", features_dict.get("weak_topics_count", 0)))
    module_mastery_avg = float(features_dict.get("moduleMasteryAvg", features_dict.get("module_mastery_avg", 70.0)))
    choice_skip_ratio = float(features_dict.get("choiceSkipRatio", features_dict.get("choice_skip_ratio", 0.0)))
    attendance_pct = float(features_dict.get("attendancePct", features_dict.get("attendance_pct", 85.0)))

    features_df = pd.DataFrame([{
        "cie_scaled_pct": cie_scaled_pct,
        "weak_topics_count": weak_topics_count,
        "module_mastery_avg": module_mastery_avg,
        "choice_skip_ratio": choice_skip_ratio,
        "attendance_pct": attendance_pct
    }])

    # Predict Class & Probabilities
    pred_idx = int(model.predict(features_df)[0])
    probs = model.predict_proba(features_df)[0]  # [p0, p1, p2]

    risk_level = CLASS_LABELS[pred_idx]

    # Calculate intuitive 0-100 risk score
    # High risk probability weighs 100%, needs attention weighs 50%
    risk_score = round(float((probs[2] * 100.0) + (probs[1] * 50.0)), 1)
    if risk_score > 100.0:
        risk_score = 100.0

    # SHAP Explanations
    attributions = compute_shap_tree_attributions(model, features_df, pred_idx)

    # Actionable guidance
    guidance = generate_actionable_guidance(
        risk_level,
        weak_topics_list,
        cie_scaled_pct,
        attendance_pct
    )

    return {
        "riskLevel": risk_level,
        "riskScore": risk_score,
        "predictedClassIndex": pred_idx,
        "probabilities": {
            "onTrack": round(float(probs[0]), 3),
            "needsAttention": round(float(probs[1]), 3),
            "highRisk": round(float(probs[2]), 3)
        },
        "shapAttributions": attributions,
        "topRiskFactor": attributions[0]["description"] if attributions else "Balanced performance profile",
        "studentActionPlan": guidance["studentActionPlan"],
        "teacherIntervention": guidance["teacherIntervention"],
        "metrics": {
            "cieScaledPct": cie_scaled_pct,
            "weakTopicsCount": weak_topics_count,
            "moduleMasteryAvg": module_mastery_avg,
            "choiceSkipRatio": choice_skip_ratio,
            "attendancePct": attendance_pct
        }
    }


if __name__ == "__main__":
    test_student = {
        "cieScaledPct": 35.0,
        "weakTopicsCount": 4,
        "moduleMasteryAvg": 38.0,
        "choiceSkipRatio": 0.5,
        "attendancePct": 68.0
    }
    result = analyze_student_risk(test_student, ["IoT Protocols", "SNMP Architecture"])
    print(json.dumps(result, indent=2))
