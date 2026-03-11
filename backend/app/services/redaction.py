import re

EMAIL_PATTERN = re.compile(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b")
CREDIT_CARD_PATTERN = re.compile(r"\b(?:\d[ -]?){13,19}\b")


def mask_sensitive_ids(text: str) -> str:
    masked = EMAIL_PATTERN.sub("[REDACTED]", text)
    return CREDIT_CARD_PATTERN.sub(_mask_credit_card_match, masked)


def _mask_credit_card_match(match: re.Match[str]) -> str:
    value = match.group(0)
    digits = re.sub(r"\D", "", value)
    if len(digits) < 13 or len(digits) > 19:
        return value
    if not _passes_luhn(digits):
        return value
    return "[REDACTED]"


def _passes_luhn(value: str) -> bool:
    total = 0
    reverse_digits = value[::-1]
    for index, char in enumerate(reverse_digits):
        digit = int(char)
        if index % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0
