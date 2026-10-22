import type { Programme } from '../types/programme';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
const expiredListeners=new Set<(token:string)=>void>();
export function onSessionExpired(listener:(token:string)=>void){expiredListeners.add(listener);return()=>{expiredListeners.delete(listener);};}
export class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function studentRequest<T>(path: string, token?: string, method = 'GET', body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
    const response = await fetch(baseUrl + path, {
        method,
        signal: controller.signal,
        headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
        if(response.status===401&&token)for(const listener of expiredListeners)listener(token);
        let message = response.status === 401 ? 'Please sign in again.' : `Request failed (${response.status}).`;
        try {
            const data = await response.json();
            if (typeof data.detail === 'string') message = data.detail;
            else if (Array.isArray(data.detail)) message = 'Please check the entered values.';
        } catch { /* Retain safe status message. */ }
        throw new ApiError(message, response.status);
    }
    return response.status === 204 ? undefined as T : await response.json();
    } catch (error) {
        if (controller.signal.aborted) throw new Error('The server took too long to respond. Please retry.');
        throw error;
    } finally { clearTimeout(timer); }
}
export interface User { id: number; display_name: string; email: string }
export interface Auth { access_token: string; user: User; expires_at: string }
export interface CareerRecord { id: number; name: string; description: string | null; official_url: string | null }
export interface Profile {
    user: User; interests: string[]; career_interests: string[];
    matching_enabled: boolean;
    saved_careers: CareerRecord[]; saved_programmes: Programme[];
}
export interface Milestone {
    id: number; code: string; title: string; original_title?: string | null; custom_title?: string | null; custom_course_code?: string | null; description: string | null;
    stage: number | null; points: number; required?: boolean; completed: boolean; official_url: string | null;
}
export interface Journey {
    programme: Programme; plan_code: string; plan_name: string; catalogue_year: number;
    progress_percent: number; completed_count: number; total_count: number; milestones: Milestone[];
}
export interface Plan { code: string; name: string }
export interface SocialMessage { id: number; content: string; sender_id: number; sender_name?: string; created_at: string }
export function sendMessage(token: string, target: { recipient_id?: number; group_id?: number; content: string }) {
    return studentRequest<SocialMessage>('/social/messages', token, 'POST', target);
}
