"""EVIDENCE lane settings (AGENTS.md 1.3: lane env vars live in their package, prefix EVIDENCE_)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class EvidenceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="EVIDENCE_", extra="ignore")

    # EVIDENCE_WAVE2=1 adds the Wave 2 plausibility rules (plan §5.2, #33) to the import routes
    # and the golfer recheck. Off by default: the v1 demo flow (Mikko, Hannu, Lars, Anders) is
    # exactly the v1 rules until the team turns it on.
    wave2: bool = False

    # EVIDENCE_ENABLE_G14=1 enables only the G14 rare-spec humour rule (issue #126) without
    # enabling other Wave 2 rules.
    enable_g14: bool = False


settings = EvidenceSettings()
