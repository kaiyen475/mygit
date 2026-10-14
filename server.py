#!/usr/bin/env python3
"""VITALL local application server. Uses only the Python standard library."""

from __future__ import annotations

import argparse
import getpass
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import time
import uuid
import webbrowser
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
CATEGORIES = ("조류", "식물", "습지", "곤충", "기타")
COOKIE_NAME = "vitall_admin"
SESSION_SECONDS = 8 * 60 * 60
LOGIN_WINDOW_MS = 15 * 60 * 1000

EXAMPLES = [
    {
        "id": "example-birds", "title": "가을 철새를 만나는 미호강 탐사", "category": "조류",
        "date": "2026-10-24T00:00:00.000Z", "deadline": "2026-10-23T09:00:00.000Z",
        "location": "청주 미호강 일대",
        "description": "미호강을 따라 걸으며 가을 철새의 움직임을 관찰합니다. 처음 탐조를 시작하는 분도 함께할 수 있어요.\n\n준비물: 편한 복장, 물, 개인 관찰 도구\n쌍안경이 없다면 대여를 선택해 주세요.\n\n이 게시물은 화면 안내를 위한 예시입니다. 실제 탐사 일정은 운영자가 등록합니다.",
        "meetingPlaces": ["충북대학교 정문", "미호강 현장 집합"],
        "capacity": 20, "status": "open", "isExample": True, "count": 0,
    },
    {
        "id": "example-plants", "title": "숲의 계절을 읽는 상당산성 식물 탐사", "category": "식물",
        "date": "2026-11-07T01:00:00.000Z", "deadline": "2026-11-06T09:00:00.000Z",
        "location": "청주 상당산성",
        "description": "숲길의 잎과 열매를 살펴보고, 식물의 겨울 준비를 관찰합니다. 천천히 걷고 함께 기록하는 탐사입니다.\n\n준비물: 걷기 편한 신발, 물, 작은 기록장\n\n이 게시물은 화면 안내를 위한 예시입니다. 실제 탐사 일정은 운영자가 등록합니다.",
        "meetingPlaces": ["충북대학교 정문", "상당산성 주차장"],
        "capacity": 15, "status": "open", "isExample": True, "count": 0,
    },
    {
        "id": "example-wetland", "title": "물과 생명이 만나는 대청호 습지 탐사", "category": "습지",
        "date": "2026-10-03T00:00:00.000Z", "deadline": "2026-10-02T09:00:00.000Z",
        "location": "대청호 주변 습지",
        "description": "습지에 사는 생물과 주변의 생태를 함께 살펴보는 탐사 기록입니다.\n\n이 게시물은 지난 탐사 화면을 보여주기 위한 예시입니다.",
        "meetingPlaces": ["충북대학교 정문", "대청호 현장 집합"],
        "capacity": 20, "status": "closed", "isExample": True, "count": 0,
    },
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS expeditions (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL,
    date TEXT NOT NULL, deadline TEXT NOT NULL, location TEXT NOT NULL,
    description TEXT NOT NULL, meeting_places TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0 CHECK(capacity >= 0),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
    is_example INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS applicants (
    id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES expeditions(id),
    name TEXT NOT NULL, phone TEXT NOT NULL,
    binoculars INTEGER NOT NULL CHECK(binoculars IN (0,1)),
    boots INTEGER NOT NULL CHECK(boots IN (0,1)), meeting_place TEXT NOT NULL,
    meal INTEGER NOT NULL CHECK(meal IN (0,1)), idempotency_key TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS application_request_unique ON applicants(idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS application_person_unique ON applicants(event_id,name,phone);
CREATE INDEX IF NOT EXISTS application_event_index ON applicants(event_id);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, failures INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);
"""


class HttpError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


@dataclass
class ApiResponse:
    body: dict
    status: int = 200
    headers: dict[str, str] = field(default_factory=dict)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def now_ms() -> int:
    return time.time_ns() // 1_000_000


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def text_value(value, label: str, minimum: int = 1, maximum: int = 200) -> str:
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
        raise HttpError(400, f"{label}을(를) 확인해 주세요.")
    return value.strip()


def iso_date(value, label: str) -> str:
    raw = text_value(value, label)
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    except (ValueError, OverflowError):
        raise HttpError(400, f"{label}을(를) 올바르게 입력해 주세요.") from None


def event_input(body: dict) -> dict:
    title = text_value(body.get("title"), "제목", 2, 120)
    category = text_value(body.get("category"), "카테고리")
    if category not in CATEGORIES:
        raise HttpError(400, "카테고리를 선택해 주세요.")
    date = iso_date(body.get("date"), "탐사 일시")
    deadline = iso_date(body.get("deadline"), "신청 마감")
    if deadline > date:
        raise HttpError(400, "신청 마감은 탐사 일시 이전으로 설정해 주세요.")
    places = body.get("meetingPlaces")
    if not isinstance(places, list) or not 1 <= len(places) <= 12:
        raise HttpError(400, "집합 장소를 1개 이상 입력해 주세요.")
    places = list(dict.fromkeys(text_value(place, "집합 장소", 1, 150) for place in places))
    value = body.get("capacity")
    try:
        capacity = int(value)
        if isinstance(value, bool) or isinstance(value, float) and not value.is_integer():
            raise ValueError
    except (ValueError, TypeError, OverflowError):
        raise HttpError(400, "정원은 0에서 10000 사이로 입력해 주세요.") from None
    if not 0 <= capacity <= 10000:
        raise HttpError(400, "정원은 0에서 10000 사이로 입력해 주세요.")
    if body.get("status") not in ("open", "closed"):
        raise HttpError(400, "모집 상태를 선택해 주세요.")
    if "isExample" in body and not isinstance(body["isExample"], bool):
        raise HttpError(400, "예시 게시물 여부를 확인해 주세요.")
    return {
        "title": title, "category": category, "date": date, "deadline": deadline,
        "location": text_value(body.get("location"), "탐사 장소", 1, 200),
        "description": text_value(body.get("description"), "탐사 안내", 1, 8000),
        "meetingPlaces": places, "capacity": capacity, "status": body["status"],
        "isExample": body.get("isExample", False),
    }


class VitallService:
    """Database-backed API, independently testable without opening a socket."""

    def __init__(self, database: Path | str, password: str):
        if not isinstance(password, str) or not 1 <= len(password) <= 200:
            raise ValueError("운영자 비밀번호는 1~200자로 설정해 주세요.")
        self.database = Path(database)
        self.database.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self._password_salt = secrets.token_bytes(32)
        self._password_hash = self._hash_password(password)
        with self.connection() as connection:
            connection.executescript(SCHEMA)
            # Restarting or changing the password revokes previously issued sessions.
            connection.execute("DELETE FROM admin_sessions")
        try:
            self.database.chmod(0o600)
        except OSError:
            pass

    def _hash_password(self, password: str) -> bytes:
        return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), self._password_salt, 180_000)

    @contextmanager
    def connection(self, transaction: bool = False):
        connection = sqlite3.connect(self.database, timeout=10, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        try:
            if transaction:
                connection.execute("BEGIN IMMEDIATE")
            yield connection
            if transaction:
                connection.commit()
        except Exception:
            if transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def session_token(headers: dict) -> str | None:
        raw = headers.get("cookie", "")
        if len(raw) > 8192:
            return None
        try:
            cookies = SimpleCookie()
            cookies.load(raw)
            token = cookies[COOKIE_NAME].value if COOKIE_NAME in cookies else ""
        except Exception:
            return None
        return token if re.fullmatch(r"[a-f0-9]{64}", token) else None

    def current_admin(self, connection, headers: dict) -> bool:
        token = self.session_token(headers)
        if not token:
            return False
        row = connection.execute("SELECT expires_at FROM admin_sessions WHERE token_hash=?", (digest(token),)).fetchone()
        return bool(row and row["expires_at"] > now_ms())

    def require_admin(self, connection, headers: dict):
        if not self.current_admin(connection, headers):
            raise HttpError(401, "운영자 비밀번호를 먼저 입력해 주세요.")

    @staticmethod
    def map_event(row) -> dict:
        return {
            "id": row["id"], "title": row["title"], "category": row["category"],
            "date": row["date"], "deadline": row["deadline"], "location": row["location"],
            "description": row["description"], "meetingPlaces": json.loads(row["meeting_places"]),
            "capacity": row["capacity"], "status": row["status"],
            "isExample": bool(row["is_example"]), "count": int(row["count"]),
        }

    def event_by_id(self, connection, event_id: str) -> dict:
        row = connection.execute(
            "SELECT e.*, (SELECT COUNT(*) FROM applicants a WHERE a.event_id=e.id) AS count FROM expeditions e WHERE e.id=?",
            (event_id,),
        ).fetchone()
        if row:
            return self.map_event(row)
        for example in EXAMPLES:
            if example["id"] == event_id:
                return dict(example)
        raise HttpError(404, "탐사 게시물을 찾을 수 없습니다.")

    @staticmethod
    def validate_body(body, headers: dict, origin: str):
        if headers.get("origin") and headers["origin"] != origin:
            raise HttpError(403, "허용되지 않은 요청입니다.")
        if headers.get("sec-fetch-site") == "cross-site":
            raise HttpError(403, "허용되지 않은 요청입니다.")
        if headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
            raise HttpError(415, "JSON 형식으로 요청해 주세요.")
        if not isinstance(body, dict):
            raise HttpError(400, "입력 내용을 확인해 주세요.")
        if len(json.dumps(body, ensure_ascii=False)) > 16000:
            raise HttpError(413, "입력 내용이 너무 깁니다.")

    def request(self, method: str, path: str, body=None, headers=None,
                origin: str = "http://127.0.0.1:8000", client_ip: str = "127.0.0.1") -> ApiResponse:
        headers = {key.lower(): value for key, value in (headers or {}).items()}
        path = urlsplit(path).path
        try:
            if method in ("POST", "PUT"):
                self.validate_body(body, headers, origin)
            if path == "/api/admin/login" and method == "POST":
                return self.login(body, client_ip, origin)
            if path == "/api/admin/logout" and method == "POST":
                with self.connection(transaction=True) as connection:
                    token = self.session_token(headers)
                    if token:
                        connection.execute("DELETE FROM admin_sessions WHERE token_hash=?", (digest(token),))
                return ApiResponse({"success": True}, headers={"Set-Cookie": self.cookie("", origin, 0)})
            if path == "/api/expeditions":
                if method == "GET":
                    with self.connection() as connection:
                        rows = connection.execute("SELECT e.*, (SELECT COUNT(*) FROM applicants a WHERE a.event_id=e.id) AS count FROM expeditions e ORDER BY e.date DESC").fetchall()
                        return ApiResponse({"events": [self.map_event(row) for row in rows] or EXAMPLES,
                                            "admin": self.current_admin(connection, headers)})
                if method == "POST":
                    return self.save_event(body, headers)
                raise HttpError(405, "지원하지 않는 요청입니다.")
            match = re.fullmatch(r"/api/expeditions/([^/]+)(/apply)?", path)
            if match:
                event_id = unquote(match.group(1))
                if len(event_id) > 150:
                    raise HttpError(400, "탐사 식별값을 확인해 주세요.")
                if match.group(2):
                    if method == "POST":
                        return self.apply(event_id, body)
                    raise HttpError(405, "지원하지 않는 요청입니다.")
                if method == "GET":
                    return self.detail(event_id, headers)
                if method == "PUT":
                    return self.save_event(body, headers, event_id)
                raise HttpError(405, "지원하지 않는 요청입니다.")
            if path in ("/api/admin/login", "/api/admin/logout"):
                raise HttpError(405, "지원하지 않는 요청입니다.")
            raise HttpError(404, "요청한 페이지를 찾을 수 없습니다.")
        except HttpError as error:
            return ApiResponse({"error": str(error)}, error.status)
        except (sqlite3.Error, ValueError, TypeError, KeyError, OverflowError):
            # Do not put applicant values or SQL parameters into logs or error responses.
            return ApiResponse({"error": "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."}, 500)

    @staticmethod
    def cookie(token: str, origin: str, max_age: int = SESSION_SECONDS) -> str:
        return (f"{COOKIE_NAME}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={max_age}"
                + ("; Secure" if origin.startswith("https:") else ""))

    def login(self, body: dict, client_ip: str, origin: str) -> ApiResponse:
        password = body.get("password")
        if not isinstance(password, str) or not 1 <= len(password) <= 200:
            raise HttpError(400, "비밀번호를 확인해 주세요.")
        key, now = digest(client_ip), now_ms()
        # Keep failures committed: throwing inside this transaction would roll them back.
        with self.connection(transaction=True) as connection:
            attempt = connection.execute("SELECT failures,window_start FROM login_attempts WHERE key=?", (key,)).fetchone()
            if attempt and now - attempt["window_start"] < LOGIN_WINDOW_MS and attempt["failures"] >= 10:
                return ApiResponse({"error": "입력 시도가 많습니다. 15분 뒤 다시 시도해 주세요."}, 429,
                                   {"Retry-After": str(max(1, (LOGIN_WINDOW_MS - (now - attempt["window_start"])) // 1000))})
            if not hmac.compare_digest(self._hash_password(password), self._password_hash):
                failures = attempt["failures"] + 1 if attempt and now - attempt["window_start"] < LOGIN_WINDOW_MS else 1
                window_start = attempt["window_start"] if attempt and now - attempt["window_start"] < LOGIN_WINDOW_MS else now
                connection.execute("INSERT INTO login_attempts(key,failures,window_start) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start", (key, failures, window_start))
                return ApiResponse({"error": "비밀번호가 일치하지 않습니다."}, 401)
            token = secrets.token_hex(32)
            connection.execute("DELETE FROM admin_sessions WHERE expires_at<=?", (now,))
            connection.execute("DELETE FROM login_attempts WHERE key=?", (key,))
            connection.execute("INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)", (digest(token), now + SESSION_SECONDS * 1000))
        return ApiResponse({"success": True}, headers={"Set-Cookie": self.cookie(token, origin)})

    def detail(self, event_id: str, headers: dict) -> ApiResponse:
        with self.connection() as connection:
            event = self.event_by_id(connection, event_id)
            admin = self.current_admin(connection, headers)
            # Public requests select only names; private records are never loaded for them.
            names = [] if event["isExample"] else connection.execute("SELECT name FROM applicants WHERE event_id=? ORDER BY created_at,id", (event_id,)).fetchall()
            result = {"event": event, "signedUp": [{"name": row["name"]} for row in names], "admin": admin}
            if admin:
                rows = [] if event["isExample"] else connection.execute("SELECT id,name,phone,binoculars,boots,meeting_place,meal,created_at FROM applicants WHERE event_id=? ORDER BY created_at,id", (event_id,)).fetchall()
                result["applicants"] = [{
                    "id": row["id"], "name": row["name"], "phone": row["phone"],
                    "binoculars": bool(row["binoculars"]), "boots": bool(row["boots"]),
                    "meetingPlace": row["meeting_place"], "meal": bool(row["meal"]),
                    "createdAt": row["created_at"],
                } for row in rows]
            return ApiResponse(result)

    def save_event(self, body: dict, headers: dict, event_id: str | None = None) -> ApiResponse:
        with self.connection(transaction=True) as connection:
            self.require_admin(connection, headers)
            event = event_input(body)
            if event_id:
                old = self.event_by_id(connection, event_id)
                if 0 < event["capacity"] < old["count"]:
                    raise HttpError(400, "정원을 현재 신청 인원보다 적게 설정할 수 없습니다.")
                if old["count"] and any(place not in event["meetingPlaces"] for place in old["meetingPlaces"]):
                    raise HttpError(400, "신청자가 있는 탐사의 집합 장소는 유지하고 새 장소를 추가해 주세요.")
            actual_id = event_id if event_id and not event_id.startswith("example-") else str(uuid.uuid4())
            connection.execute("""INSERT INTO expeditions(id,title,category,date,deadline,location,description,meeting_places,capacity,status,is_example,created_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,
                category=excluded.category,date=excluded.date,deadline=excluded.deadline,location=excluded.location,
                description=excluded.description,meeting_places=excluded.meeting_places,capacity=excluded.capacity,
                status=excluded.status,is_example=excluded.is_example""", (
                    actual_id, event["title"], event["category"], event["date"], event["deadline"],
                    event["location"], event["description"], json.dumps(event["meetingPlaces"], ensure_ascii=False),
                    event["capacity"], event["status"], int(event["isExample"]), utc_now(),
                ))
            saved = self.event_by_id(connection, actual_id)
        return ApiResponse({"success": True, "event": saved}, 200 if event_id else 201)

    def apply(self, event_id: str, body: dict) -> ApiResponse:
        name = text_value(body.get("name"), "이름", 1, 50)
        phone = re.sub(r"[\s()+.\-]", "", text_value(body.get("phone"), "전화번호", 8, 30))
        if not re.fullmatch(r"0\d{8,10}", phone, flags=re.ASCII):
            raise HttpError(400, "전화번호를 올바르게 입력해 주세요.")
        if any(not isinstance(body.get(key), bool) for key in ("binoculars", "boots", "meal")):
            raise HttpError(400, "대여 여부와 식사 여부를 선택해 주세요.")
        if body.get("consent") is not True:
            raise HttpError(400, "개인정보 수집 안내에 동의해 주세요.")
        meeting_place = text_value(body.get("meetingPlace"), "집합 장소", 1, 150)
        key = text_value(body.get("idempotencyKey"), "신청 식별값", 8, 100)
        expected = (event_id, name, phone, int(body["binoculars"]), int(body["boots"]), meeting_place, int(body["meal"]))
        # A write transaction serializes last-place claims, duplicate checks and edits.
        with self.connection(transaction=True) as connection:
            event = self.event_by_id(connection, event_id)
            if meeting_place not in event["meetingPlaces"]:
                raise HttpError(400, "등록된 집합 장소를 선택해 주세요.")
            prior = connection.execute("SELECT event_id,name,phone,binoculars,boots,meeting_place,meal FROM applicants WHERE idempotency_key=?", (key,)).fetchone()
            if prior:
                if tuple(prior) != expected:
                    raise HttpError(409, "신청 정보를 다시 확인해 주세요.")
                return ApiResponse({"success": True, "name": name, "count": event["count"]})
            if event["isExample"]:
                raise HttpError(400, "예시 탐사에는 신청할 수 없습니다. 실제 탐사 공지를 기다려 주세요.")
            now = utc_now()
            if event["status"] != "open" or event["deadline"] <= now or event["date"] <= now:
                raise HttpError(409, "신청이 마감된 탐사입니다.")
            duplicate = connection.execute("SELECT id FROM applicants WHERE event_id=? AND name=? AND phone=?", (event_id, name, phone)).fetchone()
            if duplicate:
                raise HttpError(409, "동일한 이름과 전화번호로 이미 신청하셨습니다.")
            if event["capacity"] > 0 and event["count"] >= event["capacity"]:
                raise HttpError(409, "신청 정원이 찼습니다.")
            connection.execute("INSERT INTO applicants(id,event_id,name,phone,binoculars,boots,meeting_place,meal,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()), *expected, key, now))
            count = self.event_by_id(connection, event_id)["count"]
        return ApiResponse({"success": True, "name": name, "count": count}, 201)


def make_handler(service: VitallService, public_directory: Path):
    public_directory = public_directory.resolve()

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "VITALL"
        sys_version = ""

        def respond(self, content: bytes, status=200, content_type="application/json; charset=utf-8", headers=None):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "same-origin")
            self.send_header("X-Frame-Options", "DENY")
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            if self.command != "HEAD":
                try:
                    self.wfile.write(content)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        def json_response(self, response: ApiResponse):
            self.respond(json.dumps(response.body, ensure_ascii=False).encode("utf-8"), response.status, headers=response.headers)

        def handle_request(self):
            try:
                # The server binds only loopback; Host checks also stop DNS rebinding.
                port = self.server.server_port
                allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
                if port == 80:
                    allowed_hosts.update(("127.0.0.1", "localhost"))
                host = self.headers.get("Host", "")
                if host not in allowed_hosts:
                    raise HttpError(403, "허용되지 않은 주소입니다. 로컬 접속 주소를 확인해 주세요.")
                path = urlsplit(self.path).path
                if path.startswith("/api/"):
                    body = None
                    if self.command in ("POST", "PUT"):
                        if self.headers.get("Transfer-Encoding"):
                            self.close_connection = True
                            raise HttpError(400, "요청 형식을 확인해 주세요.")
                        try:
                            length = int(self.headers.get("Content-Length", "0"))
                        except ValueError:
                            self.close_connection = True
                            raise HttpError(400, "요청 형식을 확인해 주세요.") from None
                        if not 0 <= length <= 65536:
                            self.close_connection = True
                            raise HttpError(413, "입력 내용이 너무 깁니다.")
                        try:
                            raw = self.rfile.read(length).decode("utf-8")
                            if len(raw) > 16000:
                                raise HttpError(413, "입력 내용이 너무 깁니다.")
                            body = json.loads(raw)
                        except (ValueError, UnicodeError):
                            raise HttpError(400, "입력 내용을 확인해 주세요.") from None
                    response = service.request(self.command, path, body, dict(self.headers),
                                               f"http://{host}", self.client_address[0])
                    self.json_response(response)
                    return
                if self.command not in ("GET", "HEAD"):
                    raise HttpError(405, "지원하지 않는 요청입니다.")
                relative = "index.html" if path == "/" else unquote(path).lstrip("/")
                if any(part.startswith(".") for part in Path(relative).parts):
                    raise HttpError(404, "요청한 페이지를 찾을 수 없습니다.")
                try:
                    target = (public_directory / relative).resolve()
                    target.relative_to(public_directory)
                except (ValueError, OSError):
                    raise HttpError(404, "요청한 페이지를 찾을 수 없습니다.") from None
                if not target.is_file():
                    raise HttpError(404, "요청한 페이지를 찾을 수 없습니다.")
                content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
                if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
                    content_type += "; charset=utf-8"
                self.respond(target.read_bytes(), content_type=content_type)
            except HttpError as error:
                self.json_response(ApiResponse({"error": str(error)}, error.status))
            except (OSError, ValueError):
                self.json_response(ApiResponse({"error": "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."}, 500))

        def do_GET(self):
            self.handle_request()

        def do_HEAD(self):
            self.handle_request()

        def do_POST(self):
            self.handle_request()

        def do_PUT(self):
            self.handle_request()

        def do_DELETE(self):
            self.handle_request()

        def do_PATCH(self):
            self.handle_request()

        def do_OPTIONS(self):
            self.handle_request()

        def log_message(self, format, *args):
            # Avoid request bodies, queries, applicant details and cookies in logs.
            safe_path = urlsplit(self.path).path
            print(f"{self.log_date_time_string()} {self.command} {safe_path}", file=sys.stderr)

        def setup(self):
            super().setup()
            self.connection.settimeout(15)

    return Handler


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="VITALL 로컬 탐사 신청 서버 (추가 패키지 불필요)")
    parser.add_argument("--port", type=int, default=8000, help="로컬 서버 포트 (기본: 8000)")
    parser.add_argument("--open", action="store_true", help="서버 시작 후 기본 브라우저 열기")
    arguments = parser.parse_args(argv)
    if not 1 <= arguments.port <= 65535:
        parser.error("포트는 1에서 65535 사이로 입력해 주세요.")
    password = os.environ.get("ADMIN_PASSWORD")
    if password is None:
        if not sys.stdin.isatty():
            print("ADMIN_PASSWORD를 설정하거나 터미널에서 실행해 운영자 비밀번호를 입력해 주세요.", file=sys.stderr)
            return 1
        try:
            password = getpass.getpass("운영자 비밀번호 설정 (화면에 표시되지 않음): ")
            confirmation = getpass.getpass("운영자 비밀번호 다시 입력: ")
        except (EOFError, KeyboardInterrupt):
            print("\n서버 시작을 취소했습니다.", file=sys.stderr)
            return 1
        if password != confirmation:
            print("비밀번호가 일치하지 않습니다. 다시 실행해 주세요.", file=sys.stderr)
            return 1
        del confirmation
    if not 1 <= len(password) <= 200:
        print("운영자 비밀번호는 1~200자로 설정해 주세요.", file=sys.stderr)
        return 1
    os.umask(0o077)
    try:
        service = VitallService(ROOT / ".vitall-data" / "vitall.db", password)
        # The plain password is not stored in a file or the application object.
        del password
        server = ThreadingHTTPServer(("127.0.0.1", arguments.port), make_handler(service, ROOT / "public"))
    except sqlite3.Error:
        print("신청 데이터 저장소를 열지 못했습니다. 저장 폴더의 권한과 디스크 공간을 확인해 주세요.", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"서버를 시작하지 못했습니다: {error.strerror or '파일 또는 포트를 확인해 주세요.'}", file=sys.stderr)
        return 1
    server.daemon_threads = True
    print(f"VITALL 실행 중: http://127.0.0.1:{arguments.port}")
    print("종료하려면 Ctrl+C를 누르세요. 신청 데이터는 .vitall-data/vitall.db에 저장됩니다.")
    if arguments.open:
        try:
            webbrowser.open(f"http://127.0.0.1:{arguments.port}")
        except webbrowser.Error:
            print("브라우저에서 위 주소를 직접 열어 주세요.", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nVITALL 서버를 종료합니다.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
