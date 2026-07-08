"""Thin client for the two public NHL APIs.

- api-web.nhle.com/v1  : game-center boxscores, player landing pages, schedules
- api.nhle.com/stats/rest : season game lists, team directory

Both are unauthenticated. Be polite: one request at a time with a small delay.
"""

from __future__ import annotations

import time

import requests

BASE_WEB = "https://api-web.nhle.com/v1"
BASE_STATS = "https://api.nhle.com/stats/rest/en"

RETRIABLE_STATUSES = {429, 500, 502, 503, 504}


class NHLApi:
    def __init__(self, delay: float = 0.3, max_retries: int = 4, timeout: float = 30.0):
        self.delay = delay
        self.max_retries = max_retries
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers["User-Agent"] = "nhl-data-ingest/0.1 (personal project)"
        self._last_request_at = 0.0

    def _get(self, url: str, params: dict | None = None) -> dict:
        for attempt in range(self.max_retries + 1):
            wait = self.delay - (time.monotonic() - self._last_request_at)
            if wait > 0:
                time.sleep(wait)
            self._last_request_at = time.monotonic()
            try:
                resp = self.session.get(url, params=params, timeout=self.timeout)
            except requests.ConnectionError:
                if attempt == self.max_retries:
                    raise
                time.sleep(2**attempt)
                continue
            if resp.status_code in RETRIABLE_STATUSES and attempt < self.max_retries:
                time.sleep(2**attempt)
                continue
            resp.raise_for_status()
            return resp.json()
        raise RuntimeError("unreachable")

    def teams(self) -> list[dict]:
        return self._get(f"{BASE_STATS}/team")["data"]

    def season_games(self, season: int, game_types: tuple[int, ...] = (2, 3)) -> list[dict]:
        """All games for a season (e.g. 20242025), regular season and/or playoffs."""
        games: list[dict] = []
        for game_type in game_types:
            data = self._get(
                f"{BASE_STATS}/game",
                params={"cayenneExp": f"season={season} and gameType={game_type}"},
            )
            games.extend(data["data"])
        return games

    def boxscore(self, game_id: int) -> dict:
        return self._get(f"{BASE_WEB}/gamecenter/{game_id}/boxscore")

    def player_landing(self, player_id: int) -> dict:
        return self._get(f"{BASE_WEB}/player/{player_id}/landing")
