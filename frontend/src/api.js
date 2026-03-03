import axios from 'axios';

// Rely purely on Vite's local dev server proxy, wiping out local hardcoded endpoints completely.
const API_BASE = import.meta.env.VITE_API_URL || '/api';
console.log('[API] Base URL:', API_BASE);

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            console.error('[API Error]', error.response.status, error.response.data);
            if (error.response.status === 401) {
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            }
        } else if (error.request) {
            console.error('[API Network Error] No response received:', error.message);
        } else {
            console.error('[API Setup Error]', error.message);
        }
        return Promise.reject(error);
    }
);

// ── Auth endpoints ──
export const loginUser = (email, password) =>
    api.post('/auth/login', { email, password });

export const registerUser = (username, email, password) =>
    api.post('/auth/register', { username, email, password });

export const forgotPasswordUser = (email, admin_key, new_password) =>
    api.post('/auth/forgot-password', { email, admin_key, new_password });

// ── Workspace endpoints ──
export const listWorkspaces = () => api.get('/workspaces/completed');
export const listRunningWorkspaces = () => api.get('/workspaces/running');

export const getWorkspaceDetail = (workspaceId) =>
    api.get(`/workspaces/${workspaceId}`);

export const deleteWorkspace = (workspaceId) =>
    api.delete(`/workspaces/${workspaceId}`);

export const renameWorkspace = (workspaceId, name) =>
    api.patch(`/workspaces/${workspaceId}`, { name });

export const uploadFiles = (files, name, onUploadProgress) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    if (name && name.trim() !== '') {
        formData.append('name', name.trim());
    }

    console.log('[Upload] Triggering native upload API hook explicitly to:', API_BASE + '/workspaces/upload');

    return api.post('/workspaces/upload', formData, {
        onUploadProgress,
    });
};

// ── Graph endpoints ──
export const getGraph = (workspaceId) =>
    api.get(`/workspaces/${workspaceId}/graph`);

export const listEntities = (workspaceId, search = '') =>
    api.get(`/workspaces/${workspaceId}/entities`, { params: search ? { search } : {} });

// ── Entity endpoints ──
export const getEntityDetails = (entityId) =>
    api.get(`/entities/${entityId}/details`);

export const updateEntity = (entityId, data) =>
    api.patch(`/entities/${entityId}`, data);

export const mergeEntities = (keepId, mergeId) =>
    api.post('/entities/merge', { keep_id: keepId, merge_id: mergeId });

export const createRelationship = (sourceId, targetId, type) =>
    api.post('/relationships', { source_id: sourceId, target_id: targetId, type });

export const deleteRelationship = (relationshipId) =>
    api.delete(`/relationships/${relationshipId}`);

export const createEntity = (workspaceId, name, type) =>
    api.post('/entities', { workspace_id: workspaceId, name, type });

export const deleteEntity = (entityId) =>
    api.delete(`/entities/${entityId}`);

// ── Health & Stats ──
export const healthCheck = () => api.get('/health');
export const getStats = () => api.get('/stats');

export default api;
