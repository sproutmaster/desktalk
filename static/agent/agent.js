const token = window.localStorage.getItem('token');
if (!token)
    window.location.href = '/login';

const socket = io();
socket.emit('connected', {'token': token, 'type': 'agent'});

window.onload = function () {
    update_tickets();
    show_tab('dashboard_container');
}

socket.on('update_users', function (data) {
    const con = $('#users_container');
    con.empty();
    con.append("<h3>Agents Online</h3>")
    con.append(data['agents'].length ? createListGroup(data['agents']) : jQuery.parseHTML("<p>No agents online</p>"));
    con.append("<br>");
    con.append("<h3>Customers Online</h3>");
    con.append(data['agents'].length ? createListGroup(data['customers']) : jQuery.parseHTML("<p>No Customers online</p>"));
});

socket.on('ticket_update', function (data) {

    if(data['type'] === 'new')
        alert("New ticket from " + data['owner_name']);

    if (data['updated_by'] === token)
        return;

    alert("A ticket was updated");
    update_tickets();

});

window.onbeforeunload = function () {
    socket.emit('disconnected', {'token': token, 'type': 'agent'});
}

function update_dashboard(ticket_count, open_count, closed_count) {
    $('#ticket_count').text('Total tickets: ' + ticket_count);
    $('#open_count').text('Open tickets: ' + open_count);
    $('#closed_count').text('Closed tickets: ' + closed_count);
}

function update_tickets() {
    $.ajax({
        url: '/get_tickets',
        type: 'POST',
        data: {},
        success: function (msg) {
            let data = JSON.parse(msg);
            if (data.status !== 'success')
                alert('Server error, please try again later');
            else {
                $('#tickets_container').empty();
                $('#completed_container').empty();
                let ticket_count = data.data.length;
                let open_count = 0;
                let closed_count = 0;
                data.data.map((item) => {
                    let card = createCard(item['_id'], item['owner_name'], item['title'], item['desc'], item['cat'], item['join_link'], item['status'], item['closed_by']);
                    if (item['status'] === 'open') {
                        $('#tickets_container').append(card);
                        open_count++;
                    } else {
                        $('#completed_container').append(card);
                        closed_count++;
                    }
                });
                update_dashboard(ticket_count, open_count, closed_count);
            }
        }
    });
}

function set_ticket_status(ticket_id, status) {
    $.ajax({
        url: '/set_ticket_status',
        type: 'POST',
        data: {
            'ticket_id': ticket_id,
            'status': status,
            'token': token
        },
        success: function (data) {
            if (data.status !== 'success')
                alert('Server error, please try again later');
            else {
                update_tickets();
            }
        }
    });
}

function get_talk_link(ticket_id, title, description, joinButton) {
    $.ajax({
        url: '/get_talk_link',
        type: 'POST',
        data: {
            'ticket_id': ticket_id,
            'title': title,
            'desc': description,
            'token': token
        },
        success: function (data) {
            joinButton.classList.add('btn', 'btn-success');
            joinButton.textContent = 'Join';
            joinButton.disabled = false;
            joinButton.setAttribute('onclick', 'window.open("' + data['link'] + '")');
            socket.emit('ticket_taken', {'ticket_id': ticket_id, 'token': token});
        }
    });
}

function createCard(ticket_id, owner_name, title, desc, cat, join_link, status, closed_by) {
    let cardDiv = document.createElement('div');
    cardDiv.classList.add('card', 'my-2');

    let cardBodyDiv = document.createElement('div');
    cardBodyDiv.classList.add('card-body');

    let cardTitle = document.createElement('h5');
    cardTitle.classList.add('card-title');
    cardTitle.textContent = title;

    let cardName = document.createElement('span');
    cardName.classList.add('badge', 'badge-primary', 'mx-2');
    cardName.textContent = "User: " + owner_name;

    let cardCat = document.createElement('span');
    cardCat.classList.add('badge', 'badge-primary', 'mx-2');
    cardCat.textContent = 'Category: ' + cat;

    cardTitle.appendChild(cardName);
    cardTitle.appendChild(cardCat);

    let cardText = document.createElement('p');
    cardText.classList.add('card-text');
    cardText.textContent = desc;

    let joinButton;
    if (status === 'open') {
        joinButton = document.createElement('button');
        joinButton.setAttribute('type', 'button');

        if (!join_link) {
            joinButton.classList.add('btn', 'btn-primary');
            joinButton.textContent = 'Create talk';
            joinButton.addEventListener('click', function (e) {
                joinButton.disabled = true;
                get_talk_link(ticket_id, title, desc, joinButton);
            });
        } else {
            joinButton.setAttribute('target', '_blank');
            joinButton.classList.add('btn', 'btn-success');
            joinButton.textContent = 'Join';
            joinButton.addEventListener('click', function () {
                window.location.href = join_link;
            });
        }
    }

    let setStatusButton = document.createElement('button');
    setStatusButton.setAttribute('type', 'button');
    setStatusButton.classList.add('btn', 'btn-primary', 'mx-2');
    setStatusButton.textContent = 'Mark as ' + (status === 'open' ? 'closed' : 'open');
    setStatusButton.addEventListener('click', function (e) {
        set_ticket_status(ticket_id, (status === 'open' ? 'closed' : 'open'));
    });

    cardBodyDiv.appendChild(cardTitle);
    cardBodyDiv.appendChild(cardText);
    if (status === 'open')
        cardBodyDiv.appendChild(joinButton);
    cardBodyDiv.appendChild(setStatusButton);
    cardDiv.appendChild(cardBodyDiv);

    return cardDiv;
}

function createListGroup(listItems) {
    let ul = document.createElement("ul");
    ul.classList.add("list-group");
    listItems.forEach(function (item) {
        let li = document.createElement("li");
        li.classList.add("list-group-item");
        li.appendChild(document.createTextNode(item));
        ul.appendChild(li);
    });
    return ul;
}
function logout() {
    window.localStorage.removeItem('token');
    window.location.href = "/";
}

function show_tab(tab) {
    let tabs = ['dashboard_container', 'tickets_container', 'completed_container', 'users_container'];
    tabs.forEach((item) => {
        if (item === tab)
            $('#' + item).removeClass('_hidden');
        else
            $('#' + item).addClass('_hidden');
    });

    $('#dashboard').removeClass('_hidden');
}
