# workout_session.finished payload contract (published by SessionService.finish_session):
# {
#   session_id: str,
#   athlete_id: str,
#   organization_id: str | None,
#   program_day_id: str | None,
#   total_volume_kg: float,
#   sets_by_type: dict[str, int],
#   duration_seconds: int,
#   finished_at: str,  # ISO 8601
# }
# The analytics module subscribes to this event via core/events.subscribe().
