export class NetworkManager {
    constructor() {
        this.peer = null;
        this.connections = {}; // id -> DataConnection
        this.isHost = false;
        
        // Callbacks
        this.onConnected = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onGameStateUpdate = null;
        this.onLobbyClosed = null;
    }
    
    init(isHost, lobbyId = null, username = "Player") {
        this.isHost = isHost;
        this.username = username;
        
        return new Promise((resolve, reject) => {
            // Using PeerJS public server
            const peerId = isHost ? this.generateLobbyId() : null;
            
            // Note: In a real app we'd handle errors if ID taken
            this.peer = new Peer(peerId, {
                debug: 2
            });
            
            this.peer.on('open', (id) => {
                console.log('My peer ID is: ' + id);
                this.myId = id;
                
                if (isHost) {
                    this.setupHostListeners();
                    resolve(id);
                } else {
                    this.joinLobby(lobbyId).then(() => resolve(id)).catch(reject);
                }
            });
            
            this.peer.on('error', (err) => {
                console.error(err);
                reject(err);
            });
        });
    }
    
    generateLobbyId() {
        return 'CLUE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    setupHostListeners() {
        this.peer.on('connection', (conn) => {
            conn.on('open', () => {
                this.connections[conn.peer] = conn;
                
                // Enviar estado inicial u hola
                this.broadcast({ type: 'welcome', id: conn.peer });
                
                if (this.onPlayerJoined) this.onPlayerJoined(conn.peer);
                
                conn.on('data', (data) => {
                    this.handleData(conn.peer, data);
                });
                
                conn.on('close', () => {
                    delete this.connections[conn.peer];
                    if (this.onPlayerLeft) this.onPlayerLeft(conn.peer);
                });
            });
        });
    }
    
    joinLobby(lobbyId) {
        return new Promise((resolve, reject) => {
            const conn = this.peer.connect(lobbyId);
            
            conn.on('open', () => {
                this.hostConn = conn;
                
                // Enviar mi nombre
                this.sendToHost({ type: 'join', name: this.username });
                
                if (this.onConnected) this.onConnected();
                
                conn.on('data', (data) => {
                    this.handleData('host', data);
                });
                
                conn.on('close', () => {
                    if (this.onLobbyClosed) this.onLobbyClosed();
                });
                resolve();
            });
            
            conn.on('error', (err) => reject(err));
        });
    }
    
    handleData(sender, data) {
        if (this.onGameStateUpdate) {
            this.onGameStateUpdate(sender, data);
        }
    }
    
    broadcast(data) {
        if (!this.isHost) return;
        for (let id in this.connections) {
            this.connections[id].send(data);
        }
    }
    
    sendToHost(data) {
        if (this.isHost) {
            this.handleData(this.myId, data); // Loopback para el host
        } else if (this.hostConn) {
            this.hostConn.send(data);
        }
    }
    
    sendToClient(clientId, data) {
        if (this.isHost && this.connections[clientId]) {
            this.connections[clientId].send(data);
        }
    }
}
