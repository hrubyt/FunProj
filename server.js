const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store active games and players
let games = {};
let players = {};

// Initialize the Alice Chess board
function initializeBoard() {
    return [
        ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
        ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
        ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
    ];
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    ws.id = uuidv4(); // Assign a unique ID to the player

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        handleMessage(ws, data);
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });
});

// Handle incoming messages
function handleMessage(ws, data) {
    switch (data.type) {
        case 'join':
            handleJoin(ws);
            break;
        case 'move':
            handleMove(ws, data);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

// Handle player joining
function handleJoin(ws) {
    const gameId = findAvailableGame();
    if (!gameId) {
        // Create a new game
        const newGameId = uuidv4();
        games[newGameId] = {
            players: [ws],
            board: [initializeBoard(), initializeBoard()], // Two boards for Alice Chess
            currentTurn: 'white',
        };
        players[ws.id] = { gameId: newGameId, role: 'white' };
        ws.send(JSON.stringify({ type: 'assignRole', role: 'white', gameId: newGameId }));
    } else {
        // Join an existing game
        games[gameId].players.push(ws);
        players[ws.id] = { gameId, role: 'black' };
        ws.send(JSON.stringify({ type: 'assignRole', role: 'black', gameId }));
        // Notify both players that the game has started
        games[gameId].players.forEach((player) => {
            player.send(JSON.stringify({ type: 'startGame', board: games[gameId].board }));
        });
    }
}

// Handle player moves
function handleMove(ws, data) {
    const { gameId, from, to } = data;
    const game = games[gameId];
    if (!game || game.players.length < 2) return;

    const player = players[ws.id];
    if (player.role !== game.currentTurn) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
        return;
    }

    if (validateMove(game, from, to)) {
        updateBoard(game, from, to);
        game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';
        // Notify both players of the updated board
        game.players.forEach((player) => {
            player.send(JSON.stringify({ type: 'updateBoard', board: game.board }));
        });
    } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid move' }));
    }
}

// Validate a move (basic validation for now)
function validateMove(game, from, to) {
    const [board1, board2] = game.board;
    const fromBoard = from.board === 0 ? board1 : board2;
    const toBoard = to.board === 0 ? board1 : board2;

    const piece = fromBoard[from.row][from.col];
    if (!piece) return false; // No piece to move

    // Basic move validation (can be expanded with Alice Chess rules)
    return true;
}

// Update the board after a valid move
function updateBoard(game, from, to) {
    const [board1, board2] = game.board;
    const fromBoard = from.board === 0 ? board1 : board2;
    const toBoard = to.board === 0 ? board1 : board2;

    const piece = fromBoard[from.row][from.col];
    fromBoard[from.row][from.col] = '';
    toBoard[to.row][to.col] = piece;
}

// Handle player disconnection
function handleDisconnect(ws) {
    const player = players[ws.id];
    if (player) {
        const game = games[player.gameId];
        if (game) {
            game.players.forEach((p) => {
                if (p !== ws) {
                    p.send(JSON.stringify({ type: 'opponentDisconnected' }));
                }
            });
            delete games[player.gameId];
        }
        delete players[ws.id];
    }
}

// Find an available game to join
function findAvailableGame() {
    for (const gameId in games) {
        if (games[gameId].players.length === 1) {
            return gameId;
        }
    }
    return null;
}

// Start the server
server.listen(process.env.PORT || 3000, () => {
    console.log('Server is running on port 3000');
});
