"""
In-process event bus that mirrors the AMQP payload contract.

When a module is extracted into a microservice:
  - Replace `publish()` with an aio-pika publish call.
  - Replace `subscribe()` registrations with AMQP consumer setup.
  - Payloads stay identical — they are the integration contract.
"""

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any

_handlers: dict[str, list[Callable[[dict], Awaitable[None]]]] = defaultdict(list)


def subscribe(event_type: str, handler: Callable[[dict], Awaitable[None]]) -> None:
    _handlers[event_type].append(handler)


async def publish(event_type: str, payload: dict[str, Any]) -> None:
    import logging
    _log = logging.getLogger(__name__)
    for handler in _handlers.get(event_type, []):
        try:
            await handler(payload)
        except Exception as exc:
            _log.exception("Event handler %s failed: %s", handler.__name__, exc)
