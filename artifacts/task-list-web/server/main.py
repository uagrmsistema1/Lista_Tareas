import os
from datetime import datetime
from typing import Any, Mapping

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from psycopg import Connection, connect
from psycopg.rows import dict_row


app = FastAPI(title="Task List API", docs_url=None, redoc_url=None)


class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Task title cannot be blank")
        return title


class TaskUpdate(BaseModel):
    completed: bool


class TaskItem(BaseModel):
    id: int
    title: str
    completed: bool
    createdAt: datetime


class TaskSummary(BaseModel):
    total: int
    pending: int
    completed: int


def get_connection() -> Connection:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL must be configured for the task API")
    return connect(database_url, row_factory=dict_row)


def to_task(row: Mapping[str, Any]) -> TaskItem:
    return TaskItem(
        id=row["id"],
        title=row["title"],
        completed=row["completed"],
        createdAt=row["created_at"],
    )


@app.get("/api/task-api/tasks", response_model=list[TaskItem])
def list_tasks() -> list[TaskItem]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, completed, created_at
            FROM task_list_items
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()
    return [to_task(row) for row in rows]


@app.post(
    "/api/task-api/tasks",
    response_model=TaskItem,
    status_code=status.HTTP_201_CREATED,
)
def create_task(payload: TaskInput) -> TaskItem:
    with get_connection() as connection:
        row = connection.execute(
            """
            INSERT INTO task_list_items (title)
            VALUES (%s)
            RETURNING id, title, completed, created_at
            """,
            (payload.title,),
        ).fetchone()
    return to_task(row)


@app.patch("/api/task-api/tasks/{task_id}", response_model=TaskItem)
def update_task(task_id: int, payload: TaskUpdate) -> TaskItem:
    with get_connection() as connection:
        row = connection.execute(
            """
            UPDATE task_list_items
            SET completed = %s
            WHERE id = %s
            RETURNING id, title, completed, created_at
            """,
            (payload.completed, task_id),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Task not found")
    return to_task(row)


@app.delete("/api/task-api/tasks/{task_id}", response_model=dict[str, bool])
def delete_task(task_id: int) -> dict[str, bool]:
    with get_connection() as connection:
        row = connection.execute(
            "DELETE FROM task_list_items WHERE id = %s RETURNING id",
            (task_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Task not found")
    return {"deleted": True}


@app.get("/api/task-api/summary", response_model=TaskSummary)
def get_task_summary() -> TaskSummary:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE completed) AS completed
            FROM task_list_items
            """
        ).fetchone()

    total = int(row["total"])
    completed = int(row["completed"])
    return TaskSummary(
        total=total,
        pending=total - completed,
        completed=completed,
    )
