from openhands_factory.redaction import redact_mapping, redact_text


def test_redacts_keys_and_bearer_tokens() -> None:
    assert redact_mapping({"api_key": "secret", "model": "safe"}) == {
        "api_key": "[REDACTED]",
        "model": "safe",
    }
    assert "token-value" not in redact_text("Authorization: Bearer token-value")
