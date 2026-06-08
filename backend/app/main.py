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
        insert("schools", {"name": "Demo International School", "address": "123 Education St"})
        _time.sleep(_API_DELAY)
        school = select("schools", limit=1)
    school_id = school[0]["id"]

    users = select("users", limit=1)
    if not users:
        from app.core.security import hash_password
        admin = insert("users", {
            "username": "admin", "email": "admin@school.com",
            "password_hash": hash_password("admin123"),
            "full_name": "System Administrator", "role": "super_admin",
        })
        _time.sleep(_API_DELAY)
        t1 = insert("users", {
            "username": "teacher1", "email": "teacher1@school.com",
            "password_hash": hash_password("teacher123"),
            "full_name": "John Teacher", "role": "teacher", "school_id": school_id,
        })
        _time.sleep(_API_DELAY)
        t2 = insert("users", {
            "username": "teacher2", "email": "teacher2@school.com",
            "password_hash": hash_password("teacher123"),
            "full_name": "Jane Teacher", "role": "teacher", "school_id": school_id,
        })
        _time.sleep(_API_DELAY)
        teacher1_id = t1[0]["id"]
        teacher2_id = t2[0]["id"]
    else:
        all_users = select("users")
        admin_user = next((u for u in all_users if u["username"] == "admin"), None)
        admin_id = admin_user["id"] if admin_user else None
        teacher1 = next((u for u in all_users if u["username"] == "teacher1"), None)
        teacher2 = next((u for u in all_users if u["username"] == "teacher2"), None)
        teacher1_id = teacher1["id"] if teacher1 else None
        teacher2_id = teacher2["id"] if teacher2 else None

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
    # Build a lookup: (class_id, name) -> subject dict
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

    existing_assignments = select("teacher_assignments") if (teacher1_id or teacher2_id) else []
    existing_assign_set = {(a["teacher_id"], a["class_id"], a["subject_id"]) for a in existing_assignments}

    needs_assignments = []
    if teacher1_id:
        for cls_name, subj_name in [("JSS 1", "Mathematics"), ("JSS 1", "English Studies"), ("SS 2", "Mathematics")]:
            cls = class_objs.get(cls_name)
            if not cls:
                continue
            subj = subj_by_key.get((cls["id"], subj_name))
            if subj and (teacher1_id, cls["id"], subj["id"]) not in existing_assign_set:
                needs_assignments.append({"teacher_id": teacher1_id, "class_id": cls["id"], "subject_id": subj["id"]})

    if teacher2_id:
        for cls_name, subj_name in [("SS 2", "English Language"), ("SS 2", "Biology")]:
            cls = class_objs.get(cls_name)
            if not cls:
                continue
            subj = subj_by_key.get((cls["id"], subj_name))
            if subj and (teacher2_id, cls["id"], subj["id"]) not in existing_assign_set:
                needs_assignments.append({"teacher_id": teacher2_id, "class_id": cls["id"], "subject_id": subj["id"]})

    if needs_assignments:
        insert("teacher_assignments", needs_assignments)
        _time.sleep(_API_DELAY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.output_dir, exist_ok=True)
    seed_data() if not select("users", limit=1) else None
    yield


app = FastAPI(title="ExamVault", lifespan=lifespan)

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
