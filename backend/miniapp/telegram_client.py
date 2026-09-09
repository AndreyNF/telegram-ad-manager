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
import uuid

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


def build_multipart(params: dict, file_field: str, filename: str,
                    file_bytes: bytes, mime: str = 'image/jpeg') -> tuple:
    """Собирает multipart-тело для загрузки файла в Telegram"""
    boundary = '----pv' + uuid.uuid4().hex
    parts = []
    for key, value in params.items():
        if value is None:
            continue
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n'
            f'{value}\r\n'.encode()
        )
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; '
        f'filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
    )
    parts.append(file_bytes)
    parts.append(f'\r\n--{boundary}--\r\n'.encode())
    return b''.join(parts), f'multipart/form-data; boundary={boundary}'


def _send_via(ip: str, token: str, method: str, body: bytes, timeout: float,
              content_type: str = 'application/x-www-form-urlencoded') -> dict:
    tls = _connect_tls(ip, timeout)
    tls.settimeout(timeout)
    request = (
        f'POST /bot{token}/{method} HTTP/1.1\r\n'
        f'Host: {HOST}\r\n'
        f'Content-Type: {content_type}\r\n'
        f'Content-Length: {len(body)}\r\n'
        f'Connection: close\r\n\r\n'
    ).encode() + body
    tls.sendall(request)

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


def call(token: str, method: str, params: dict, timeout: float = 2.5, budget: float = 3.0,
         file_field: str = '', file_bytes: bytes = b'', filename: str = 'photo.jpg',
         mime: str = 'image/jpeg') -> dict:
    """Вызывает метод Telegram Bot API, автоматически обходя недоступные IP"""
    global _working_ip

    if file_field and file_bytes:
        body, content_type = build_multipart(params, file_field, filename, file_bytes, mime)
    else:
        body = urllib.parse.urlencode(params).encode()
        content_type = 'application/x-www-form-urlencoded'

    deadline = time.monotonic() + budget

    if _working_ip:
        try:
            return _send_via(_working_ip, token, method, body, timeout, content_type)
        except Exception:
            _working_ip = None

    last_exc = None
    for ip in _resolve_ips():
        remaining = deadline - time.monotonic()
        if remaining <= 0.3:
            break
        try:
            result = _send_via(ip, token, method, body, min(timeout, remaining), content_type)
            _working_ip = ip
            return result
        except Exception as exc:
            last_exc = exc
            continue
    raise ConnectionError(f'Не удалось подключиться ни к одному адресу api.telegram.org: {last_exc}')