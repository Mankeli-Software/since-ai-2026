"""Persistence settings (prefix FIRESTORE_). Read only when STORE=firestore.

The client also reads the standard Google env itself: GOOGLE_CLOUD_PROJECT (set on Cloud Run) and
FIRESTORE_EMULATOR_HOST (local emulator, e.g. `localhost:8085`; no credentials needed then).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class FirestoreSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="FIRESTORE_", extra="ignore")

    project: str | None = None  # FIRESTORE_PROJECT; None = GOOGLE_CLOUD_PROJECT / ADC project
    database: str = "(default)"  # FIRESTORE_DATABASE
    collection: str = "sessions"  # FIRESTORE_COLLECTION; top-level collection of session docs
