import auth
import pytest

# TODO: make these shared with test_1
@pytest.fixture
def session():
    return auth.Session()

@pytest.fixture
def superuser(session):
    session.login("promis", "swordfish")
    return session

@pytest.fixture
def john(session):
    session.login("john", "test")
    return session

@pytest.fixture
def melanie(session):
    session.login("melanie", "test")
    return session

@pytest.fixture
def connie(session):
    session.login("connie", "test")
    return session

def test_per_project_sessions(connie):
    '''IonosatMicro/promis-backend#74'''
    for i in [ 1, 42000, 42001 ]:
        r = connie.get("/en/api/sessions?project=" + str(i))
        assert r.status_code == 200, "Invalid status code"
        json_data = r.json()
        assert all(res["satellite"] == i for res in json_data["results"]), "Satellite entries in session mixup"

def test_super_user_access_level1(superuser):
    '''IonosatMicro/promis-backend#75'''
    r = superuser.get("/en/api/download/1")
    assert r.status_code == 200, "Invalid status code"
    json_data = r.json()
    assert "chn_doc" in json_data, "Can't see channels"
    assert "par_doc" in json_data, "Can't see parameters"

def test_unauth_access(session):
    '''IonosatMicro/promis-backend#78'''
    r = session.get("/en/api/download/1")
    assert r.status_code != 500, "Invalid status code"
    # TODO: this doesn't perfectly verify the described behaviour, but I assume the root cause is the same

def test_unauth_session_401_data_url(session):
    '''IonosatMicro/promis-backend#76'''
    r = session.get("/en/api/download/1")
    assert r.status_code == 401, "Expecting 401 Please Authenticate"

def test_unauth_session_401_200_general_url(session):
    '''IonosatMicro/promis-backend#76, IonosatMicro/promis-backend#77'''
    r = session.get("/en/api")
    assert r.status_code in [ 401, 200 ], "Expecting 401 Please Authenticate or 200 OK"


# See test_auth.py
# TODO: combine in conftest.py or something
_fix = pytest.lazy_fixture
multiuser = pytest.mark.parametrize(
    "user, user_name", 
    [ 
        (_fix("superuser"), "promis"),
        (_fix("john"), "john"),
        (_fix("connie"), "connie"),
        (_fix("melanie"), "melanie")
    ], 
    ids = [ 
        "Superuser",
        "Regular user",
        "Level 2 user",
        "Level 1 user"
    ]
)
    
multiproject = pytest.mark.parametrize("space_project_id", 
                                       [ 1, 42000, 42001 ], 
                                       ids = [ "Potential", "Peace&Love", "Roundabout" ])

@multiuser
@multiproject
def test_per_project_sessions(user, space_project_id, user_name):
    '''IonosatMicro/promis#55 IonosatMicro/promis#140'''
    r = user.get("/en/api/sessions/?space_project=%d" % space_project_id)
    assert r.status_code == 200, "Invalid status code"
    json_data = r.json()
    assert "count" in json_data, "Malformed JSON received"
    assert json_data["count"] > 0, "Can't see any session"
    assert "results" in json_data and len(json_data["results"]) > 0, "Malformed JSON received"
    assert json_data["results"][0]["space_project"] == space_project_id
