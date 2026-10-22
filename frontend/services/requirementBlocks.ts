// Presentation only: retain source wording, numbers and eligibility caveats.
export function requirementBlocks(value: string | null | undefined): string[] {
    if (!value?.trim()) return [];
    return value.replace(/\r\n?/g, '\n')
        .replace(/\s+(?=Qualification\s+(?:NCEA|CIE|IB)\b)/g, '\n')
        .split(/\n+|(?<=[.!?])\s+(?=[A-Z])/)
        .map(part => part.trim()).filter(Boolean);
}
