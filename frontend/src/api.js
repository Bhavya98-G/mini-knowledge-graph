import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
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
    files.forEach((f) => formData.append('files', f));

    let url = '/workspaces/upload';
    if (name && name.trim() !== '') {
        url += `?name=${encodeURIComponent(name.trim())}`;
    }

    return api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
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
