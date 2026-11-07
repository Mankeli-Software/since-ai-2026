"""EVIDENCE lane settings (AGENTS.md 1.3: lane env vars live in their package, prefix EVIDENCE_)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class EvidenceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EVIDENCE_", extra="ignore")

    # The Wave 2 plausibility rules (plan §5.2, #33) on the import routes and the golfer recheck.
    # On by default: they raise no flags on the persona fixtures or profiles, so the v1 demo flow
    # (Mikko, Hannu, Lars, Anders) is unchanged. EVIDENCE_WAVE2=0 turns them off.
    wave2: bool = True


settings = EvidenceSettings()
