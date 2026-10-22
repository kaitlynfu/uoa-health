from test_social import account


def test_user_search_privacy_literal_search_and_connection_states(client):
    alice, a = account(client, 'Alice')
    bob, b = account(client, 'Bob')
    _, stranger = account(client, 'Carol')
    assert client.get('/social/users?q=Bob').status_code == 401
    assert client.get('/social/users?q=b', headers=a).status_code == 422
    assert client.get('/social/users?q=  ', headers=a).json() == []
    assert client.get('/social/users?q=Alice', headers=a).json() == []
    found = client.get('/social/users?q=BOB', headers=a).json()
    assert found == [{'id': bob, 'display_name': 'Bob', 'connection': 'none'}]
    assert client.get('/social/users?q=Bob%25', headers=a).json() == []
    assert client.get('/social/users?q=example.test', headers=a).json() == []
    assert client.get('/social/users?q=Bob&limit=101', headers=a).status_code == 422
    client.post('/social/friends/request', headers=a, json={'friend_id': bob})
    assert client.get('/social/users?q=Bob', headers=a).json()[0]['connection'] == 'outgoing'
    assert client.get('/social/users?q=Alice', headers=b).json()[0]['connection'] == 'incoming'
    assert client.get('/social/users?q=Alice', headers=stranger).json()[0]['connection'] == 'none'
    client.post(f'/social/friends/{alice}/accept', headers=b)
    assert client.get('/social/users?q=Bob', headers=a).json()[0]['connection'] == 'friend'


def test_friend_lists_and_requests_are_scoped_and_directional(client):
    alice, a = account(client, 'alice')
    bob, b = account(client, 'bob')
    _, outsider = account(client, 'outsider')
    client.post('/social/friends/request', headers=a, json={'friend_id': bob})
    incoming = client.get('/social/friends/requests', headers=b).json()
    assert incoming[0]['user']['id'] == alice
    assert 'email' not in incoming[0]['user']
    assert client.get('/social/friends/requests', headers=a).json() == []
    assert client.get('/social/friends/requests?direction=outgoing', headers=a).json()[0]['user']['id'] == bob
    assert client.get('/social/friends/requests', headers=outsider).json() == []
    assert client.post(f'/social/friends/{bob}/accept', headers=a).status_code == 404
    assert client.post(f'/social/friends/{alice}/accept', headers=b).status_code == 200
    assert client.get('/social/friends/requests', headers=b).json() == []
    assert client.get('/social/friends', headers=a).json()[0]['user']['id'] == bob
    assert client.get('/social/friends', headers=b).json()[0]['user']['id'] == alice
    assert client.get('/social/friends', headers=outsider).json() == []
    client.delete(f'/social/friends/{bob}', headers=a)
    assert client.get('/social/friends', headers=b).json() == []
    assert client.get('/social/friends/requests?direction=everyone', headers=a).status_code == 422


def test_group_directory_membership_and_member_privacy(client):
    alice, a = account(client, 'alice')
    bob, b = account(client, 'bob')
    _, outsider = account(client, 'outsider')
    gid = client.post('/social/groups', headers=a, json={'name': 'Biology',
        'course': 'BIOSCI 107', 'description': 'Cell study', 'study_format': 'Online'}).json()['id']
    other = client.post('/social/groups', headers=outsider, json={'name': 'Other'}).json()['id']
    assert client.get('/social/groups').status_code == 401
    found = client.get('/social/groups?q=cell&course=BIOSCI&study_format=Online', headers=b).json()
    assert len(found) == 1
    assert found[0]['id'] == gid and found[0]['member_count'] == 1
    assert found[0]['joined'] is False and found[0]['role'] is None
    assert client.get('/social/groups?q=Biology%25', headers=b).json() == []
    client.put(f'/social/groups/{gid}/saved', headers=b)
    assert client.get(f'/social/groups/{gid}', headers=b).json()['saved'] is True
    assert client.get(f'/social/groups/{gid}', headers=a).json()['saved'] is False
    assert client.get('/social/groups/joined', headers=b).json() == []
    assert client.get(f'/social/groups/{gid}/members', headers=b).status_code == 403
    client.post(f'/social/groups/{gid}/join', headers=b)
    details = client.get(f'/social/groups/{gid}', headers=b).json()
    assert details['joined'] and details['role'] == 'member' and details['member_count'] == 2
    assert client.get('/social/groups/joined', headers=b).json()[0]['id'] == gid
    members = client.get(f'/social/groups/{gid}/members', headers=b).json()
    assert [m['user']['id'] for m in members] == [alice, bob]
    assert [m['role'] for m in members] == ['admin', 'member']
    assert all('email' not in m['user'] for m in members)
    assert client.get(f'/social/groups/{gid}/members', headers=outsider).status_code == 403
    assert client.get('/social/groups/99999', headers=b).status_code == 404
    assert client.get('/social/groups/99999/members', headers=b).status_code == 404
    assert client.get(f'/social/groups/{gid}/members?limit=1&offset=1', headers=a).json()[0]['user']['id'] == bob
    client.delete(f'/social/groups/{gid}/leave', headers=b)
    assert client.get('/social/groups/joined', headers=b).json() == []
    assert client.get('/social/groups?limit=1', headers=b).json()[0]['id'] == other
    # Static paths must not be swallowed by the dynamic group details route.
    assert client.get('/social/groups/saved', headers=b).status_code == 200


def test_reject_and_cancel_pending_requests(client):
    alice, a = account(client, 'alice')
    bob, b = account(client, 'bob')
    for auth, target in ((b, alice), (a, bob)):
        client.post('/social/friends/request', headers=a, json={'friend_id': bob})
        assert client.delete(f'/social/friends/{target}', headers=auth).status_code == 200
        assert client.get('/social/friends/requests', headers=b).json() == []
