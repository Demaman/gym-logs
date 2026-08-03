SCHEMA = "training"


class SetType:
    WARM_UP = "warm_up"
    FEEDER = "feeder"
    WORKING = "working"
    BACK_OFF = "back_off"
    TOP_SET = "top_set"
    FAILURE = "failure"
    DROP_SET = "drop_set"
    REST_PAUSE = "rest_pause"
    CLUSTER = "cluster"
    BURNOUT = "burnout"
    TECHNIQUE = "technique"
    DELOAD = "deload"

    ALL: tuple[str, ...] = (
        WARM_UP,
        FEEDER,
        WORKING,
        BACK_OFF,
        TOP_SET,
        FAILURE,
        DROP_SET,
        REST_PAUSE,
        CLUSTER,
        BURNOUT,
        TECHNIQUE,
        DELOAD,
    )


COUNTS_VOLUME_DEFAULT: dict[str, bool] = {
    SetType.WARM_UP: False,
    SetType.FEEDER: False,
    SetType.WORKING: True,
    SetType.BACK_OFF: True,
    SetType.TOP_SET: True,
    SetType.FAILURE: True,
    SetType.DROP_SET: True,
    SetType.REST_PAUSE: True,
    SetType.CLUSTER: True,
    SetType.BURNOUT: True,
    SetType.TECHNIQUE: False,
    SetType.DELOAD: False,
}


class MuscleGroup:
    CHEST = "chest"
    BACK = "back"
    SHOULDERS = "shoulders"
    BICEPS = "biceps"
    TRICEPS = "triceps"
    FOREARMS = "forearms"
    CORE = "core"
    QUADS = "quads"
    HAMSTRINGS = "hamstrings"
    GLUTES = "glutes"
    CALVES = "calves"
    FULL_BODY = "full_body"

    ALL: tuple[str, ...] = (
        CHEST,
        BACK,
        SHOULDERS,
        BICEPS,
        TRICEPS,
        FOREARMS,
        CORE,
        QUADS,
        HAMSTRINGS,
        GLUTES,
        CALVES,
        FULL_BODY,
    )


class Equipment:
    BARBELL = "barbell"
    DUMBBELL = "dumbbell"
    MACHINE = "machine"
    CABLE = "cable"
    BODYWEIGHT = "bodyweight"
    KETTLEBELL = "kettlebell"
    BANDS = "bands"
    OTHER = "other"

    ALL: tuple[str, ...] = (
        BARBELL,
        DUMBBELL,
        MACHINE,
        CABLE,
        BODYWEIGHT,
        KETTLEBELL,
        BANDS,
        OTHER,
    )


class MovementPattern:
    PUSH = "push"
    PULL = "pull"
    SQUAT = "squat"
    HINGE = "hinge"
    CARRY = "carry"
    ROTATION = "rotation"
    ISOLATION = "isolation"

    ALL: tuple[str, ...] = (
        PUSH,
        PULL,
        SQUAT,
        HINGE,
        CARRY,
        ROTATION,
        ISOLATION,
    )


class DayTag:
    PUSH = "push"
    PULL = "pull"
    LEGS = "legs"
    UPPER = "upper"
    LOWER = "lower"
    FULL_BODY = "full_body"
    CARDIO = "cardio"
    CUSTOM = "custom"
    CHEST = "chest"
    BACK = "back"
    SHOULDERS = "shoulders"
    ARMS = "arms"
    GLUTES = "glutes"
    CORE = "core"

    ALL: tuple[str, ...] = (
        PUSH,
        PULL,
        LEGS,
        UPPER,
        LOWER,
        FULL_BODY,
        CARDIO,
        CUSTOM,
        CHEST,
        BACK,
        SHOULDERS,
        ARMS,
        GLUTES,
        CORE,
    )


class SessionMode:
    ON_THE_FLY = "on_the_fly"
    PROGRAM_DRIVEN = "program_driven"

    ALL: tuple[str, ...] = (ON_THE_FLY, PROGRAM_DRIVEN)
