"""
Надёжный клиент для Telegram Bot API.

DNS api.telegram.org отдаёт несколько IP вперемешку, и часть из них
недоступна из облачной сети — стандартный urllib виснет на первом неудачном
адресе до таймаута. Здесь перебираем адреса вручную с коротким таймаутом
на каждый и работаем с первым, который откликнулся.
"""
import json
import socket
import ssl
import time
import urllib.parse

HOST = 'api.telegram.org'
_working_ip = None

FALLBACK_IPS = [
    '149.154.167.220',
    '149.154.166.110',
    '149.154.167.50',
    '149.154.175.50',
]


def _resolve_ips() -> list:
    candidates = list(FALLBACK_IPS)
    try:
        infos = socket.getaddrinfo(HOST, 443, socket.AF_INET, socket.SOCK_STREAM)
        candidates.extend(info[4][0] for info in infos)
    except Exception:
        pass
    return list(dict.fromkeys(candidates))


def _connect_tls(ip: str, connect_timeout: float):
    raw = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    raw.settimeout(connect_timeout)
    raw.connect((ip, 443))
    ctx = ssl.create_default_context()
    return ctx.wrap_socket(raw, server_hostname=HOST)


def _send_via(ip: str, token: str, method: str, body: bytes, timeout: float) -> dict:
    tls = _connect_tls(ip, timeout)
    tls.settimeout(timeout)
    request = (
        f'POST /bot{token}/{method} HTTP/1.1\r\n'
        f'Host: {HOST}\r\n'
        f'Content-Type: application/x-www-form-urlencoded\r\n'
        f'Content-Length: {len(body)}\r\n'
        f'Connection: close\r\n\r\n'
    ).encode() + body
    tls.send(request)

    chunks = []
    while True:
        chunk = tls.recv(4096)
        if not chunk:
            break
        chunks.append(chunk)
    tls.close()

    raw = b''.join(chunks)
    header, _, payload = raw.partition(b'\r\n\r\n')

    if b'chunked' in header.lower():
        decoded = b''
        rest = payload
        while rest:
            size_line, _, rest = rest.partition(b'\r\n')
            try:
                size = int(size_line.strip(), 16)
            except ValueError:
                break
            if size == 0:
                break
            decoded += rest[:size]
            rest = rest[size + 2:]
        payload = decoded

    return json.loads(payload.decode())


def call(token: str, method: str, params: dict, timeout: float = 2.5, budget: float = 3.0) -> dict:
    """Вызывает метод Telegram Bot API, автоматически обходя недоступные IP"""
    global _working_ip
    body = urllib.parse.urlencode(params).encode()
    deadline = time.monotonic() + budget

    if _working_ip:
        try:
            return _send_via(_working_ip, token, method, body, timeout)
        except Exception:
            _working_ip = None

    last_exc = None
    for ip in _resolve_ips():
        remaining = deadline - time.monotonic()
        if remaining <= 0.3:
            break
        try:
            result = _send_via(ip, token, method, body, min(timeout, remaining))
            _working_ip = ip
            return result
        except Exception as exc:
            last_exc = exc
            continue
    raise ConnectionError(f'Не удалось подключиться ни к одному адресу api.telegram.org: {last_exc}')
