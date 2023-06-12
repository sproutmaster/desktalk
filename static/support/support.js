const token = window.localStorage.getItem('token');
if (!token)
    window.location.href = '/login';

const socket = io();

socket.emit('connected', {'token': token, 'type': 'customer'});

socket.on('update_users', function (data) {
    $('#agent_count').text(data['agent_count']);
    $('#customer_count').text(data['customer_count']);
    $('#wait_time').text('unknown');
});

socket.on('ticket_update', function (data) {
    if(data['action'] === 'new')
        return;

    if(data['owner'] === token) {
        alert(data['updated_by_name'] + ' has set your ticket status to ' + data['status']);
        update_tickets();
    }
});

window.onload = function () {
    update_tickets();
}

window.onbeforeunload = function () {
    socket.emit('disconnected', {'token': token, 'type': 'customer'});
}

function logout() {
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('name');
    window.localStorage.removeItem('phone');
    window.localStorage.removeItem('email');
    window.location.href = "/";
}

function show_create_ticket() {
    $('#tickets_container').addClass('_hidden');
    $('#create_ticket_container').removeClass('_hidden');

    let user = window.localStorage.getItem('name');
    let phone = window.localStorage.getItem('phone');
    let email = window.localStorage.getItem('email');

    if (!user || !phone || !email) {
    $('#name').val(user) ;
    $('#phone').val(phone);
    $('#email').val(email);
    }
}

function hide_create_ticket() {
    $('#tickets_container').removeClass('_hidden');
    $('#create_ticket_container').addClass('_hidden');
}

function update_tickets() {
    $.ajax({
        url: '/get_tickets',
        type: 'POST',
        data: {
            'token': token,
        },
        success: function (msg) {
            $('#tickets_container').empty();
            let data = JSON.parse(msg);
            if (data.status !== 'success')
                alert('Server error, please try again later');
            else {
                    data.data.map((item) => {
                    let card = createCard(item['_id'], item['title'], item['desc'], item['cat'], item['join_link']);
                    $('#tickets_container').append(card);
                });
            }
        }
    });
}
function create_ticket() {
    let user = $('#name').val();
    let phone = $('#phone').val();
    let email = $('#email').val();
    let title = $('#title').val();
    let desc = $('#desc').val();
    let cat = $('#cat').val();

    if (!user || !phone || !email || !title || !desc || !cat)
        return alert('Please fill all the fields');

    localStorage.setItem('name', user);
    localStorage.setItem('phone', phone);
    localStorage.setItem('email', email);

    // store data in local storage
    window.localStorage.setItem('name', user);

    // send data to server, add to database, add this ticket to agent queue. Get id of ticket from server and add to customer queue

    $.ajax({
        url: '/create_ticket',
        type: 'POST',
        data: {
            'token': token,
            'name': user,
            'phone': phone,
            'email': email,
            'title': title,
            'desc': desc,
            'cat': cat
        },
        success: function (data) {
            if (data.status !== 'success')
                alert('Server error, please try again later');
            else {
                alert('Ticket created successfully');
                window.location.href = '/support';
            }
        }
    });
}

function createCard(ticket_id, title, desc, cat, join_link) {
    let cardDiv = document.createElement('div');
    cardDiv.setAttribute('data-ticket_id', ticket_id);
    cardDiv.classList.add('card', 'my-2');

    let cardBodyDiv = document.createElement('div');
    cardBodyDiv.classList.add('card-body');

    let cardTitle = document.createElement('h5');
    cardTitle.classList.add('card-title');
    cardTitle.textContent = title;

    let cardCat = document.createElement('span');
    cardCat.classList.add('badge', 'badge-primary', 'mx-2');
    cardCat.textContent = cat;

    cardTitle.appendChild(cardCat);

    let cardText = document.createElement('p');
    cardText.classList.add('card-text');
    cardText.textContent = desc;

    let joinButton = document.createElement('button');
    joinButton.setAttribute('type', 'button');

    if (!join_link) {
        joinButton.classList.add('btn', 'btn-primary')
        joinButton.textContent = 'Waiting for agent';
        joinButton.disabled = true;
    } else {
        joinButton.classList.add('btn', 'btn-success');
        joinButton.textContent = 'Join';
        joinButton.disabled = false;
        joinButton.setAttribute('target', '_blank');
        joinButton.addEventListener('click', function () {
            window.location.href = join_link;
        });
    }

    cardBodyDiv.appendChild(cardTitle);
    cardBodyDiv.appendChild(cardText);
    cardBodyDiv.appendChild(joinButton);
    cardDiv.appendChild(cardBodyDiv);

    return cardDiv;
}

