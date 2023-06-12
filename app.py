from flask import Flask, render_template, request, url_for
from flask_socketio import SocketIO, emit
from bson.objectid import ObjectId
from pymongo import MongoClient
from time import time
import requests
import hashlib
import json
from dotenv import load_dotenv
import os

load_dotenv()
app = Flask(__name__)
socketio = SocketIO(app, async_mode=None)

client = MongoClient(os.getenv('MONGODB_URI'))
db = client['SmallTalk']
ticket_table = db['Tickets']
user_table = db['Users']

headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Authorization': os.getenv('SMALLTALK_TOKEN')
}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        user = request.form.get('user')
        password = request.form.get('password')
        password = hashlib.md5(password.encode()).hexdigest()
        user_data = user_table.find_one({'user': user})
        if user_data:
            return {'status': 'failed'}
        else:
            id_ = user_table.insert_one(
                {'user': user, 'password': password, 'agent': False, 'customer': False}).inserted_id
            return {'status': 'success', 'token': str(id_)}
    else:
        return render_template('signup.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')

    else:
        user = request.form.get('user')
        password = request.form.get('password')
        password_hash = hashlib.md5(password.encode()).hexdigest()
        user_data = user_table.find_one({'user': user, 'password': password_hash})
        if user_data:
            return {'status': 'success', 'token': str(user_data['_id'])}
        else:
            return {'status': 'failed'}


@app.route('/create_ticket', methods=['POST'])
def create_ticket():
    query = {"name": request.form.get('name'),
             "phone": request.form.get('phone'),
             "email": request.form.get('email'),
             "title": request.form.get('title'),
             "desc": request.form.get('desc'),
             "cat": request.form.get('cat'),
             "owner": request.form.get('token'),
             "status": "open",
             }
    user_token = request.form.get('token')
    owner_name = user_table.find_one({'_id': ObjectId(user_token)})['user']
    print(owner_name)
    query['owner_name'] = owner_name
    tid = ticket_table.insert_one(query).inserted_id
    query['ticket_id'] = str(tid)
    socketio.emit('ticket_update', {'owner_name': owner_name, 'type': 'new', 'updated_by': user_token}, broadcast=True)
    return {'status': 'success'}


@app.route('/get_tickets', methods=['POST'])
def get_tickets():
    owner = request.form.get('token')
    if not owner:
        tickets = ticket_table.find({})
        tickets = list(tickets)
        resp = {'data': tickets, 'status': 'success'}
        return json.dumps(resp, default=str)
    else:
        tickets = ticket_table.find({'owner': owner})
        tickets = list(tickets)
        resp = {'data': tickets, 'status': 'success'}
        return json.dumps(resp, default=str)


@app.route('/set_ticket_status', methods=['POST'])
def solved():
    user_token = request.form.get('token')
    ticket_id = request.form.get('ticket_id')
    user = user_table.find_one({'_id': ObjectId(user_token)})['user']
    status = request.form.get('status')
    to_put = {'status': status}
    if request.form.get('status') == 'closed':
        to_put['closed_by'] = user
        to_put['closed_at'] = int(time())

    ticket_table.update_one({'_id': ObjectId(ticket_id)}, {'$set': to_put})
    socketio.emit('ticket_update', {'owner_name': user, 'type': 'update', 'updated_by': user_token}, broadcast=True)
    return {'status': 'success'}


@socketio.on('connected')
def _on(data):
    print("Connected")
    to_put = {data['type']: True}
    user_table.update_one({'_id': ObjectId(data['token'])}, {'$set': to_put})
    customers = list(user_table.find({'customer': True}))
    agents = list(user_table.find({'agent': True}))
    active_customers = [user['user'] for user in customers]
    active_agents = [user['user'] for user in agents]
    emit('update_users', {'agent_count': len(active_agents),
                          'customer_count': len(active_customers),
                          'agents': active_agents,
                          'customers': active_customers
                          }, broadcast=True)


@socketio.on('disconnected')
def _off(data):
    print("Disconnected")
    to_put = {data['type']: False}
    user_table.update_one({'_id': ObjectId(data['token'])}, {'$set': to_put})
    customers = list(user_table.find({'customer': True}))
    agents = list(user_table.find({'agent': True}))
    active_customers = [user['user'] for user in customers]
    active_agents = [user['user'] for user in agents]
    emit('update_users', {'agent_count': len(active_agents),
                          'customer_count': len(active_customers),
                          'agents': active_agents,
                          'customers': active_customers
                          }, broadcast=True)


@app.route('/support')
def support():
    return render_template('support.html')


@app.route('/agent')
def agent():
    return render_template('agent.html')


@app.route('/get_talk_link', methods=['POST'])
def get_talk_link():
    payload = {"name": request.form.get('title'),
               "access": "anyone",
               "mic_behavior": "start_on",
               "display_name": "Desktalk Support",
               "theme_id": "538b2224-7348-4271-afc9-baa9aecfeb65",
               "description": "This talk is generated by Desktalk Support. Here is what you provided as the "
                              "description." + '"' + request.form.get('desc') + '"'
               }
    response = requests.request("POST", "https://www.atsmalltalk.com/api/p/talk", headers=headers,
                                data=json.dumps(payload))
    link = response.json()['talk']['short_url']
    owner_name = user_table.find_one({'_id': ObjectId(request.form.get('token'))})['user']
    socketio.emit('ticket_taken',
                  {'link': link, 'ticket_id': request.form.get('ticket_id'), 'owner': request.form.get('token'),
                   'taken_by': owner_name}, broadcast=True)
    ticket_table.update_one({'_id': ObjectId(request.form.get('ticket_id'))},
                            {'$set': {'join_link': link, 'taken_by': owner_name}})
    return {'link': link}


if __name__ == '__main__':
    socketio.run(app)
