"""O01: fixed Git content + copied dependency snapshot, isolated read-only serving.

No production sync, downloads, package resolver network, activation or deletion API.
"""

import argparse
import asyncio
import hashlib
import json
import os
import platform
import re
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import tomllib
import uuid
import venv
from importlib import metadata
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

SCHEMA = "ocean-isolated-release/v1"
PROFILE = "isolated-read-only/v1"
POLICY = "deploy/release-allowlist.json"
MAX_FILES, MAX_BYTES, MAX_FILE = 20000, 1024**3, 128 * 1024**2


class ReleaseError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def digest(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate_json_key")
        result[key] = value
    return result


def parse(data):
    return json.loads(data.decode("utf-8"), object_pairs_hook=unique_object)


def safe_path(name):
    require(isinstance(name, str) and len(name) < 400, "unsafe_member")
    parts = PurePosixPath(name).parts
    require(
        parts and not name.startswith("/") and "\\" not in name and ":" not in name,
        "unsafe_member",
    )
    require(
        all(
            p.casefold() not in {".", "..", ".git", ".env"}
            and not re.fullmatch(
                r"(?i)(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])", p.split(".")[0]
            )
            and not p.casefold().startswith(".env.")
            and not p.endswith((" ", "."))
            and not any(ord(c) < 32 for c in p)
            for p in parts
        ),
        "unsafe_member",
    )
    require(str(PurePosixPath(name)) == name, "unsafe_member")
    return name


def no_links(path, checked=None):
    for parent in (path, *path.parents):
        if checked is not None and parent in checked:
            continue
        require(
            not parent.is_symlink() and not getattr(parent, "is_junction", lambda: False)(),
            "linked_target",
        )
        if checked is not None:
            checked.add(parent)


def git(repo, *args):
    result = subprocess.run(
        ["git", "-c", f"safe.directory={repo}", "-C", str(repo), *args],
        capture_output=True,
        timeout=30,
        check=False,
    )
    require(result.returncode == 0, "git_source_unavailable")
    return result.stdout


def blob(repo, commit, name):
    safe_path(name)
    mode = git(repo, "ls-tree", commit, "--", name).split(b" ", 1)[0]
    require(mode in {b"100644", b"100755"}, "source_not_regular_file")
    data = git(repo, "show", f"{commit}:{name}")
    require(len(data) <= MAX_FILE, "source_budget_exceeded")
    return data


def runtime_identity():
    return {
        "python": platform.python_version(),
        "implementation": sys.implementation.name,
        "cache_tag": sys.implementation.cache_tag,
        "platform": sys.platform,
        "machine": platform.machine(),
    }


def check_source_content(name, data):
    if PurePosixPath(name).suffix.lower() not in {
        ".py",
        ".js",
        ".json",
        ".toml",
        ".html",
        ".css",
        ".txt",
        ".md",
        ".rgb",
    }:
        return
    text = data.decode("utf-8")
    patterns = (
        r"(?m)^-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----\r?$",
        r"gh[pousr]_[A-Za-z0-9]{20,}",
        r"github_pat_[A-Za-z0-9_]{20,}",
        r"(?i)[A-Z]:[/\\]+Users[/\\]+[^/\\\s]+",
    )
    require(not any(re.search(pattern, text) for pattern in patterns), "sensitive_source_content")


def dependencies(requirements):
    # Parse actual declared dependencies and markers against this build interpreter.
    from packaging.requirements import Requirement

    pending = list(requirements)
    selected = {}
    visited = set()
    while pending:
        requirement = Requirement(pending.pop())
        require(requirement.url is None, "direct_dependency_not_supported")
        name = re.sub(r"[-_.]+", "-", requirement.name).lower()
        try:
            distribution = metadata.distribution(name)
        except metadata.PackageNotFoundError:
            raise ReleaseError("missing_dependency") from None
        require(
            not requirement.specifier or distribution.version in requirement.specifier,
            "dependency_version_conflict",
        )
        key = (name, tuple(sorted(requirement.extras)))
        if key in visited:
            continue
        visited.add(key)
        selected[name] = distribution
        extras = requirement.extras or {""}
        for raw in distribution.requires or []:
            child = Requirement(raw)
            if child.marker is None or any(
                child.marker.evaluate({"extra": extra}) for extra in extras
            ):
                pending.append(raw)
    return selected


def build(args):
    repo = Path(args.repo).resolve()
    require(re.fullmatch(r"[0-9a-f]{40}", args.commit), "full_commit_required")
    commit = git(repo, "rev-parse", args.commit + "^{commit}").decode().strip()
    require(commit == args.commit, "source_commit_mismatch")
    policy_bytes = blob(repo, commit, POLICY)
    policy = parse(policy_bytes)
    require(policy["schema"] == "ocean-release-allowlist/v1", "unsupported_allowlist")
    files = {}
    for entry in policy["files"]:
        source, target = safe_path(entry["source"]), safe_path(entry["target"])
        require(
            target.startswith(("backend/app/", "frontend/prototype/", "deploy/"))
            or target in {"backend/pyproject.toml", "backend/scripts/export_prototype_data.py"},
            "unapproved_code_target",
        )
        require(
            not any(p in target.split("/") for p in ("raw", "cache", "outputs", "local_data")),
            "unapproved_code_target",
        )
        require(target not in files, "duplicate_target")
        data = blob(repo, commit, source)
        check_source_content(target, data)
        files[target] = data
    require(
        files.get(POLICY) == policy_bytes and "deploy/release.py" in files,
        "missing_release_tool",
    )
    project = tomllib.loads(files["backend/pyproject.toml"].decode())
    resolved = dependencies(project["project"]["dependencies"])
    lock = {name: dist.version for name, dist in sorted(resolved.items())}
    checked = set()
    for distribution in resolved.values():
        base = Path(distribution.locate_file("")).resolve()
        direct = distribution.read_text("direct_url.json")
        require(
            not direct or not parse(direct.encode()).get("dir_info", {}).get("editable"),
            "editable_dependency_not_supported",
        )
        require(distribution.files is not None, "missing_dependency_record")
        for relative in distribution.files:
            path = Path(distribution.locate_file(relative))
            # Entry-point scripts are not used; all serving uses python -m imports.
            if (
                "__pycache__" in path.parts
                or path.suffix == ".pyc"
                or path.name == "direct_url.json"
            ):
                continue
            resolved_path = path.resolve()
            if not resolved_path.is_relative_to(base):
                continue
            no_links(resolved_path, checked)
            name = safe_path("runtime/" + resolved_path.relative_to(base).as_posix())
            require(path.suffix != ".pth", "executable_dependency_path_not_supported")
            require(
                path.is_file() and path.stat().st_size <= MAX_FILE,
                "dependency_file_unavailable",
            )
            data = path.read_bytes()
            require(name not in files or files[name] == data, "dependency_file_collision")
            files[name] = data
    require(
        len(files) <= MAX_FILES and sum(map(len, files.values())) <= MAX_BYTES,
        "release_budget_exceeded",
    )
    require(len({name.casefold() for name in files}) == len(files), "case_colliding_member")
    manifest = {
        "schema": SCHEMA,
        "profile": PROFILE,
        "source_commit": commit,
        "allowlist_sha256": digest(policy_bytes),
        "runtime": runtime_identity(),
        "dependencies": lock,
        "dependency_mode": "independent-installed-distribution-copy/v1",
        "files": {
            name: {"sha256": digest(data), "bytes": len(data)}
            for name, data in sorted(files.items())
        },
    }
    manifest["release_id"] = digest(canonical(manifest))
    output = Path(args.out).absolute()
    no_links(output)
    require(not output.exists() and output.parent.is_dir(), "output_must_be_new")
    # Publish only a complete ZIP; an interrupted build does not replace old packages.
    fd, temporary = tempfile.mkstemp(prefix=".ocean-release-", dir=output.parent)
    os.close(fd)
    try:
        with ZipFile(temporary, "w", compression=ZIP_DEFLATED, compresslevel=1) as package:
            package.writestr("manifest.json", canonical(manifest))
            for name, data in files.items():
                package.writestr(name, data)
        os.link(temporary, output)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return {
        "release_id": manifest["release_id"],
        "source_commit": commit,
        "bundle_sha256": digest(output.read_bytes()),
        "file_count": len(files),
        "bytes": sum(map(len, files.values())),
        "dependencies": lock,
    }


def read_manifest(data, expected):
    require(len(data) <= 8 * 1024**2, "manifest_budget_exceeded")
    manifest = parse(data)
    claimed = manifest.pop("release_id")
    require(claimed == expected == digest(canonical(manifest)), "release_identity_mismatch")
    manifest["release_id"] = claimed
    require(
        manifest["schema"] == SCHEMA and manifest["profile"] == PROFILE,
        "unsupported_release",
    )
    require(manifest["runtime"] == runtime_identity(), "runtime_mismatch")
    require(
        isinstance(manifest["files"], dict) and 0 < len(manifest["files"]) <= MAX_FILES,
        "release_budget_exceeded",
    )
    require(
        len({p.casefold() for p in manifest["files"]}) == len(manifest["files"]),
        "case_colliding_member",
    )
    total = 0
    for name, fact in manifest["files"].items():
        safe_path(name)
        require(
            name.startswith(("backend/app/", "frontend/prototype/", "deploy/", "runtime/"))
            or name in {"backend/pyproject.toml", "backend/scripts/export_prototype_data.py"},
            "unsafe_member",
        )
        require(
            isinstance(fact["bytes"], int) and 0 <= fact["bytes"] <= MAX_FILE,
            "release_budget_exceeded",
        )
        require(
            re.fullmatch(r"sha256:[0-9a-f]{64}", fact["sha256"]),
            "invalid_file_identity",
        )
        total += fact["bytes"]
    require(total <= MAX_BYTES, "release_budget_exceeded")
    return manifest


def init(args):
    root = Path(args.root).absolute()
    no_links(root)
    require(not root.exists() and root.parent.is_dir(), "isolation_root_must_be_new")
    root.mkdir()
    (root / "isolation.json").write_bytes(canonical({"schema": "ocean-isolation-root/v1"}))
    (root / "versions").mkdir()
    return {"initialized": True, "profile": PROFILE}


def site_path(release):
    return (
        release
        / "venv"
        / (
            "Lib/site-packages"
            if os.name == "nt"
            else f"lib/python{sys.version_info.major}.{sys.version_info.minor}/site-packages"
        )
    )


def installed_file(release, name):
    return (
        site_path(release) / name[len("runtime/") :]
        if name.startswith("runtime/")
        else release / name
    )


def install(args):
    root = Path(args.root).absolute()
    no_links(root)
    require(
        parse((root / "isolation.json").read_bytes()) == {"schema": "ocean-isolation-root/v1"},
        "not_an_isolation_root",
    )
    versions = root / "versions"
    no_links(versions)
    require(versions.is_dir(), "not_an_isolation_root")
    require(Path(args.bundle).stat().st_size <= MAX_BYTES, "release_budget_exceeded")
    bundle = Path(args.bundle).read_bytes()
    require(
        len(bundle) <= MAX_BYTES and digest(bundle) == args.expected,
        "bundle_integrity_failed",
    )
    with ZipFile(args.bundle) as package:
        infos = package.infolist()
        names = [safe_path(i.filename) for i in infos]
        require(
            len(names) == len(set(names)) and len(names) <= MAX_FILES + 1,
            "duplicate_or_excess_member",
        )
        for info in infos:
            require(
                info.file_size <= MAX_FILE
                and stat.S_IFMT(info.external_attr >> 16) in {0, stat.S_IFREG},
                "unsafe_member",
            )
        raw = package.read("manifest.json")
        identity = parse(raw)["release_id"]
        manifest = read_manifest(raw, identity)
        require(manifest["source_commit"] == args.commit, "source_commit_mismatch")
        require(
            set(names) == set(manifest["files"]) | {"manifest.json"},
            "member_set_mismatch",
        )
        for name, fact in manifest["files"].items():
            require(
                package.getinfo(name).file_size == fact["bytes"]
                and digest(package.read(name)) == fact["sha256"],
                "file_integrity_failed",
            )
        destination = versions / identity[7:]
        require(not destination.exists(), "release_already_installed")
        staging = versions / (".stage-" + uuid.uuid4().hex)
        staging.mkdir()
        try:
            venv.EnvBuilder(with_pip=False, symlinks=False, system_site_packages=False).create(
                staging / "venv"
            )
            for name in manifest["files"]:
                target = installed_file(staging, name)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(package.read(name))
            (staging / "manifest.json").write_bytes(raw)
            for folder in ("raw", "cache", "tmp", "outputs", "logs"):
                (staging / "state" / folder).mkdir(parents=True)
            staging.rename(destination)
        except BaseException:
            # Only this operation's new, checked staging child may be removed.
            require(
                staging.parent.resolve() == versions.resolve()
                and staging.name.startswith(".stage-"),
                "unsafe_cleanup_target",
            )
            if staging.exists():
                shutil.rmtree(staging)
            raise
    executable = destination / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    return {
        "path": str(destination),
        "python": str(executable),
        "release_id": identity,
        "source_commit": manifest["source_commit"],
    }


def verify_tree(release, expected):
    no_links(release)
    manifest = read_manifest((release / "manifest.json").read_bytes(), expected)
    checked = set()
    for name, fact in manifest["files"].items():
        path = installed_file(release, name)
        no_links(path, checked)
        require(
            path.is_file()
            and path.stat().st_size == fact["bytes"]
            and digest(path.read_bytes()) == fact["sha256"],
            "installed_integrity_failed",
        )
    require(
        digest((release / POLICY).read_bytes()) == manifest["allowlist_sha256"],
        "allowlist_integrity_failed",
    )
    return manifest


def serve(args):
    require(
        sys.flags.isolated and sys.flags.no_site,
        "serve_requires_isolated_no_site_python",
    )
    release = Path(args.release).absolute()
    print('{"stage":"verify_installed"}', file=sys.stderr, flush=True)
    manifest = verify_tree(release, args.expected)
    require(
        digest(Path(__file__).read_bytes()) == manifest["files"]["deploy/release.py"]["sha256"],
        "running_tool_identity_mismatch",
    )
    print('{"stage":"configure_isolation"}', file=sys.stderr, flush=True)
    state = release / "state"
    no_links(state)
    for folder in ("raw", "cache", "tmp", "outputs", "logs"):
        no_links(state / folder)
        require((state / folder).is_dir(), "state_directory_missing")
    # Ignore inherited application configuration, secrets, providers and external paths.
    for key in list(os.environ):
        if key.startswith("OCEAN_") or key in {"PYTHONPATH", "PYTHONHOME"}:
            del os.environ[key]
    os.environ.update(
        OCEAN_RAW_DATA_DIR=str(state / "raw"),
        OCEAN_CACHE_DIR=str(state / "cache"),
        OCEAN_PROTOTYPE_DATA_DIR=str(release / "frontend/prototype/data"),
        OCEAN_AI_PROVIDER="rules",
        OCEAN_MONTHLY_EXECUTION_TOKEN="",
        TMP=str(state / "tmp"),
        TEMP=str(state / "tmp"),
        TMPDIR=str(state / "tmp"),
        MPLCONFIGDIR=str(state / "tmp/matplotlib"),
    )
    sys.dont_write_bytecode = True
    sys.path[:0] = [str(release / "backend"), str(site_path(release))]
    # Windows may create a loopback socketpair while constructing its event loop.
    # Construct it and the sole listening socket before disabling network creation.
    loop = asyncio.new_event_loop()
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sock.listen(128)

    def audit(event, values):
        if event in {
            "socket.connect",
            "socket.bind",
            "subprocess.Popen",
            "os.system",
            "os.exec",
            "os.spawn",
        }:
            raise PermissionError("Isolated release external action disabled")
        targets = []
        if event == "open":
            path, mode, flags = values
            if isinstance(path, (str, bytes, os.PathLike)) and (
                (isinstance(mode, str) and any(c in mode for c in "wax+"))
                or flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND)
            ):
                targets = [path]
        elif event in {"os.mkdir", "os.remove", "os.rmdir", "os.chmod"}:
            targets = [values[0]]
        elif event in {"os.rename", "os.link", "os.symlink"}:
            targets = list(values[:2])
        for target in targets:
            path = Path(os.fsdecode(target)).absolute()
            no_links(path)
            if not path.resolve().is_relative_to(state.resolve()):
                raise PermissionError("Isolated release write outside state disabled")

    print('{"stage":"import_original_app"}', file=sys.stderr, flush=True)
    sys.addaudithook(audit)
    import uvicorn
    from app.main import app
    from fastapi.responses import JSONResponse, RedirectResponse
    from fastapi.staticfiles import StaticFiles

    print('{"stage":"original_app_loaded"}', file=sys.stderr, flush=True)

    identity = {
        "schema": "ocean-running-release/v1",
        "release_id": manifest["release_id"],
        "source_commit": manifest["source_commit"],
        "profile": PROFILE,
        "runtime": manifest["runtime"],
        "dependencies": manifest["dependencies"],
        "known_A": "synthetic_read_only",
        "map": "licensed_static_exports",
        "raw_sources": "not_connected",
        "persistent_workflows": "not_connected",
        "models": "disabled",
        "production": False,
    }
    assets = {
        "/" + name.removeprefix("frontend/prototype/")
        for name in manifest["files"]
        if name.startswith("frontend/prototype/")
    }

    @app.get("/api/release")
    def running_release():
        return identity

    @app.middleware("http")
    async def read_only(request, call_next):
        path = request.url.path
        allowed = path in {
            "/api/health",
            "/api/release",
            "/api/viewport",
            "/api/query/current-state",
            "/api/query/front-response",
            "/api/fishing/availability",
        }
        allowed = allowed or bool(
            re.fullmatch(
                r"/api/(query/(known-cases(?:/[A-Za-z][A-Za-z0-9_-]{0,63})?|monthly-analysis/published(?:/sha256:[0-9a-f]{64})?)|frontend/day/[0-9-]{10}|fishing/[0-9-]{10})",
                path,
            )
        )
        if request.method not in {"GET", "HEAD"} or (path.startswith("/api/") and not allowed):
            response = JSONResponse(
                {"detail": "Disabled in isolated read-only release"}, status_code=403
            )
        elif path == "/":
            response = RedirectResponse("/prototype-fishing.html")
        elif not path.startswith("/api/") and path not in assets:
            response = JSONResponse({"detail": "Not found"}, status_code=404)
        else:
            try:
                response = await call_next(request)
                if response.status_code >= 500:
                    response = JSONResponse(
                        {"detail": "Not ready in isolated release"}, status_code=503
                    )
            except Exception:  # noqa: BLE001 -- protect original-app error response boundary.
                response = JSONResponse(
                    {"detail": "Not ready in isolated release"}, status_code=503
                )
        response.headers.update(
            {
                "X-Ocean-Release": manifest["release_id"],
                "X-Ocean-Commit": manifest["source_commit"],
                "Cache-Control": "no-store",
            }
        )
        return response

    app.mount("/", StaticFiles(directory=release / "frontend/prototype", html=True))
    server = uvicorn.Server(
        uvicorn.Config(app, log_level="error", access_log=False, lifespan="off")
    )
    print(
        json.dumps(
            {
                "base": f"http://127.0.0.1:{sock.getsockname()[1]}",
                "release_id": manifest["release_id"],
            }
        ),
        flush=True,
    )
    try:
        loop.run_until_complete(server.serve(sockets=[sock]))
    finally:
        sock.close()
        loop.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build_parser = commands.add_parser("build")
    for field in ("repo", "commit", "out"):
        build_parser.add_argument("--" + field, required=True)
    commands.add_parser("init").add_argument("--root", required=True)
    install_parser = commands.add_parser("install")
    for field in ("bundle", "expected", "commit", "root"):
        install_parser.add_argument("--" + field, required=True)
    serve_parser = commands.add_parser("serve")
    for field in ("release", "expected"):
        serve_parser.add_argument("--" + field, required=True)
    args = parser.parse_args()
    try:
        result = {"build": build, "init": init, "install": install, "serve": serve}[args.command](
            args
        )
        if result is not None:
            print(json.dumps(result, ensure_ascii=True))
    except BadZipFile:
        print(json.dumps({"error": "invalid_bundle"}), file=sys.stderr)
        return 1
    except ReleaseError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError, TypeError, ImportError):
        print(json.dumps({"error": "release_operation_failed"}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
