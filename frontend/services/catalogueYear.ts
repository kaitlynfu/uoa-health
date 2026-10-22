export function validCatalogueYear(year: string): boolean {
    return /^\d{4}$/.test(year) && Number(year) >= 2024 && Number(year) <= 2100;
}
