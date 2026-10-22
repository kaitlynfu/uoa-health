"""Exercise real routers/shared models without monkeypatching production classes."""

def account(client, name):
    result = client.post('/auth/register', json={
        'email': f'{name}@example.test', 'password': 'a-secure-test-password', 'display_name': name,
    })
    assert result.status_code == 201
    data = result.json()
    return data['user']['id'], {'Authorization': f"Bearer {data['access_token']}"}


def test_friend_request_accept_and_remove(client):
    alice, a = account(client, 'alice')
    bob, b = account(client, 'bob')
    response = client.post('/social/friends/request', headers=a, json={'friend_id': bob})
    assert response.status_code == 201
    assert response.json()['status'] == 'pending'
    assert client.post(f'/social/friends/{alice}/accept', headers=b).status_code == 200
    assert client.delete(f'/social/friends/{bob}', headers=a).status_code == 200


def test_group_membership_protects_reads_and_writes(client):
    _, owner = account(client, 'owner')
    _, outsider = account(client, 'outsider')
    group = client.post('/social/groups', headers=owner, json={'name': 'Study'}).json()['id']
    url = f'/social/messages/group/{group}'
    assert client.get(url).status_code == 401
    assert client.get(url, headers=outsider).status_code == 403
    payload = {'group_id': group, 'content': 'hello'}
    assert client.post('/social/messages', headers=outsider, json=payload).status_code == 403
    assert client.post(f'/social/groups/{group}/join', headers=outsider).status_code == 200
    assert client.post('/social/messages', headers=outsider, json=payload).status_code == 201
    assert len(client.get(url, headers=owner).json()) == 1
    assert client.delete(f'/social/groups/{group}/leave', headers=outsider).status_code == 200
    assert client.get(url, headers=outsider).status_code == 403
    assert client.delete(f'/social/groups/{group}/leave', headers=owner).status_code == 409


def test_direct_messages_are_scoped_to_authenticated_user(client):
    alice, a = account(client, 'alice')
    bob, b = account(client, 'bob')
    _, stranger = account(client, 'stranger')
    assert client.post('/social/messages', headers=a, json={'recipient_id': bob, 'content': 'private'}).status_code == 201
    assert len(client.get(f'/social/messages/direct/{alice}', headers=b).json()) == 1
    assert client.get(f'/social/messages/direct/{alice}', headers=stranger).json() == []


def test_invalid_targets_and_payloads(client):
    user, auth = account(client, 'user')
    assert client.post('/social/friends/request', headers=auth, json={'friend_id': user}).status_code == 400
    assert client.post('/social/friends/request', headers=auth, json={'friend_id': 9999}).status_code == 404
    assert client.post('/social/groups/9999/join', headers=auth).status_code == 404
    for payload in ({'content': 'hello'}, {'recipient_id': user, 'group_id': 1, 'content': 'hello'},
                    {'recipient_id': user, 'content': '   '}):
        assert client.post('/social/messages', headers=auth, json=payload).status_code == 422
    assert client.post('/social/groups', headers=auth, json={'name': '   '}).status_code == 422
