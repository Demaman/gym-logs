SCHEMA = "identity"


class Role:
    ATHLETE = "athlete"
    TRAINER = "trainer"
    GYM_ADMIN = "gym_admin"

    ALL: tuple[str, ...] = (ATHLETE, TRAINER, GYM_ADMIN)
    STAFF: tuple[str, ...] = (TRAINER, GYM_ADMIN)
