"""Live acceptance test for: teacher accept/decline + auto-reassign, teacher
feedback, live completion sweep, and council programme-quality. Runs against the
local engine on :8001 using the shared secret."""
import asyncio, base64, json, httpx, datetime as dt
import motor.motor_asyncio as motor
import sys  # noqa: E402
sys.path.insert(0, "/app/backend/tests")
import _test_tag  # noqa: E402

_test_tag.install()  # Prompt 2G — a standalone script: its requests to this preview carry the signed test tag


SECRET = [l for l in open('/app/backend/.env') if l.startswith('PULSE_SHARED_SECRET=')][0].split('=', 1)[1].strip()
B = 'http://localhost:8001/api/institutional'
EVENT = 'NOSTOPS-EVT-2026-000001'   # published Mumbai event


def hdr(uid, role, name):
    a = {'user_id': uid, 'name': name, 'role': role, 'persona': 'x'}
    return {'X-Pulse-Secret': SECRET, 'X-Pulse-User': base64.b64encode(json.dumps(a).encode()).decode(),
            'Content-Type': 'application/json'}


results = []
def check(name, cond, extra=''):
    results.append(cond)
    print(('PASS' if cond else 'FAIL') + f' - {name} {extra}')


async def main():
    db = motor.AsyncIOMotorClient('mongodb://localhost:27017')['nostops_web']
    with httpx.Client(timeout=40) as c:
        # ---- reset matching state on the event for a clean run ----
        await db['inst_teacher_assignments'].delete_many({'event_id': EVENT})
        await db['inst_events'].update_one({'event_id': EVENT}, {'$set': {'assigned_teacher': None}})

        # ---- A. seed two Mumbai teachers via the directory sync (auto-matches) ----
        T1, T2 = 'qa_gov_t1', 'qa_gov_t2'
        c.post(f'{B}/teacher/directory/sync', headers=hdr(T1, 'teacher', 'Asha Mumbai'),
               json={'name': 'Asha Mumbai', 'city': 'Mumbai', 'email': 'asha.qa@nostopsqa.com'})
        r2 = c.post(f'{B}/teacher/directory/sync', headers=hdr(T2, 'teacher', 'Ravi Mumbai'),
                    json={'name': 'Ravi Mumbai', 'city': 'Mumbai', 'email': 'ravi.qa@nostopsqa.com'})
        print('sync2 newly_matched=', r2.json().get('newly_matched'))

        ev = await db['inst_events'].find_one({'event_id': EVENT}, {'assigned_teacher': 1})
        at = ev.get('assigned_teacher') or {}
        proposed_tid = at.get('teacher_id')
        check('publish auto-match creates a PROPOSED offer', at.get('status') == 'PROPOSED', f"(status={at.get('status')}, teacher={proposed_tid})")

        # public page must NOT reveal a teacher who hasn't accepted
        pub = c.get(f'{B}/public/events/{(await db["inst_events"].find_one({"event_id": EVENT}))["slug"]}',
                    headers={'X-Pulse-Secret': SECRET}).json().get('event', {})
        check('PROPOSED teacher hidden on public page', pub.get('teacher_verified') is False, f"(teacher_verified={pub.get('teacher_verified')})")

        other = T2 if proposed_tid == T1 else T1
        # proposed teacher sees can_respond
        te = c.get(f'{B}/teacher/events/{EVENT}', headers=hdr(proposed_tid, 'teacher', 'x')).json()
        check('proposed teacher can_respond', te.get('can_respond') is True, f"(status={te.get('assignment_status')})")

        # ---- B. DECLINE → auto-reassign to the other teacher ----
        dr = c.post(f'{B}/teacher/events/{EVENT}/respond', headers=hdr(proposed_tid, 'teacher', 'x'),
                    json={'action': 'DECLINE', 'reason': 'Schedule clash'}).json()
        check('decline triggers auto-reassign', dr.get('reassigned') is True, f"(to={dr.get('to_teacher')})")
        ev = await db['inst_events'].find_one({'event_id': EVENT}, {'assigned_teacher': 1})
        at = ev.get('assigned_teacher') or {}
        check('reassigned to the OTHER teacher as PROPOSED', at.get('teacher_id') == other and at.get('status') == 'PROPOSED',
              f"(now={at.get('teacher_id')}, status={at.get('status')})")
        # declined teacher must NOT be re-offered / no longer sees it as pending
        te_decl = c.get(f'{B}/teacher/events/{EVENT}', headers=hdr(proposed_tid, 'teacher', 'x'))
        check('declined teacher no longer has a pending offer', te_decl.status_code == 404, f"(http={te_decl.status_code})")

        # ---- C. the new teacher ACCEPTS ----
        ar = c.post(f'{B}/teacher/events/{EVENT}/respond', headers=hdr(other, 'teacher', 'x'),
                    json={'action': 'ACCEPT'}).json()
        check('accept sets ACCEPTED', ar.get('status') == 'ACCEPTED')
        ev = await db['inst_events'].find_one({'event_id': EVENT}, {'assigned_teacher': 1, 'slug': 1})
        check('event.assigned_teacher.status = ACCEPTED', (ev.get('assigned_teacher') or {}).get('status') == 'ACCEPTED')
        pub = c.get(f'{B}/public/events/{ev["slug"]}', headers={'X-Pulse-Secret': SECRET}).json().get('event', {})
        check('ACCEPTED teacher now shown on public page', pub.get('teacher_verified') is True)

        # ---- D. seed a PAST event with attendance + feedback for completion + quality ----
        src = await db['inst_events'].find_one({'event_id': EVENT})
        past_id = 'NOSTOPS-EVT-TEST-PAST1'
        yesterday = (dt.date.today() - dt.timedelta(days=1)).isoformat()
        await db['inst_events'].delete_one({'event_id': past_id})
        past = {**{k: v for k, v in src.items() if k != '_id'}, 'event_id': past_id,
                'slug': 'qa-gov-past-event', 'event_date': yesterday, 'lifecycle': 'PUBLISHED',
                'thankyou_sent_at': None, 'assigned_teacher': None}
        await db['inst_events'].insert_one(past)
        # two confirmed participants + attendance (p1 attends 2 events → repeat)
        await db['inst_registrations'].delete_many({'event_id': {'$in': [past_id, EVENT]}, 'participant_id': {'$regex': 'qa_gov_p'}})
        await db['inst_attendance'].delete_many({'event_id': {'$in': [past_id, EVENT]}, 'participant_id': {'$regex': 'qa_gov_p'}})
        await db['inst_feedback'].delete_many({'event_id': {'$in': [past_id, EVENT]}, 'participant_id': {'$regex': 'qa_gov_p'}})
        pid_prog = src.get('programme_id')
        for pid, ev_id in [('qa_gov_p1', past_id), ('qa_gov_p2', past_id), ('qa_gov_p1', EVENT)]:
            await db['inst_registrations'].insert_one({'registration_id': f'r_{pid}_{ev_id}', 'event_id': ev_id,
                'organisation_id': src['organisation_id'], 'participant_id': pid, 'booking_status': 'CONFIRMED',
                'participant_name': pid, 'participant_type': 'EMPLOYEE'})
            await db['inst_attendance'].insert_one({'attendance_id': f'a_{pid}_{ev_id}', 'event_id': ev_id,
                'registration_id': f'r_{pid}_{ev_id}', 'participant_id': pid, 'status': 'PRESENT'})
        await db['inst_feedback'].insert_one({'feedback_id': 'f1', 'event_id': past_id, 'participant_id': 'qa_gov_p1',
            'organisation_id': src['organisation_id'], 'rating': 5, 'comment': 'Calming breathing improved my sleep and focus greatly'})
        await db['inst_feedback'].insert_one({'feedback_id': 'f2', 'event_id': past_id, 'participant_id': 'qa_gov_p2',
            'organisation_id': src['organisation_id'], 'rating': 4, 'comment': 'Relaxing breathing practice, better sleep'})
        await db['inst_teacher_feedback'].delete_many({'event_id': past_id})
        await db['inst_teacher_feedback'].insert_one({'teacher_feedback_id': 'tf1', 'event_id': past_id,
            'teacher_id': other, 'programme_id': pid_prog, 'organisation_id': src['organisation_id'],
            'rating': 5, 'comment': 'Engaged cohort, venue acoustics challenging'})

        # ---- E. completion sweep flips the past event to COMPLETED ----
        sweep = c.post(f'{B}/jobs/completion-sweep', headers={'X-Pulse-Secret': SECRET}).json()
        check('completion sweep ran', sweep.get('ok') is True, f"(completed={sweep.get('moved_completed')}, live={sweep.get('moved_live')})")
        pastdoc = await db['inst_events'].find_one({'event_id': past_id}, {'lifecycle': 1, 'completed_at': 1})
        check('past event flipped to COMPLETED', pastdoc.get('lifecycle') == 'COMPLETED' and bool(pastdoc.get('completed_at')))

        # ---- F. council programme-quality aggregates (PII-free) ----
        q = c.get(f'{B}/council/programme-quality', headers=hdr('qa_guru', 'guru', 'Guru'))
        check('council quality endpoint 200', q.status_code == 200, f"(http={q.status_code})")
        qd = q.json()
        prog = next((p for p in qd.get('programmes', []) if p['programme_id'] == pid_prog), None)
        check('quality has the programme', prog is not None)
        if prog:
            check('participation counted', prog['participation'] >= 2, f"(={prog['participation']})")
            check('attendance_rate computed', prog['attendance_rate'] > 0, f"(={prog['attendance_rate']})")
            check('repeat participation detected (p1 across 2 events)', prog['repeat_participation'] >= 1, f"(={prog['repeat_participation']})")
            check('participant avg rating', prog['participant_rating'] is not None, f"(={prog['participant_rating']})")
            check('participant feedback themes extracted', len(prog['participant_themes']) > 0, f"({[t['theme'] for t in prog['participant_themes'][:5]]})")
            check('teacher rating captured', prog['teacher_rating'] is not None, f"(={prog['teacher_rating']})")
            check('cities listed', len(prog['cities']) > 0, f"({prog['cities']})")
            check('trend present', len(prog['trend']) > 0)
        check('quality totals present + privacy note', bool(qd.get('privacy_note')) and qd.get('total_participation') is not None)
        # ensure NO participant identity leaks in the payload
        blob = json.dumps(qd)
        check('no participant identity leaks', 'qa_gov_p1' not in blob and 'qa_gov_p2' not in blob)

    print('\\n==== %d/%d PASS ====' % (sum(results), len(results)))


asyncio.run(main())
