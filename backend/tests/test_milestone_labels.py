import pytest


def select(client, email="labels@example.test", plan="COMH_CLINICAL"):
    auth=client.post("/auth/register",json={"email":email,"password":"secure-test-password","display_name":"Course editor"}).json()
    headers={"Authorization":"Bearer "+auth["access_token"]}
    programme=next(p for p in client.get("/programmes").json() if p["name"]=="Bachelor of Health Sciences")
    journey=client.put("/journey/me/programme",headers=headers,json={"programme_id":programme["id"],"current_stage":1,"catalogue_year":2027,"plan_code":plan}).json()
    return headers,journey


def test_labels_survive_reload_and_progress_updates_without_changing_shared_template(client):
    headers,journey=select(client)
    elective=journey["milestones"][1]
    path=f"/journey/me/milestones/{elective['id']}"
    completed=client.patch(path,headers=headers,json={"completed":True}).json()
    edited=client.patch(path,headers=headers,json={"custom_title":"  Chemistry of the Living World  ","custom_course_code":"CHEM 110"})
    assert edited.status_code==200
    result=edited.json()
    course=result["milestones"][1]
    assert course["title"]=="Chemistry of the Living World"
    assert course["original_title"]==elective["title"]
    assert course["custom_course_code"]=="CHEM 110"
    for key in ["completed_count","completed_points","total_points","progress_percent"]:
        assert result[key]==completed[key]
    assert course["completed_at"]==completed["milestones"][1]["completed_at"]
    assert client.get("/journey/me",headers=headers).json()["milestones"][1]==course
    unticked=client.patch(path,headers=headers,json={"completed":False}).json()["milestones"][1]
    assert unticked["title"]==course["title"] and not unticked["completed"]
    template=client.get(f"/journey/programmes/{journey['programme']['id']}/milestones",params={"catalogue_year":2027,"plan_code":"COMH_CLINICAL"}).json()
    assert template[1]["title"]==elective["title"]
    assert template[1]["points"]==elective["points"]


def test_labels_are_private_partial_resettable_and_exported(client):
    first,journey=select(client)
    second,_=select(client,"other@example.test")
    mid=journey["milestones"][1]["id"];path=f"/journey/me/milestones/{mid}"
    client.patch(path,headers=first,json={"custom_title":"My elective","custom_course_code":"CHEM 110"})
    assert client.get("/journey/me",headers=second).json()["milestones"][1]["title"]==journey["milestones"][1]["title"]
    client.patch("/profile/me",headers=first,json={"interests":["Research"]})
    partial=client.patch(path,headers=first,json={"custom_title":"A different name"}).json()["milestones"][1]
    assert partial["custom_course_code"]=="CHEM 110"
    exported=client.get("/account/export",headers=first).json()
    assert exported["milestone_labels"][f"milestone_title:{mid}"]=="A different name"
    assert client.get("/profile/me",headers=first).json()["interests"]==["Research"]
    reset=client.patch(path,headers=first,json={"custom_title":None,"custom_course_code":None}).json()["milestones"][1]
    assert reset["title"]==journey["milestones"][1]["title"]
    assert reset["custom_title"] is None and reset["custom_course_code"] is None


@pytest.mark.parametrize("payload",[{}, {"completed":None},{"custom_title":"   "},{"custom_title":"x"*101},{"custom_course_code":"x"*31},{"points":900}])
def test_invalid_edits_leave_course_unchanged(client,payload):
    headers,journey=select(client)
    mid=journey["milestones"][1]["id"]
    assert client.patch(f"/journey/me/milestones/{mid}",headers=headers,json=payload).status_code==422
    assert client.get("/journey/me",headers=headers).json()==journey


def test_edits_require_auth_and_selected_plan_and_do_not_leak_between_plans(client):
    headers,journey=select(client)
    mid=journey["milestones"][1]["id"];path=f"/journey/me/milestones/{mid}"
    assert client.patch(path,json={"custom_title":"Private"}).status_code==401
    assert client.patch("/journey/me/milestones/999999",headers=headers,json={"custom_title":"Private"}).status_code==404
    client.patch(path,headers=headers,json={"custom_title":"My elective"})
    choice={"programme_id":journey["programme"]["id"],"current_stage":1,"catalogue_year":2027,"plan_code":"HSDA_STANDARD"}
    switched=client.put("/journey/me/programme",headers=headers,json=choice).json()
    assert all(m["custom_title"] is None for m in switched["milestones"])
    assert client.patch(path,headers=headers,json={"custom_title":"Wrong plan"}).status_code==409
    choice["plan_code"]="COMH_CLINICAL"
    restored=client.put("/journey/me/programme",headers=headers,json=choice).json()
    assert restored["milestones"][1]["title"]=="My elective"
