import json
import uuid

from fastapi import HTTPException, status
from openai import AsyncOpenAI, RateLimitError
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.repositories.analytics import (
    AthleteProfileRepository,
    BodyMeasurementRepository,
)
from db.repositories.identity import OrganizationRepository
from db.repositories.logs.workout_session import WorkoutSessionRepository
from db.repositories.training import ExerciseRepository, ProgramRepository
from modules.training.schemas import ProgramResponse
from modules.training.services import ProgramService


def _make_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.ai_api_key,
        base_url=settings.ai_base_url or None,
    )


class AIService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._org_repo = OrganizationRepository(session)
        self._profile_repo = AthleteProfileRepository(session)
        self._measurement_repo = BodyMeasurementRepository(session)
        self._exercise_repo = ExerciseRepository(session)
        self._program_repo = ProgramRepository(session)
        self._session_repo = WorkoutSessionRepository(session)

    async def generate_program(
        self,
        current_user: dict,
        athlete_id: uuid.UUID | None = None,
        notes: str | None = None,
        locale: str = "en",
    ) -> ProgramResponse:
        if not settings.ai_api_key:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "AI generation is not configured on this server",
            )

        user_id = uuid.UUID(current_user["user_id"])
        org_id_str = current_user.get("organization_id")
        org_id = uuid.UUID(org_id_str) if org_id_str else None
        target_id = athlete_id or user_id

        is_trainer = current_user["role"] in ("trainer", "gym_admin")
        if target_id != user_id and not is_trainer:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Only trainers can generate programs for athletes",
            )

        await self._require_pro(org_id)

        profile = await self._profile_repo.get_by_user(target_id)
        measurement = await self._measurement_repo.get_latest(target_id)
        exercises = await self._exercise_repo.search(org_id, limit=200)
        existing_programs = await self._program_repo.list_for_athlete(
            target_id, org_id, limit=3
        )
        recent_sessions = await self._session_repo.list_for_athlete(
            organization_id=org_id, athlete_id=target_id, limit=8
        )

        valid_ids = {str(e.id) for e in exercises}
        name_to_id = {e.name.lower(): str(e.id) for e in exercises}

        prompt = self._build_prompt(
            profile=profile,
            measurement=measurement,
            exercises=exercises,
            existing_programs=existing_programs,
            recent_sessions=recent_sessions,
            notes=notes,
            locale=locale,
        )

        system_prompt = "\n".join([
            "You are a certified strength and conditioning specialist (CSCS)",
            "following NSCA and ACSM evidence-based guidelines.",
            "",
            "PROGRAMMING STANDARDS — apply every time:",
            "- Full week: include ALL 7 days. Rest days have empty exercises list.",
            "- Volume: 4-6 exercises per training day. Compounds first.",
            "- Sets: 3-5 prescribed_sets per exercise.",
            "  Add a warm_up set before the first compound lift each day.",
            "- Rep ranges: strength=3-6, hypertrophy=8-12, endurance=15+.",
            "- Balance: cover push/pull/legs/core every week regardless of focus.",
            "  'Focus on X' = extra volume on X, not exclusive training.",
            "- No same muscle group on consecutive days.",
            "- Mirror existing program split/frequency, then evolve exercises.",
            "- Use ONLY the exact exercise UUIDs from the catalog.",
            "",
            "Respond with a single JSON object — no markdown, no code fences.",
        ])

        client = _make_client()
        try:
            response = await client.chat.completions.create(
                model=settings.ai_model,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
            )
        except RateLimitError as exc:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                "AI quota exhausted. Check your API key credits or switch providers.",
            ) from exc

        raw = response.choices[0].message.content or ""
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY, "AI returned malformed JSON"
            ) from exc

        # Normalise fields the model sometimes returns as lists instead of strings
        if isinstance(payload.get("guidelines"), list):
            payload["guidelines"] = "\n".join(
                f"- {item}" for item in payload["guidelines"]
            )

        for day in payload.get("days", []):
            for ex in day.get("exercises", []):
                eid = ex.get("exercise_id", "")
                if eid not in valid_ids:
                    # Model sometimes returns name instead of UUID — resolve it
                    resolved = name_to_id.get(eid.lower())
                    if resolved:
                        ex["exercise_id"] = resolved
                    else:
                        raise HTTPException(
                            status.HTTP_422_UNPROCESSABLE_ENTITY,
                            f"AI returned unknown exercise: {eid}",
                        )

        program_service = ProgramService(self._session)
        return await program_service.create_full(current_user, target_id, payload)

    async def _require_pro(self, org_id: uuid.UUID | None) -> None:
        if org_id is None:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                "AI generation requires a Pro organization",
            )
        org = await self._org_repo.get_by_id(org_id)
        if not org or org.plan != "pro":
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                "Upgrade your organization to Pro to use AI program generation",
            )

    _LOCALE_NAMES: dict[str, str] = {
        "pt-BR": "Brazilian Portuguese (pt-BR)",
        "en": "English",
    }

    @staticmethod
    def _build_prompt(
        *,
        profile,
        measurement,
        exercises,
        existing_programs,
        recent_sessions,
        notes: str | None,
        locale: str = "en",
    ) -> str:
        lines: list[str] = []
        lang = AIService._LOCALE_NAMES.get(locale, "English")
        lines.append(
            f"## Language\nWrite the program name, description, guidelines, and all "
            f"day/exercise names in {lang}. Do not use any other language."
        )

        lines.append("## Athlete Profile")
        if profile:
            lines.append(f"- Goal: {profile.primary_goal or 'not specified'}")
            age = profile.training_age_years or "unknown"
            lines.append(f"- Training age: {age} years")
            freq = profile.training_frequency_available or "unknown"
            lines.append(f"- Available days/week: {freq}")
            level = profile.competition_level or "recreational"
            lines.append(f"- Competition level: {level}")
            lines.append(f"- PAR-Q cleared: {profile.parq_cleared}")
            if profile.injury_history:
                lines.append(f"- Injury history: {profile.injury_history}")
            if profile.contraindications:
                lines.append(f"- Contraindications: {profile.contraindications}")
        else:
            lines.append("- No profile on record — assume beginner, general fitness")

        lines.append("\n## Current Body Composition")
        if measurement:
            lines.append(f"- Weight: {measurement.weight_kg or 'N/A'} kg")
            lines.append(f"- Body fat: {measurement.body_fat_pct or 'N/A'}%")
            lines.append(f"- Lean mass: {measurement.lean_mass_kg or 'N/A'} kg")
        else:
            lines.append("- No measurements on record")

        lines.append("\n## Existing Programs (mirror their split structure)")
        if existing_programs:
            for p in existing_programs:
                lines.append(f"\n### {p.name} ({p.mode})")
                for d in sorted(p.days, key=lambda x: x.position):
                    tag = f" [{d.day_tag}]" if d.day_tag else ""
                    ex_names = [
                        pe.exercise.name
                        for pe in sorted(d.exercises, key=lambda x: x.position)
                        if pe.exercise
                    ]
                    ex_str = ", ".join(ex_names) if ex_names else "rest"
                    lines.append(f"  Day {d.position}{tag}: {ex_str}")
        else:
            lines.append("- None yet")

        lines.append("\n## Recent Sessions (last 8 logged workouts)")
        if recent_sessions:
            for s in recent_sessions:
                tag = f" [{s.day_tag}]" if s.day_tag else ""
                lines.append(f"- {s.name}{tag}")
        else:
            lines.append("- No sessions recorded")

        lines.append("\n## Exercise Catalog (use ONLY these exact IDs)")
        for ex in exercises:
            lines.append(
                f"- {ex.id} | {ex.name} | {ex.muscle_group} | {ex.equipment}"
            )

        if notes:
            lines.append(f"\n## Athlete Request\n{notes}")

        lines.append(
            "\n## Output — a single JSON object (no markdown):"
            '\n{"name":"...","description":"...","guidelines":"3-8 bullets",'
            '"mode":"program_driven","days":['
            '{"name":"...","position":1,"day_tag":"upper|lower|push|pull|legs'
            '|chest|back|shoulders|arms|glutes|core|full_body|cardio|custom|rest",'
            '"exercises":['
            '{"exercise_id":"<UUID>","position":1,"prescribed_sets":['
            '{"position":1,"set_type":"warm_up|working|back_off|top_set",'
            '"rep_min":8,"rep_max":12,"rpe_target":8,"rest_seconds":90}'
            "]}]}]}"
            "\nRules: all 7 days; rest days have empty exercises array; "
            "4-6 exercises/training day; 3-5 sets/exercise; "
            "warm_up set on first compound lift each day."
        )
        return "\n".join(lines)
