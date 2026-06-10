import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.supabase_db import select, insert, update

CURRICULUM: dict[str, list[str]] = {
    "Reception": [
        "Literacy", "Numeracy", "Basic Science", "Social Habits",
        "Health Habits", "Creative Arts", "Religious Studies", "Physical Development",
    ],
    "Primary 1": [
        "English Studies", "Mathematics", "Basic Science", "Nigerian History",
        "Social and Citizenship Studies", "Agricultural Science", "Home Economics",
        "Physical & Health Education", "Cultural & Creative Arts",
        "Christian Religious Studies", "Computer Studies",
    ],
    "Primary 2": [
        "English Studies", "Mathematics", "Basic Science", "Nigerian History",
        "Social and Citizenship Studies", "Agricultural Science", "Home Economics",
        "Physical & Health Education", "Cultural & Creative Arts",
        "Christian Religious Studies", "Computer Studies",
    ],
    "Primary 3": [
        "English Studies", "Mathematics", "Basic Science", "Nigerian History",
        "Social and Citizenship Studies", "Agricultural Science", "Home Economics",
        "Physical & Health Education", "Cultural & Creative Arts",
        "Christian Religious Studies", "Computer Studies",
    ],
    "Primary 4": [
        "English Studies", "Mathematics", "Basic Science", "Nigerian History",
        "Social and Citizenship Studies", "Agricultural Science", "Home Economics",
        "Physical & Health Education", "Cultural & Creative Arts",
        "Christian Religious Studies", "Computer Studies",
    ],
    "Primary 5": [
        "English Studies", "Mathematics", "Basic Science", "Nigerian History",
        "Social and Citizenship Studies", "Agricultural Science", "Home Economics",
        "Physical & Health Education", "Cultural & Creative Arts",
        "Christian Religious Studies", "Computer Studies",
    ],
    "Primary 6": [
        "English Studies", "Mathematics", "Basic Science", "Nigerian History",
        "Social and Citizenship Studies", "Agricultural Science", "Home Economics",
        "Physical & Health Education", "Cultural & Creative Arts",
        "Christian Religious Studies", "Computer Studies",
    ],
    "JSS 1": [
        "English Studies", "Mathematics", "Basic Science", "Basic Technology",
        "Computer Studies", "Physical & Health Education", "Nigerian History",
        "Social and Citizenship Studies", "Cultural & Creative Arts", "Agricultural Science",
        "Home Economics", "Business Studies", "Christian Religious Studies",
    ],
    "JSS 2": [
        "English Studies", "Mathematics", "Basic Science", "Basic Technology",
        "Computer Studies", "Physical & Health Education", "Nigerian History",
        "Social and Citizenship Studies", "Cultural & Creative Arts", "Agricultural Science",
        "Home Economics", "Business Studies", "Christian Religious Studies",
    ],
    "JSS 3": [
        "English Studies", "Mathematics", "Basic Science", "Basic Technology",
        "Computer Studies", "Physical & Health Education", "Nigerian History",
        "Social and Citizenship Studies", "Cultural & Creative Arts", "Agricultural Science",
        "Home Economics", "Business Studies", "Christian Religious Studies",
    ],
    "SS 1": [
        "English Language", "Mathematics", "Social and Citizenship Studies",
        "Biology", "Chemistry", "Physics",
        "Economics", "Commerce", "Literature in English",
        "Government", "Geography", "Agricultural Science",
        "Further Mathematics", "Computer Science",
        "Christian Religious Studies", "History", "Financial Accounting",
    ],
    "SS 2": [
        "English Language", "Mathematics", "Social and Citizenship Studies",
        "Biology", "Chemistry", "Physics",
        "Economics", "Commerce", "Literature in English",
        "Government", "Geography", "Agricultural Science",
        "Further Mathematics", "Computer Science",
        "Christian Religious Studies", "History", "Financial Accounting",
    ],
    "SS 3": [
        "English Language", "Mathematics", "Social and Citizenship Studies",
        "Biology", "Chemistry", "Physics",
        "Economics", "Commerce", "Literature in English",
        "Government", "Geography", "Agricultural Science",
        "Further Mathematics", "Computer Science",
        "Christian Religious Studies", "History", "Financial Accounting",
    ],
}

CLASS_NAMES = [
    "Reception",
    "Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6",
    "JSS 1", "JSS 2", "JSS 3",
    "SS 1", "SS 2", "SS 3",
]


import time as _time

_API_DELAY = 0.3


def seed_data():
    school = select("schools", limit=1)
    if not school:
        insert("schools", {"name": "Default School", "address": ""})
        _time.sleep(_API_DELAY)
        school = select("schools", limit=1)
    school_id = school[0]["id"]

    existing_classes = select("classes", filters={"school_id": f"eq.{school_id}"})
    existing_class_names = {c["name"] for c in existing_classes}

    class_objs = {}
    needs_insert = []
    for name in CLASS_NAMES:
        if name in existing_class_names:
            cls = next(c for c in existing_classes if c["name"] == name)
            class_objs[name] = cls
        else:
            needs_insert.append({"name": name, "school_id": school_id})
    if needs_insert:
        results = insert("classes", needs_insert)
        _time.sleep(_API_DELAY)
        for cls in results:
            class_objs[cls["name"]] = cls

    existing_subjects = select("subjects")
    subj_by_key = {(s["class_id"], s["name"]): s for s in existing_subjects}

    needs_subjects = []
    for cls_name, subjects in CURRICULUM.items():
        cls = class_objs.get(cls_name)
        if not cls:
            continue
        for sname in subjects:
            if (cls["id"], sname) not in subj_by_key:
                needs_subjects.append({"name": sname, "class_id": cls["id"]})
    if needs_subjects:
        results = insert("subjects", needs_subjects)
        _time.sleep(_API_DELAY)
        for s in results:
            subj_by_key[(s["class_id"], s["name"])] = s


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.output_dir, exist_ok=True)
    from app.supabase_db import storage_ensure_bucket
    storage_ensure_bucket()
    seed_data()
    yield


app = FastAPI(title="Scribe", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api import auth, users, schools, classes, subjects, assignments, images, dashboard, admin as admin_api

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(schools.router)
app.include_router(classes.router)
app.include_router(subjects.router)
app.include_router(assignments.router)
app.include_router(images.router)
app.include_router(dashboard.router)
app.include_router(admin_api.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
