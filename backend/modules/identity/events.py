# Identity publishes events; it does not consume any from other modules.
#
# Published event payloads (stable contract — do not change keys):
#
#   organization.created  → {organization_id: str, name: str}
#   user.registered       → {user_id: str, organization_id: str, role: str}
#   user.role_changed     → {user_id: str, organization_id: str,
#                            old_role: str, new_role: str}
#   membership.created    → {membership_id: str, organization_id: str,
#                            trainer_id: str, athlete_id: str}
