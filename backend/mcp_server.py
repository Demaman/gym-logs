"""
MCP dev-tools server for gym-logs.

Exposes read-only tools so Claude Code developers can query live gym-logs data
during development.  Not used by the production app — production uses the
Anthropic API directly via modules/ai/services.py.

Usage:
    uv run python backend/mcp_server.py

Connect in Claude Code (.claude/settings.json — local only, never committed):
    {
      "mcpServers": {
        "gym-logs": {
          "command": "uv",
          "args": ["run", "python", "backend/mcp_server.py"],
          "cwd": "<repo-root>"
        }
      }
    }
"""

import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(__file__))

from fastmcp import FastMCP
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.config import settings
from db.repositories.analytics import (
    AthleteProfileRepository,
    BodyMeasurementRepository,
)
from db.repositories.identity import OrganizationRepository
from db.repositories.training import ExerciseRepository, ProgramRepository

_engine = create_async_engine(settings.database_url, echo=False)
_SessionLocal = async_sessionmaker(_engine, expire_on_commit=False)

mcp = FastMCP(
    "gym-logs",
    description="Dev tools for gym-logs — read-only access to the live DB",
)


@mcp.tool()
async def gym_list_exercises(
    query: str | None = None,
    muscle_group: str | None = None,
    equipment: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """Search the exercise catalog. Returns id, name, muscle_group, equipment."""
    async with _SessionLocal() as session:
        repo = ExerciseRepository(session)
        exercises = await repo.search(
            None,
            query=query,
            muscle_group=muscle_group,
            equipment=equipment,
            limit=limit,
        )
        return [
            {
                "id": str(e.id),
                "name": e.name,
                "muscle_group": e.muscle_group,
                "equipment": e.equipment,
                "movement_pattern": e.movement_pattern,
                "is_global": e.is_global,
            }
            for e in exercises
        ]


@mcp.tool()
async def gym_get_athlete_context(athlete_id: str) -> dict:
    """Return profile and latest body measurement for a given user UUID."""
    uid = uuid.UUID(athlete_id)
    async with _SessionLocal() as session:
        profile_repo = AthleteProfileRepository(session)
        measurement_repo = BodyMeasurementRepository(session)
        profile = await profile_repo.get_by_user(uid)
        measurement = await measurement_repo.get_latest(uid)

        freq = profile.training_frequency_available if profile else None
        return {
            "profile": {
                "primary_goal": profile.primary_goal if profile else None,
                "training_age_years": profile.training_age_years if profile else None,
                "training_frequency_available": freq,
                "competition_level": profile.competition_level if profile else None,
                "injury_history": profile.injury_history if profile else None,
                "contraindications": profile.contraindications if profile else None,
                "parq_cleared": profile.parq_cleared if profile else None,
            },
            "latest_measurement": {
                "measured_at": str(measurement.measured_at) if measurement else None,
                "weight_kg": measurement.weight_kg if measurement else None,
                "body_fat_pct": measurement.body_fat_pct if measurement else None,
                "lean_mass_kg": measurement.lean_mass_kg if measurement else None,
            },
        }


@mcp.tool()
async def gym_list_programs(
    athlete_id: str | None = None,
    org_id: str | None = None,
) -> list[dict]:
    """List training programs. Optionally filter by athlete_id or org_id."""
    async with _SessionLocal() as session:
        repo = ProgramRepository(session)
        if athlete_id:
            uid = uuid.UUID(athlete_id)
            oid = uuid.UUID(org_id) if org_id else None
            programs = await repo.list_for_athlete(uid, oid)
        elif org_id:
            programs = await repo.list_for_org(uuid.UUID(org_id))
        else:
            return []

        return [
            {
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "mode": p.mode,
                "athlete_id": str(p.athlete_id),
                "created_by_id": str(p.created_by_id),
                "days_count": len(p.days),
            }
            for p in programs
        ]


@mcp.tool()
async def gym_get_org(org_id: str) -> dict:
    """Return organization details including the current subscription plan."""
    async with _SessionLocal() as session:
        repo = OrganizationRepository(session)
        org = await repo.get_by_id(uuid.UUID(org_id))
        if not org:
            return {"error": "Organization not found"}
        return {
            "id": str(org.id),
            "name": org.name,
            "plan": org.plan,
            "join_code": org.join_code,
        }


if __name__ == "__main__":
    asyncio.run(mcp.run_async())
