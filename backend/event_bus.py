"""In-memory event bus for SSE (Server-Sent Events) push notifications."""

import asyncio
import json
import threading
from collections import defaultdict

_lock = threading.Lock()
_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)


def publish(channel: str, event_type: str, data: dict | None = None):
    """Publish an event to a channel. Thread-safe, called from sync route handlers."""
    payload = json.dumps({"type": event_type, **(data or {})})
    with _lock:
        queues = list(_subscribers.get(channel, []))
    for q in queues:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass  # Slow consumer — TanStack Query polling is the safety net


def subscribe(channel: str) -> asyncio.Queue:
    """Subscribe to a channel. Returns an asyncio.Queue that receives event payloads."""
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    with _lock:
        _subscribers[channel].append(q)
    return q


def unsubscribe(channel: str, q: asyncio.Queue):
    """Unsubscribe from a channel."""
    with _lock:
        try:
            _subscribers[channel].remove(q)
        except ValueError:
            pass
