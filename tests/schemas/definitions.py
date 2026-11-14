"""JSON schema definitions for the ServiceMind API responses.

Schemas pin the *contract* (field names, types, enums, nullability) so a
backend refactor that silently drops or renames a field fails the suite even
when the status code stays 200.
"""

from __future__ import annotations

from typing import Any

LOGIN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["accessToken", "tokenType", "expiresAt"],
    "properties": {
        "accessToken": {"type": "string", "minLength": 20},
        "tokenType": {"const": "Bearer"},
        "expiresAt": {"type": "string", "minLength": 10},
    },
}

USER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "username", "enabled", "roles", "createdAt"],
    "properties": {
        "id": {"type": "integer", "minimum": 1},
        "username": {"type": "string", "minLength": 3, "maxLength": 100},
        "enabled": {"type": "boolean"},
        "roles": {
            "type": "array",
            "minItems": 1,
            "items": {"enum": ["ADMIN", "AGENT", "REQUESTER"]},
        },
        "createdAt": {"type": "string"},
    },
}

ASSIGNABLE_USER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "username", "roles"],
    "properties": {
        "id": {"type": "integer"},
        "username": {"type": "string"},
        "roles": {"type": "array", "items": {"enum": ["ADMIN", "AGENT", "REQUESTER"]}},
    },
}

TICKET_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": [
        "id",
        "title",
        "description",
        "priority",
        "status",
        "requesterUsername",
        "assigneeUsername",
        "createdAt",
        "updatedAt",
        "dueAt",
        "resolvedAt",
        "slaStatus",
        "version",
    ],
    "properties": {
        "id": {"type": "integer", "minimum": 1},
        "title": {"type": "string", "minLength": 1, "maxLength": 200},
        "description": {"type": "string", "minLength": 1, "maxLength": 10000},
        "priority": {"enum": ["P1", "P2", "P3", "P4"]},
        "status": {"enum": ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]},
        "requesterUsername": {"type": "string", "minLength": 1},
        "assigneeUsername": {"type": ["string", "null"]},
        "createdAt": {"type": "string"},
        "updatedAt": {"type": "string"},
        "dueAt": {"type": "string"},
        "resolvedAt": {"type": ["string", "null"]},
        "slaStatus": {"enum": ["ON_TRACK", "BREACHED", "MET"]},
        "version": {"type": "integer", "minimum": 0},
    },
}

COMMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "ticketId", "authorUsername", "content", "createdAt"],
    "properties": {
        "id": {"type": "integer", "minimum": 1},
        "ticketId": {"type": "integer", "minimum": 1},
        "authorUsername": {"type": "string", "minLength": 1},
        "content": {"type": "string", "minLength": 1, "maxLength": 10000},
        "createdAt": {"type": "string"},
    },
}

AUDIT_EVENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "ticketId", "eventType", "actorUsername", "details", "createdAt"],
    "properties": {
        "id": {"type": "integer", "minimum": 1},
        "ticketId": {"type": "integer", "minimum": 1},
        "eventType": {"enum": ["TICKET_CREATED", "STATUS_CHANGED", "COMMENT_ADDED", "ASSIGNEE_CHANGED"]},
        "actorUsername": {"type": "string", "minLength": 1},
        "details": {"type": "string"},
        "createdAt": {"type": "string"},
    },
}

ARTICLE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": [
        "id",
        "title",
        "summary",
        "content",
        "category",
        "status",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt",
        "publishedAt",
        "version",
    ],
    "properties": {
        "id": {"type": "integer", "minimum": 1},
        "title": {"type": "string", "minLength": 1, "maxLength": 200},
        "summary": {"type": "string", "minLength": 1, "maxLength": 500},
        "content": {"type": "string", "minLength": 1, "maxLength": 100000},
        "category": {"type": "string", "minLength": 1, "maxLength": 100},
        "status": {"enum": ["DRAFT", "PUBLISHED", "ARCHIVED"]},
        "createdBy": {"type": "string"},
        "updatedBy": {"type": "string"},
        "createdAt": {"type": "string"},
        "updatedAt": {"type": "string"},
        "publishedAt": {"type": ["string", "null"]},
        "version": {"type": "integer", "minimum": 0},
    },
}

METRICS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["generatedAt", "total", "active", "unassignedActive", "breached", "dueSoon", "byStatus", "byPriority"],
    "properties": {
        "generatedAt": {"type": "string"},
        "total": {"type": "integer", "minimum": 0},
        "active": {"type": "integer", "minimum": 0},
        "unassignedActive": {"type": "integer", "minimum": 0},
        "breached": {"type": "integer", "minimum": 0},
        "dueSoon": {"type": "integer", "minimum": 0},
        "byStatus": {
            "type": "object",
            "required": ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
            "additionalProperties": {"type": "integer", "minimum": 0},
        },
        "byPriority": {
            "type": "object",
            "required": ["P1", "P2", "P3", "P4"],
            "additionalProperties": {"type": "integer", "minimum": 0},
        },
    },
}

AI_ANSWER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["answer", "grounded", "sources"],
    "properties": {
        "answer": {"type": "string", "minLength": 1},
        "grounded": {"type": "boolean"},
        "sources": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["articleId", "title"],
                "properties": {
                    "articleId": {"type": "integer", "minimum": 1},
                    "title": {"type": "string"},
                },
            },
        },
    },
}


def page_of(item_schema: dict[str, Any]) -> dict[str, Any]:
    """Wrap an item schema in the Spring Data VIA_DTO page envelope."""
    return {
        "type": "object",
        "required": ["content", "page"],
        "properties": {
            "content": {"type": "array", "items": item_schema},
            "page": {
                "type": "object",
                "required": ["size", "number", "totalElements", "totalPages"],
                "properties": {
                    "size": {"type": "integer", "minimum": 1},
                    "number": {"type": "integer", "minimum": 0},
                    "totalElements": {"type": "integer", "minimum": 0},
                    "totalPages": {"type": "integer", "minimum": 0},
                },
            },
        },
    }
