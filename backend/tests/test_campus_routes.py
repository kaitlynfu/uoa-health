import base64
import json
import plistlib
import pytest
from app.services.campus_routes import template
from test_shared_home_routes import account


def payload(seed, revision=0):
    legs = []
    for i, leg in enumerate(seed["legs"]):
        frame = "campus-test-" + str(i)
        binding = dict(version=1, building="303", route_key=seed["key"], floor=leg["floor"],
                       frame_id=frame, points=leg["points"])
        # Fake opaque map for server-envelope tests ONLY; iOS must reject it as ARWorldMap.
        raw = plistlib.dumps(dict(version=1, worldMap=b"bplist00test-map", routes=json.dumps(binding), savedAt="test"),
                              fmt=plistlib.FMT_BINARY)
        legs.append(dict(floor=leg["floor"],frame_id=frame,points=leg["points"],environment=base64.b64encode(raw).decode()))
    return dict(expected_revision=revision, start=seed["start"],destination=seed["destination"],
                accessible=seed["accessible"], include_gaps=seed["include_gaps"], surveyed=True, legs=legs)


def test_floor_partition_and_gaps():
    stairs = template("303-G-ENTRANCE-B", "303-104", False, False)
    assert [l["floor"] for l in stairs["legs"]] == ["G","1"]
    assert stairs["legs"][0]["transition"] == "stairs"
    lift = template("303-G-ENTRANCE-C", "303-104", True, False)
    assert lift["legs"][0]["transition"] == "elevator"
    assert all(l["points"][0]["x"] == l["points"][0]["y"] == 0 for l in lift["legs"])
    with pytest.raises(Exception) as error:
        template("303-G-ENTRANCE-A", "303-104", False, False)
    assert error.value.status_code == 422
    assert template("303-G-ENTRANCE-A", "303-104", False, True)["survey_gaps"]
    assert len(template("303-1-STAIRS-A","303-104",False,False)["legs"]) == 1


def test_atomic_publish_download_other_account_and_revision(client, monkeypatch):
    uid, editor = account(client,"campus-editor@example.test")
    _, reader = account(client,"campus-reader@example.test")
    monkeypatch.setenv("TEAM43_ROUTE_EDITOR_USER_IDS",str(uid))
    seed = client.get("/navigation/campus/template?start=303-G-ENTRANCE-C&destination=303-104&accessible=true",headers=editor).json()
    data = payload(seed)
    published = client.post("/navigation/campus/publish",json=data,headers=editor)
    assert published.status_code == 200, published.text
    path = "/navigation/campus/routes/"+seed["key"]+"/1"
    package = client.get(path,headers=reader).json()
    assert package["revision"] == 1
    assert package["legs"][0]["environment"] == data["legs"][0]["environment"]
    assert package["legs"][1]["points"] == data["legs"][1]["points"]
    assert len(package["legs"][0]["sha256"]) == 64
    assert client.post("/navigation/campus/publish",json=data,headers=editor).status_code == 409
    data["expected_revision"] = 1
    assert client.post("/navigation/campus/publish",json=data,headers=editor).json()["revision"] == 2
    assert client.get(path,headers=reader).json() == package  # old walks stay on version 1
    catalog = client.get("/navigation/campus/catalog",headers=reader).json()
    assert catalog["published"][0]["revision"] == 2
    assert len(catalog["published"]) == 1
    assert "environment" not in json.dumps(catalog)


@pytest.mark.parametrize("change",["geometry","floor","frame","missing_leg","unsurveyed","corrupt","other_route"])
def test_reject_mismatched_recording_without_partial_publish(client,monkeypatch,change):
    uid, editor=account(client,"campus-editor@example.test")
    monkeypatch.setenv("TEAM43_ROUTE_EDITOR_USER_IDS",str(uid))
    seed=template("303-G-ENTRANCE-B","303-104",False,False)
    data=payload(seed)
    if change=="geometry": data["legs"][0]["points"][1]["x"]+=.3
    if change=="floor": data["legs"][0]["floor"]="1"
    if change=="frame": data["legs"][0]["frame_id"]="campus-other"
    if change=="missing_leg": data["legs"].pop()
    if change=="unsurveyed": data["surveyed"]=False
    if change=="corrupt": data["legs"][0]["environment"]="not base64"
    if change=="other_route": data["destination"]="303-103"
    assert client.post("/navigation/campus/publish",headers=editor,json=data).status_code == 422
    assert client.get("/navigation/campus/catalog",headers=editor).json()["published"] == []


def test_permissions_and_request_limit(client,monkeypatch):
    _, reader=account(client,"campus-reader@example.test")
    monkeypatch.delenv("TEAM43_ROUTE_EDITOR_USER_IDS",raising=False)
    assert client.get("/navigation/campus/catalog").status_code == 401
    assert client.get("/navigation/campus/template?start=x&destination=y",headers=reader).status_code == 403
    assert client.post("/navigation/campus/publish",headers=reader,json={}).status_code == 403
    uid, editor=account(client,"campus-editor@example.test")
    monkeypatch.setenv("TEAM43_ROUTE_EDITOR_USER_IDS",str(uid))
    monkeypatch.setattr("app.routers.campus_routes.MAX_BODY",10)
    assert client.post("/navigation/campus/publish",headers=editor,content=b"x"*11).status_code == 413
