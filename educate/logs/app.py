"""
Acadion AI Paper Parser Microservice
FastAPI Server running on port 5000
Processes Question Papers directly using OpenRouter AI / LLM Extraction
"""

import os
import io
import json
import httpx
from typing import Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from ai_extractor import extract_questions_with_ai, MODEL_NAME
from pdf_reader import extract_text_from_pdf_bytes, extract_text_from_pdf_file, extract_text_from_image_bytes
from ml_risk_xai import analyze_student_risk
from rag_tutor import index_module_notes, ask_study_tutor, get_indexed_modules

app = FastAPI(title="Acadion AI Paper Parser, ML XAI & RAG Tutor Microservice", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextParseRequest(BaseModel):
    text: str

class FilePathParseRequest(BaseModel):
    file_path: str

class StudentRiskPredictionRequest(BaseModel):
    studentId: Optional[str] = None
    usn: Optional[str] = None
    name: Optional[str] = None
    cieScaledPct: Optional[float] = 75.0
    weakTopicsCount: Optional[int] = 0
    moduleMasteryAvg: Optional[float] = 70.0
    choiceSkipRatio: Optional[float] = 0.0
    attendancePct: Optional[float] = 85.0
    weakTopics: Optional[List[str]] = []

class RagChatRequest(BaseModel):
    classroomId: str
    query: str
    focusTopic: Optional[str] = None
    focusModule: Optional[int] = None

@app.get("/")
@app.get("/health")
def health():
    return {
        "status": "UP",
        "service": "Acadion AI Microservice",
        "model": MODEL_NAME,
        "port": 5000
    }

@app.post("/rag/upload-notes")
async def rag_upload_notes_endpoint(
    file: UploadFile = File(...),
    classroomId: str = Form(...),
    moduleNumber: int = Form(...)
):
    """
    Uploads and indexes course notes PDF for a specific syllabus module (1 to 5).
    """
    try:
        content = await file.read()
        filename = file.filename or f"module_{moduleNumber}_notes.pdf"
        result = index_module_notes(
            classroom_id=classroomId,
            module_number=int(moduleNumber),
            pdf_bytes=content,
            filename=filename
        )
        return result
    except Exception as e:
        print(f"[RAG Upload Error]: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to index module notes: {str(e)}")

@app.post("/rag/chat")
def rag_chat_endpoint(req: RagChatRequest):
    """
    Grounded Study Tutor chat against uploaded course notes.
    """
    try:
        if not req.query or not req.query.strip():
            raise HTTPException(status_code=400, detail="Empty query provided")

        result = ask_study_tutor(
            classroom_id=req.classroomId,
            student_query=req.query,
            focus_topic=req.focusTopic,
            focus_module=req.focusModule
        )
        return result
    except Exception as e:
        print(f"[RAG Chat Error]: {e}")
        raise HTTPException(status_code=500, detail=f"RAG Tutor query failed: {str(e)}")

@app.get("/rag/modules/{classroom_id}")
def rag_get_modules_status_endpoint(classroom_id: str):
    """
    Returns indexing status for Modules 1 to 5.
    """
    try:
        return get_indexed_modules(classroom_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check module status: {str(e)}")

@app.post("/ml/predict-student-risk")
def predict_student_risk_endpoint(req: StudentRiskPredictionRequest):
    """
    Evaluates student academic failure risk using Random Forest & SHAP TreeExplainer.
    Returns predicted risk class, probabilities, feature attribution percentages, and targeted actions.
    """
    try:
        features = {
            "cieScaledPct": req.cieScaledPct,
            "weakTopicsCount": req.weakTopicsCount,
            "moduleMasteryAvg": req.moduleMasteryAvg,
            "choiceSkipRatio": req.choiceSkipRatio,
            "attendancePct": req.attendancePct
        }
        weak_topics = req.weakTopics or []
        xai_result = analyze_student_risk(features, weak_topics)
        
        # Attach student metadata
        xai_result["studentId"] = req.studentId
        xai_result["usn"] = req.usn
        xai_result["name"] = req.name

        return xai_result
    except Exception as e:
        print(f"[ML Prediction Error]: {e}")
        raise HTTPException(status_code=500, detail=f"ML Risk Prediction failed: {str(e)}")

@app.post("/api/ai/parse-text")
def parse_text_endpoint(req: TextParseRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text provided")

    try:
        result = extract_questions_with_ai(req.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI extraction error: {str(e)}")

@app.post("/api/ai/parse-filepath")
def parse_filepath_endpoint(req: FilePathParseRequest):
    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")

    try:
        text = extract_text_from_pdf_file(req.file_path)
        if not text:
            raise HTTPException(status_code=400, detail="Could not extract text layer from PDF")
        result = extract_questions_with_ai(text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File extraction error: {str(e)}")

@app.post("/api/ai/upload-paper")
async def upload_paper_direct_ai(
    file: UploadFile = File(...),
    paperId: Optional[str] = Form(None),
    subject: Optional[str] = Form(None),
    internalNo: Optional[int] = Form(None),
    examName: Optional[str] = Form(None),
    saveToDb: Optional[bool] = Form(True),
):
    """
    Directly uploads and parses a question paper using Python AI Microservice.
    Bypasses Java OCR / local backend parsing completely.
    """
    try:
        content = await file.read()
        filename = file.filename or "paper.pdf"
        
        extracted_text = ""
        if filename.lower().endswith(".pdf"):
            extracted_text = extract_text_from_pdf_bytes(content)
        elif filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff")):
            extracted_text = extract_text_from_image_bytes(content)
        elif filename.lower().endswith((".txt", ".md")):
            extracted_text = content.decode("utf-8", errors="ignore")
        else:
            # Try decoding as text or fallback
            extracted_text = extract_text_from_image_bytes(content)
            if not extracted_text:
                extracted_text = content.decode("utf-8", errors="ignore")

        if not extracted_text or len(extracted_text.strip()) < 10:
            # Fallback if binary / scanned
            extracted_text = f"Question Paper uploaded: {filename}. Please generate standardized questions for {subject or 'Engineering Subject'} Internal Assessment."

        # Extract structured questions and metadata using LLM
        ai_result = extract_questions_with_ai(extracted_text)

        metadata = ai_result.get("metadata", {})
        questions = ai_result.get("questions", [])

        # Override with user-provided parameters if supplied
        final_paper_id = (paperId and paperId.strip()) or metadata.get("subjectCode") or f"PAPER_{abs(hash(filename)) % 10000}"
        final_subject = (subject and subject.strip()) or metadata.get("subject") or "Engineering Subject"
        final_internal = internalNo if internalNo is not None else metadata.get("internalNo", 1)
        final_exam_name = (examName and examName.strip()) or metadata.get("examName") or "Internal Assessment Test"

        payload = {
            "paperId": final_paper_id,
            "subject": final_subject,
            "subjectCode": metadata.get("subjectCode") or final_paper_id,
            "examName": final_exam_name,
            "collegeName": metadata.get("collegeName") or "Engineering College",
            "semester": str(metadata.get("semester") or "6"),
            "date": metadata.get("date") or "2026",
            "duration": metadata.get("duration") or "75 min",
            "maxMarks": float(metadata.get("maxMarks") or 40.0),
            "totalMarks": float(metadata.get("maxMarks") or 40.0),
            "internalNo": int(final_internal or 1),
            "paperCategory": metadata.get("paperCategory") or "ASSESSMENT",
            "paperFormat": metadata.get("paperFormat") or "THEORY",
            "questions": questions
        }

        # If saveToDb is True, save to Spring Boot MongoDB database
        if saveToDb:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post("http://localhost:8080/api/papers/create", json=payload)
                    if resp.status_code in (200, 201):
                        payload["savedToDatabase"] = True
                        payload["dbResponse"] = resp.json()
                        print(f"[Success]: Saved paper '{payload['paperId']}' to MongoDB successfully via Spring Boot /api/papers/create")
                    else:
                        print(f"[Warning]: DB POST returned status {resp.status_code}: {resp.text}")
                        payload["savedToDatabase"] = False
            except Exception as db_err:
                print(f"[Warning]: Failed to persist to Spring Boot DB: {db_err}")
                payload["savedToDatabase"] = False

        return {
            "success": True,
            "message": "Question paper parsed successfully by AI microservice!",
            "paper": payload,
            "questions": questions,
            "metadata": metadata
        }

    except Exception as e:
        print(f"[Upload Error]: {e}")
        raise HTTPException(status_code=500, detail=f"AI Paper Parsing failed: {str(e)}")

if __name__ == "__main__":
    print("==================================================")
    print(" Starting Acadion AI Microservice on Port 5000... ")
    print("==================================================")
    uvicorn.run(app, host="127.0.0.1", port=5000)
