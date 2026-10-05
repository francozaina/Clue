import { Engine3D } from './engine3d.js';
import { NetworkManager } from './network.js';

const ui = {
    menu: document.getElementById('main-menu'),
    lobby: document.getElementById('lobby'),
    game: document.getElementById('game-container'),
    hud: document.getElementById('hud'),
    roleReveal: document.getElementById('role-reveal'),
    gameOver: document.getElementById('game-over'),
    
    // Buttons & Inputs
    btnHost: document.getElementById('btn-host'),
    btnJoin: document.getElementById('btn-join'),
    btnStart: document.getElementById('btn-start'),
    inputLobby: document.getElementById('input-lobby'),
    inputName: document.getElementById('input-name'),
    
    lobbyIdDisplay: document.getElementById('lobby-id-display'),
    playerList: document.getElementById('player-list'),
    
    taskText: document.getElementById('task-text'),
    actionBtn: document.getElementById('action-btn'),
    sabotageBtn: document.getElementById('sabotage-btn'),
    progressBar: document.getElementById('progress-bar')
};

let engine;
let network;

let myId = null;
let gameState = {
    status: 'lobby', // lobby, playing, finished
    players: {}, // id -> { name, x, z, isDead, maskIndex, gender, role }
    map: [],
    blackout: false,
    tasksTotal: 0,
    tasksCompleted: 0
};
let myRole = 'guest';

// Mapa básico: 1 pared, 0 suelo, 2 mesa/tarea, 3 spawn
const defaultMap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,3,0,0,1,0,0,0,0,0,1,0,0,3,1],
    [1,0,2,0,1,0,2,0,2,0,1,0,2,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,0,1,1,1,0,1,0,1,1,1,0,1,1],
    [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,2,0,0,0,0,1,0,0,0,2,0,0,1],
    [1,3,0,0,0,3,0,1,0,3,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

function init() {
    engine = new Engine3D('game-container');
    network = new NetworkManager();
    
    ui.btnHost.onclick = async () => {
        if (!ui.inputName.value) return alert("Ingresa un nombre");
        try {
            myId = await network.init(true, null, ui.inputName.value);
            showLobby(myId);
            addPlayerToState(myId, ui.inputName.value);
        } catch(e) { alert("Error al hostear"); }
    };
    
    ui.btnJoin.onclick = async () => {
        if (!ui.inputName.value || !ui.inputLobby.value) return alert("Nombre y Sala requeridos");
        try {
            myId = await network.init(false, ui.inputLobby.value, ui.inputName.value);
            showLobby(ui.inputLobby.value);
        } catch(e) { alert("Error al unirse"); }
    };
    
    ui.btnStart.onclick = () => {
        if (network.isHost) startGame();
    };
    
    network.onGameStateUpdate = handleNetworkData;
    network.onPlayerLeft = (id) => {
        if (network.isHost && gameState.players[id]) {
            delete gameState.players[id];
            network.broadcast({ type: 'state', state: gameState });
            updateLobbyUI();
        }
    };
    
    // Loop de red para enviar posición (60fps)
    setInterval(() => {
        if (gameState.status === 'playing' && engine.localPlayerId && !gameState.players[myId]?.isDead) {
            const pos = engine.players[myId].mesh.position;
            network.sendToHost({
                type: 'move',
                id: myId,
                x: pos.x,
                z: pos.z
            });
        }
    }, 1000/60);
    
    // Host tick loop
    setInterval(() => {
        if (network.isHost && gameState.status === 'playing') {
            network.broadcast({ type: 'state', state: gameState });
        }
    }, 1000/20); // 20 tick rate
    
    // Action keys
    window.addEventListener('keydown', (e) => {
        if (gameState.status !== 'playing' || gameState.players[myId]?.isDead) return;
        if (e.key === 'e' || e.key === 'E') doAction();
        if ((e.key === 'q' || e.key === 'Q') && myRole === 'killer') attemptKill();
        if (e.key === ' ' && myRole === 'killer') toggleBlackout();
    });
}

function showLobby(id) {
    ui.menu.style.display = 'none';
    ui.lobby.style.display = 'flex';
    ui.lobbyIdDisplay.innerText = "Sala: " + id;
    ui.btnStart.style.display = network.isHost ? 'block' : 'none';
}

function addPlayerToState(id, name) {
    const genders = ['male', 'female'];
    const gender = genders[Object.keys(gameState.players).length % 2];
    const mask = Object.keys(gameState.players).length; // 0-9
    
    gameState.players[id] = {
        name,
        gender,
        maskIndex: mask,
        isDead: false,
        x: 0, z: 0,
        role: 'guest'
    };
    updateLobbyUI();
}

function updateLobbyUI() {
    ui.playerList.innerHTML = '';
    for (let id in gameState.players) {
        const p = gameState.players[id];
        const li = document.createElement('li');
        li.innerText = `${p.name} (${p.gender === 'male' ? 'M' : 'F'}) - Máscara ${p.maskIndex}`;
        ui.playerList.appendChild(li);
    }
}

function handleNetworkData(sender, data) {
    if (data.type === 'join' && network.isHost) {
        addPlayerToState(sender, data.name);
        network.broadcast({ type: 'state', state: gameState });
    }
    else if (data.type === 'state') {
        const oldStatus = gameState.status;
        gameState = data.state;
        
        if (oldStatus === 'lobby' && gameState.status === 'playing') {
            setupGameClient();
        } else if (gameState.status === 'playing') {
            updateGameClient();
        } else if (gameState.status === 'finished') {
            showGameOver(gameState.winner);
        }
        
        if (gameState.status === 'lobby') {
            updateLobbyUI();
        }
    }
    else if (data.type === 'move' && network.isHost) {
        if (gameState.players[data.id]) {
            gameState.players[data.id].x = data.x;
            gameState.players[data.id].z = data.z;
        }
    }
    else if (data.type === 'action' && network.isHost) {
        // Tarea completada
        if (!gameState.players[sender].isDead) {
            gameState.tasksCompleted++;
            if (gameState.tasksCompleted >= gameState.tasksTotal) {
                endGame('guests');
            }
        }
    }
    else if (data.type === 'kill' && network.isHost) {
        if (gameState.blackout && !gameState.players[data.target].isDead) {
            gameState.players[data.target].isDead = true;
            checkWinCondition();
        }
    }
    else if (data.type === 'sabotage' && network.isHost) {
        gameState.blackout = true;
        setTimeout(() => {
            if (gameState.status === 'playing') {
                gameState.blackout = false;
                network.broadcast({ type: 'state', state: gameState });
            }
        }, 15000); // 15 sec blackout
    }
}

function startGame() {
    gameState.status = 'playing';
    gameState.map = defaultMap;
    
    // Assign roles
    const playerIds = Object.keys(gameState.players);
    const killerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    
    let spawnIdx = 0;
    const spawns = [];
    for(let z=0; z<defaultMap.length; z++) {
        for(let x=0; x<defaultMap[z].length; x++) {
            if (defaultMap[z][x] === 3) spawns.push({x: x*2, z: z*2});
            if (defaultMap[z][x] === 2) gameState.tasksTotal += 3; // 3 tasks per table
        }
    }
    
    playerIds.forEach(id => {
        gameState.players[id].role = (id === killerId) ? 'killer' : 'guest';
        const sp = spawns[spawnIdx % spawns.length];
        gameState.players[id].x = sp.x;
        gameState.players[id].z = sp.z;
        spawnIdx++;
    });
    
    network.broadcast({ type: 'state', state: gameState });
    setupGameClient();
}

function setupGameClient() {
    ui.lobby.style.display = 'none';
    ui.hud.style.display = 'block';
    
    engine.buildMap(gameState.map);
    
    const me = gameState.players[myId];
    myRole = me.role;
    
    // Reveal Role
    ui.roleReveal.style.display = 'flex';
    ui.roleReveal.innerHTML = `<h1>Eres un ${myRole === 'killer' ? '<span style="color:red">ASESINO</span>' : '<span style="color:cyan">INVITADO</span>'}</h1>
    <p>${myRole === 'killer' ? 'Mata a todos durante el apagón.' : 'Completa tareas y sobrevive.'}</p>`;
    setTimeout(() => { ui.roleReveal.style.display = 'none'; }, 4000);
    
    if (myRole === 'killer') {
        ui.sabotageBtn.style.display = 'block';
        ui.actionBtn.innerText = 'Matar (Q)';
    }
    
    for (let id in gameState.players) {
        const p = gameState.players[id];
        engine.addPlayer(id, p.x, p.z, p.gender, p.maskIndex, id === myId);
    }
}

function updateGameClient() {
    ui.taskText.innerText = `Tareas: ${gameState.tasksCompleted} / ${gameState.tasksTotal}`;
    engine.setBlackout(gameState.blackout, myRole === 'killer');
    
    for (let id in gameState.players) {
        const p = gameState.players[id];
        if (p.isDead && engine.players[id]) {
            // Rotar mesh para simular muerte
            engine.players[id].mesh.rotation.z = Math.PI / 2;
            engine.players[id].mesh.position.y = 0.2;
        } else if (!p.isDead) {
            engine.updatePlayerPosition(id, p.x, p.z);
        }
    }
    
    if (gameState.players[myId].isDead) {
        ui.taskText.innerText = "ESTÁS MUERTO";
        ui.taskText.style.color = "red";
    }
}

// Logic for Actions
let isDoingTask = false;
function doAction() {
    if (myRole === 'killer' || isDoingTask) return;
    
    // Check distance to tables (type 2)
    const p = engine.players[myId].mesh.position;
    let nearTable = false;
    for(let z=0; z<gameState.map.length; z++) {
        for(let x=0; x<gameState.map[z].length; x++) {
            if (gameState.map[z][x] === 2) {
                const dx = (x*2) - p.x;
                const dz = (z*2) - p.z;
                if (dx*dx + dz*dz < 4) nearTable = true;
            }
        }
    }
    
    if (nearTable) {
        isDoingTask = true;
        ui.progressBar.style.display = 'block';
        ui.progressBar.firstElementChild.style.width = '0%';
        let prog = 0;
        const int = setInterval(() => {
            prog += 10;
            ui.progressBar.firstElementChild.style.width = prog + '%';
            if (prog >= 100) {
                clearInterval(int);
                isDoingTask = false;
                ui.progressBar.style.display = 'none';
                network.sendToHost({ type: 'action' });
            }
        }, 300);
    }
}

function attemptKill() {
    if (!gameState.blackout) return; // Solo mata en apagon
    
    const p = engine.players[myId].mesh.position;
    for (let id in gameState.players) {
        if (id !== myId && !gameState.players[id].isDead) {
            const op = gameState.players[id];
            const dx = op.x - p.x;
            const dz = op.z - p.z;
            if (dx*dx + dz*dz < 4) { // Cerca
                network.sendToHost({ type: 'kill', target: id });
                break;
            }
        }
    }
}

function toggleBlackout() {
    if (!gameState.blackout) {
        network.sendToHost({ type: 'sabotage' });
        ui.sabotageBtn.style.opacity = 0.5;
        setTimeout(() => ui.sabotageBtn.style.opacity = 1, 60000); // Cooldown (visual)
    }
}

function checkWinCondition() {
    let aliveGuests = 0;
    for(let id in gameState.players) {
        if (gameState.players[id].role === 'guest' && !gameState.players[id].isDead) {
            aliveGuests++;
        }
    }
    if (aliveGuests === 0) endGame('killer');
}

function endGame(winner) {
    gameState.status = 'finished';
    gameState.winner = winner;
    network.broadcast({ type: 'state', state: gameState });
    showGameOver(winner);
}

function showGameOver(winner) {
    ui.hud.style.display = 'none';
    ui.gameOver.style.display = 'flex';
    const text = (winner === 'killer') ? '¡EL ASESINO GANA!' : '¡LOS INVITADOS GANAN!';
    ui.gameOver.innerHTML = `<h1>${text}</h1><button onclick="location.reload()">Volver a jugar</button>`;
}

init();
