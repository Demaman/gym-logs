from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser
from core.database import get_db
from modules.ai.schemas import GenerateProgramRequest
from modules.ai.services import AIService
from modules.training.schemas import ProgramResponse

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate-program", response_model=ProgramResponse)
async def generate_program(
    body: GenerateProgramRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProgramResponse:
    service = AIService(db)
    return await service.generate_program(
        current_user,
        athlete_id=body.athlete_id,
        notes=body.notes,
        locale=body.locale,
    )
