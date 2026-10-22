from datetime import timedelta
from app.models import AccountEmailToken, Message, utc_now
from app.security import hash_access_token
from conftest import TestingSessionLocal


def account(client, name):
    auth=client.post('/auth/register',json={'email':name+'@example.test','display_name':name,'password':'password-12345'}).json()
    return auth, {'Authorization':'Bearer '+auth['access_token']}


def test_email_codes_are_hashed_one_use_and_revoke_sessions(client,monkeypatch):
    auth, headers=account(client,'recovery')
    from app.routers import auth as routes
    delivered=[]
    monkeypatch.setenv('SMTP_HOST','mail.example.test');monkeypatch.setenv('SMTP_FROM','sender@example.test')
    monkeypatch.setattr(routes,'send_account_email',lambda email,purpose,code:delivered.append((purpose,code)))
    assert client.post('/auth/password/reset/request',json={'email':'missing@example.test'}).status_code==202
    assert delivered==[]
    assert client.post('/auth/password/reset/request',json={'email':auth['user']['email']}).status_code==202
    code=delivered[-1][1]
    with TestingSessionLocal() as db:
        token=db.query(AccountEmailToken).one()
        assert token.token_hash==hash_access_token(code) and token.token_hash!=code
    assert client.post('/auth/password/reset',json={'code':code,'new_password':'different-password'}).status_code==204
    assert client.get('/auth/me',headers=headers).status_code==401
    assert client.post('/auth/password/reset',json={'code':code,'new_password':'another-password'}).status_code==400
    new=client.post('/auth/login',json={'email':auth['user']['email'],'password':'different-password'}).json()
    headers={'Authorization':'Bearer '+new['access_token']}
    assert client.post('/auth/email/verification/request',headers=headers).status_code==202
    code=delivered[-1][1]
    assert client.post('/auth/email/verification',headers=headers,json={'code':code}).status_code==204
    assert client.get('/auth/email/status',headers=headers).json()['verified'] is True
    assert client.post('/auth/email/verification',headers=headers,json={'code':code}).status_code==400


def test_expired_reset_and_login_limit(client):
    auth,headers=account(client,'expired')
    code='x'*43
    with TestingSessionLocal() as db:
        db.add(AccountEmailToken(token_hash=hash_access_token(code),user_id=auth['user']['id'],purpose='reset',expires_at=utc_now()-timedelta(seconds=1)))
        db.commit()
    assert client.post('/auth/password/reset',json={'code':code,'new_password':'different-password'}).status_code==400
    for _ in range(20):
        assert client.post('/auth/login',json={'email':auth['user']['email'],'password':'wrong'}).status_code==401
    response=client.post('/auth/login',json={'email':auth['user']['email'],'password':'password-12345'})
    assert response.status_code==429 and response.headers['Retry-After']


def test_bounded_named_history_and_cursor_do_not_leak_conversations(client):
    a,ha=account(client,'Alice');b,hb=account(client,'Bob');c,hc=account(client,'Chris')
    with TestingSessionLocal() as db:
        db.add_all([Message(sender_id=a['user']['id'],recipient_id=b['user']['id'],content=str(index)) for index in range(120)])
        db.add(Message(sender_id=c['user']['id'],recipient_id=b['user']['id'],content='Private other chat'));db.commit()
    path=f"/social/messages/direct/{b['user']['id']}"
    page=client.get(path,headers=ha).json()
    assert len(page)==50 and page[0]['content']=='70' and page[-1]['content']=='119'
    assert {m['sender_name'] for m in page}=={'Alice'}
    older=client.get(path+f"?before_id={page[0]['id']}&limit=100",headers=ha).json()
    assert len(older)==70 and older[0]['content']=='0'
    assert client.get(path+'?limit=101',headers=ha).status_code==422
    forward=client.get(path+f"?after_id={older[-1]['id']}&limit=25",headers=ha).json()
    assert len(forward)==25 and forward[0]['content']=='70' and forward[-1]['content']=='94'
    assert client.get(path+'?before_id=100&after_id=20',headers=ha).status_code==422
    assert client.get(f"/social/conversations/direct/{b['user']['id']}/metadata",headers=ha).json()['name']=='Bob'


def test_message_limit_applies_to_sends_across_targets_not_metadata(client, monkeypatch):
    from app.services import request_limits
    # Keep the fixed window in the future so real-UTC expiry cleanup does not
    # remove its counter while the test advances the mocked window clock.
    clock = [request_limits.time.time() + 3600]
    monkeypatch.setattr(request_limits.time, 'time', lambda: clock[0])
    a, ha = account(client, 'Alice'); b, hb = account(client, 'Bob')
    group = client.post('/social/groups', headers=ha, json={'name': 'Study'}).json()['id']
    metadata = f"/social/conversations/direct/{b['user']['id']}/metadata"
    for _ in range(65):
        assert client.get(metadata, headers=ha).status_code == 200
    for index in range(60):
        target = {'recipient_id': b['user']['id']} if index % 2 else {'group_id': group}
        assert client.post('/social/messages', headers=ha,
                           json={**target, 'content': str(index)}).status_code == 201
    for target in ({'recipient_id': b['user']['id']}, {'group_id': group}):
        response = client.post('/social/messages', headers=ha, json={**target, 'content': 'Over limit'})
        assert response.status_code == 429 and response.headers['Retry-After']
    assert client.get(metadata, headers=ha).status_code == 200
    with TestingSessionLocal() as db:
        assert db.query(Message).filter_by(sender_id=a['user']['id']).count() == 60
    # Another sender has a separate limit, and the next fixed window accepts again.
    assert client.post('/social/messages', headers=hb,
                       json={'recipient_id': a['user']['id'], 'content': 'Other sender'}).status_code == 201
    clock[0] += 60
    assert client.post('/social/messages', headers=ha,
                       json={'recipient_id': b['user']['id'], 'content': 'Next minute'}).status_code == 201


def test_deleted_peer_is_removed_from_inbox_before_pagination(client):
    a, ha = account(client, 'Alice'); b, hb = account(client, 'Bob'); c, hc = account(client, 'Chris')
    client.post('/social/messages', headers=hc,
                json={'recipient_id': a['user']['id'], 'content': 'Keep this conversation'})
    client.post('/social/messages', headers=ha,
                json={'recipient_id': b['user']['id'], 'content': 'Retained anonymous history'})
    client.post('/social/messages', headers=hb,
                json={'recipient_id': a['user']['id'], 'content': 'Erase my message'})
    assert client.request('DELETE', '/account', headers=hb,
        json={'email': b['user']['email'], 'password': 'password-12345'}).status_code == 204
    inbox = client.get('/social/messages/inbox?limit=1', headers=ha).json()
    assert [item['target_id'] for item in inbox] == [c['user']['id']]
    assert client.get('/social/messages/inbox?limit=1&offset=1', headers=ha).json() == []
    assert [item['target_id'] for item in client.get('/notifications', headers=ha).json()] == [c['user']['id']]
    with TestingSessionLocal() as db:
        assert db.query(Message).filter_by(sender_id=a['user']['id'], recipient_id=b['user']['id']).count() == 1
        assert db.query(Message).filter_by(sender_id=b['user']['id']).count() == 0
    assert client.get(f"/social/messages/direct/{b['user']['id']}", headers=ha).status_code == 404
    assert client.get(f"/social/conversations/direct/{b['user']['id']}/metadata", headers=ha).status_code == 404
    assert client.post('/social/messages', headers=ha,
        json={'recipient_id': b['user']['id'], 'content': 'Cannot send'}).status_code == 404
    assert client.post('/social/friends/request', headers=ha,
        json={'friend_id': b['user']['id']}).status_code == 404


def test_block_report_and_moderation_permissions(client,monkeypatch):
    a,ha=account(client,'Alice');b,hb=account(client,'Bob');c,hc=account(client,'Chris')
    bid=b['user']['id'];aid=a['user']['id']
    message=client.post('/social/messages',headers=hb,json={'recipient_id':aid,'content':'Hi Alice'}).json()
    assert client.post('/social/reports',headers=hc,json={'message_id':message['id'],'reason':'Should not see this private message'}).status_code==404
    report=client.post('/social/reports',headers=ha,json={'message_id':message['id'],'reason':'An example safety concern'}).json()
    assert client.get('/social/reports',headers=ha).status_code==403
    monkeypatch.setenv('TEAM43_MODERATOR_USER_IDS',str(c['user']['id']))
    rows=client.get('/social/reports',headers=hc).json()
    assert rows[0]['id']==report['id'] and rows[0]['message_content']=='Hi Alice'
    assert client.post(f"/social/reports/{report['id']}/resolve",headers=hc).status_code==204
    assert client.delete(f"/social/reports/{report['id']}/message",headers=ha).status_code==403
    assert client.delete(f"/social/reports/{report['id']}/message",headers=hc).status_code==204
    assert client.get(f'/social/messages/direct/{bid}',headers=ha).json()==[]
    assert client.put(f'/social/blocked/{bid}',headers=ha).status_code==204
    assert client.post('/social/messages',headers=hb,json={'recipient_id':aid,'content':'Blocked'}).status_code==403
    assert client.post('/social/friends/request',headers=hb,json={'friend_id':aid}).status_code==403
    assert client.get('/social/messages/inbox',headers=ha).json()==[]
    assert client.get('/social/users?q=Bob',headers=ha).json()==[]
    assert client.delete(f'/social/blocked/{bid}',headers=ha).status_code==204
    assert client.post('/social/messages',headers=hb,json={'recipient_id':aid,'content':'Now allowed'}).status_code==201


def test_group_owner_controls_and_account_erasure_preserve_other_members(client):
    a,ha=account(client,'Alice');b,hb=account(client,'Bob')
    group=client.post('/social/groups',headers=ha,json={'name':'Study'}).json();gid=group['id']
    assert client.post(f'/social/groups/{gid}/join',headers=hb).status_code==200
    assert client.put(f'/social/groups/{gid}',headers=hb,json={'name':'Unauthorized'}).status_code==403
    assert client.put(f'/social/groups/{gid}',headers=ha,json={'name':'Renamed'}).json()['name']=='Renamed'
    assert client.post(f'/social/groups/{gid}/ownership',headers=ha,json={'new_owner_id':b['user']['id']}).status_code==204
    assert client.delete(f'/social/groups/{gid}',headers=ha).status_code==403
    own=client.post('/social/messages',headers=ha,json={'group_id':gid,'content':'Erase this authored message'}).json()
    client.post('/social/messages',headers=hb,json={'group_id':gid,'content':'Keep other member message'})
    exported=client.get('/account/export',headers=ha).json()
    assert exported['authored_messages'][0]['id']==own['id']
    assert 'password_hash' not in str(exported) and 'access_token' not in str(exported)
    assert client.request('DELETE','/account',headers=ha,json={'email':a['user']['email'],'password':'wrong'}).status_code==400
    response=client.request('DELETE','/account',headers=ha,json={'email':a['user']['email'],'password':'password-12345'})
    assert response.status_code==204
    assert client.get('/auth/me',headers=ha).status_code==401
    rows=client.get(f'/social/messages/group/{gid}',headers=hb).json()
    assert [m['content'] for m in rows]==['Keep other member message']
    assert client.get('/social/users?q=Former',headers=hb).json()==[]
    assert client.delete(f'/social/groups/{gid}',headers=hb).status_code==204


def test_notifications_are_private_and_preferences_persist(client):
    a,ha=account(client,'Alice');b,hb=account(client,'Bob');c,hc=account(client,'Chris')
    client.post('/social/friends/request',headers=hb,json={'friend_id':a['user']['id']})
    client.post('/social/messages',headers=hb,json={'recipient_id':a['user']['id'],'content':'Unread'})
    items=client.get('/notifications',headers=ha).json()
    assert {item['kind'] for item in items}=={'friend','direct'}
    assert client.get('/notifications',headers=hc).json()==[]
    assert client.put('/notifications/preferences',headers=ha,json={'messages':False,'friend_requests':False}).status_code==200
    assert client.get('/notifications',headers=ha).json()==[]
    assert client.get('/notifications/preferences',headers=ha).json()['messages'] is False


def test_suggestions_require_both_accounts_opted_in(client):
    a,ha=account(client,'Alice');b,hb=account(client,'Bob')
    for header in (ha,hb):client.patch('/profile/me',headers=header,json={'interests':['Biology']})
    assert client.get('/social/suggestions',headers=ha).json()==[]
    client.patch('/profile/me',headers=ha,json={'matching_enabled':True})
    assert client.get('/social/suggestions',headers=ha).json()==[]
    client.patch('/profile/me',headers=hb,json={'matching_enabled':True})
    assert client.get('/social/suggestions',headers=ha).json()==[{'id':b['user']['id'],'display_name':'Bob','shared_count':1}]
    client.put(f"/social/blocked/{a['user']['id']}",headers=hb)
    assert client.get('/social/suggestions',headers=ha).json()==[]
    client.delete(f"/social/blocked/{a['user']['id']}",headers=hb)
    client.put(f"/social/blocked/{b['user']['id']}",headers=ha)
    assert client.get('/social/suggestions',headers=ha).json()==[]


def test_profile_photo_is_validated_private_and_metadata_is_removed(client):
    import base64
    from io import BytesIO
    from PIL import Image
    a,ha=account(client,'Alice');b,hb=account(client,'Bob')
    image=Image.new('RGB',(700,700),'red');exif=Image.Exif();exif[270]='Private camera comment'
    output=BytesIO();image.save(output,format='JPEG',exif=exif)
    encoded=base64.b64encode(output.getvalue()).decode()
    assert client.put('/profile/me/photo',headers=ha,json={'base64':encoded}).status_code==204
    result=client.get('/profile/me/photo',headers=ha).json()['base64']
    with Image.open(BytesIO(base64.b64decode(result))) as normalized:
        assert max(normalized.size)<=512 and not normalized.getexif()
    assert client.get('/profile/me/photo',headers=hb).json()['base64'] is None
    assert client.put('/profile/me/photo',headers=ha,json={'base64':'not a photo'}).status_code==422
    assert client.put('/profile/me/photo',headers=ha,json={'base64':'a'*1400001}).status_code==413
    assert client.delete('/profile/me/photo',headers=ha).status_code==204
    assert client.get('/profile/me/photo',headers=ha).json()['base64'] is None
