"""Serve the exported browser app alongside the API on the same HTTPS origin."""
from pathlib import Path

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


class WebFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if path in (".", "", "index.html", "build-info.json", "manifest.json"):
            response.headers["Cache-Control"] = "no-cache"
        return response


def mount_web_app(app, directory=None):
    directory = Path(directory) if directory is not None else Path(__file__).parent / "static" / "web"
    # Source checkouts and older backend-only release archives have no web export.
    if not (directory / "index.html").is_file():
        return False
    app.mount("/app", WebFiles(directory=directory, html=True), name="web-app")
    # Expo single-page exports use root-relative asset URLs, even when the page
    # itself is opened at /app/. Expose only those generated asset directories.
    for folder in ("_expo", "assets"):
        if (directory / folder).is_dir():
            app.mount("/" + folder, StaticFiles(directory=directory / folder), name="web-" + folder)
    if (directory / "favicon.ico").is_file():
        @app.get("/favicon.ico", include_in_schema=False)
        def web_favicon():
            return FileResponse(directory / "favicon.ico")
    return True
