from test_social import account


def send(client, auth, **payload):
    response = client.post('/social/messages', headers=auth, json=payload)
    assert response.status_code == 201
    return response.json()['id']


def test_inbox_privacy_and_read_boundaries(client):
    alice, a = account(client, 'alice')
    bob, b = account(client, 'bob')
    _, outsider = account(client, 'outsider')
    first = send(client, a, recipient_id=bob, content='first')
    second = send(client, a, recipient_id=bob, content='second')
    assert client.get('/social/messages/inbox').status_code == 401
    assert client.get('/social/messages/inbox', headers=outsider).json() == []
    conversation = client.get('/social/messages/inbox', headers=b).json()[0]
    assert conversation['name'] == 'alice'
    assert conversation['target_id'] == alice
    assert conversation['last_message']['content'] == 'second'
    assert conversation['unread_count'] == 2
    url = f'/social/messages/direct/{alice}/read'
    for _ in range(2):
        assert client.post(url, headers=b, json={'through_message_id': first}).status_code == 204
    assert client.get('/social/messages/inbox', headers=b).json()[0]['unread_count'] == 1
    assert client.post(url, headers=outsider, json={'through_message_id': second}).status_code == 404
    assert client.post(url, headers=b, json={'through_message_id': second}).status_code == 204
    assert client.get('/social/messages/inbox', headers=b).json()[0]['unread_count'] == 0
    assert client.get('/social/messages/inbox', headers=a).json()[0]['unread_count'] == 0
    send(client, a, recipient_id=bob, content='new')
    assert client.get('/social/messages/inbox', headers=b).json()[0]['unread_count'] == 1


def test_group_details_bookmarks_and_validation(client):
    _, a = account(client, 'alice')
    _, b = account(client, 'bob')
    payload = dict(name=' Study ', course='BIOSCI 107', description='Together',
        group_type='Exam Prep', location='Library', study_format='In Person', preferred_days=['Mon', 'Wed'])
    response = client.post('/social/groups', headers=a, json=payload)
    assert response.status_code == 201
    group = response.json()
    assert client.get(f"/social/groups/{group['id']}/metadata", headers=b).json() == group
    assert client.get(f"/social/groups/{group['id']}/metadata").status_code == 401
    assert client.get('/social/groups/9999/metadata', headers=b).status_code == 404
    assert group['name'] == 'Study'
    for key in payload.keys() - {'name'}:
        assert group[key] == payload[key]
    url = f"/social/groups/{group['id']}/saved"
    for _ in range(2):
        assert client.put(url, headers=b).status_code == 204
    assert client.get('/social/groups/saved', headers=b).json() == [group]
    assert client.get('/social/groups/saved', headers=a).json() == []
    # Bookmarking does not grant membership or access to messages.
    assert client.get(f"/social/messages/group/{group['id']}", headers=b).status_code == 403
    for _ in range(2):
        assert client.delete(url, headers=b).status_code == 204
    assert client.get('/social/groups/saved', headers=b).json() == []
    assert client.put('/social/groups/9999/saved', headers=b).status_code == 404
    for extra in ({'preferred_days': ['Mon', 'Mon']}, {'preferred_days': ['Never']},
                  {'study_format': 'private'}, {'description': 'x' * 2001}, {'private': True}):
        assert client.post('/social/groups', headers=a, json={**payload, **extra}).status_code == 422


def test_group_unread_is_per_member_and_leaving_removes_inbox(client):
    _, a = account(client, 'alice')
    _, b = account(client, 'bob')
    _, c = account(client, 'carol')
    gid = client.post('/social/groups', headers=a, json={'name': 'Group'}).json()['id']
    for auth in (b, c):
        assert client.post(f'/social/groups/{gid}/join', headers=auth).status_code == 200
    mid = send(client, a, group_id=gid, content='hello')
    assert client.post(f'/social/messages/group/{gid}/read', headers=b,
        json={'through_message_id': mid}).status_code == 204
    assert client.get('/social/messages/inbox', headers=b).json()[0]['unread_count'] == 0
    assert client.get('/social/messages/inbox', headers=c).json()[0]['unread_count'] == 1
    client.delete(f'/social/groups/{gid}/leave', headers=c)
    assert client.get('/social/messages/inbox', headers=c).json() == []
    assert client.post(f'/social/messages/group/{gid}/read', headers=c,
        json={'through_message_id': mid}).status_code == 403


def test_inbox_order_and_pagination(client):
    alice, a = account(client, 'alice')
    bob, b = account(client, 'bob')
    carol, c = account(client, 'carol')
    send(client, b, recipient_id=alice, content='older')
    send(client, c, recipient_id=alice, content='newer')
    assert client.get('/social/messages/inbox?limit=1', headers=a).json()[0]['target_id'] == carol
    assert client.get('/social/messages/inbox?limit=1&offset=1', headers=a).json()[0]['target_id'] == bob
    assert client.get('/social/messages/inbox?limit=101', headers=a).status_code == 422
