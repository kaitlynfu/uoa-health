import type { Career, Programme } from '../types/programme';
import { studentRequest, type CareerRecord } from './studentApi.ts';

// UI-only grouping; never replace the backend's canonical career identities.
export function careerCategory(name: string): string {
    if (/mental|psycholog|counsell|psychiatr/i.test(name)) return 'Mental Health';
    if (/public health|policy|community|epidemiolog/i.test(name)) return 'Public Health';
    if (/data|software|informatics|technology/i.test(name)) return 'Tech';
    if (/research|scientist|laboratory/i.test(name)) return 'Research';
    if (/doctor|medicine$|nurs|pharmac|optomet|physiotherap|dent|midwi|clinical/i.test(name)) return 'Clinical';
    return 'Other';
}
export function adaptCareer(row: CareerRecord, programmes: Programme[] = []): Career {
    return { ...row, title: row.name, category: careerCategory(row.name), programmes,
        programme_id: programmes[0]?.id ?? null, programme_name: programmes[0]?.name ?? null };
}
export async function getCareers(query = ''): Promise<Career[]> {
    const rows = await studentRequest<CareerRecord[]>(`/careers?limit=200${query.trim() ? '&q=' + encodeURIComponent(query.trim()) : ''}`);
    return rows.map(row => adaptCareer(row));
}
export async function getCareerDetails(id: number): Promise<Career> {
    const row = await studentRequest<CareerRecord & { programmes: Programme[] }>(`/careers/${id}`);
    return adaptCareer(row, row.programmes);
}
export const searchCareers = getCareers;
