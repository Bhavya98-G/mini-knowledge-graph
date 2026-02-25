import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({ baseURL: API_BASE });

// ── Workspace endpoints ──
export const listWorkspaces = () => api.get('/workspaces');

export const getWorkspaceDetail = (workspaceId) =>
    api.get(`/workspaces/${workspaceId}`);

export const deleteWorkspace = (workspaceId) =>
    api.delete(`/workspaces/${workspaceId}`);

export const renameWorkspace = (workspaceId, name) =>
    api.patch(`/workspaces/${workspaceId}`, { name });

export const uploadFiles = (files, onUploadProgress) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    return api.post('/workspaces/upload', formData, {
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
